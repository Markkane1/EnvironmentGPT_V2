import { isSupportedDocumentFile } from '@/lib/utils/document-upload'

function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop()
  return extension ? extension.toLowerCase() : ''
}

function sanitizeExtractedText(content: string): string {
  return content
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ensureExtractedContent(content: string, fileLabel: string): string {
  const sanitized = sanitizeExtractedText(content)

  if (!sanitized) {
    throw new Error(`No readable text could be extracted from ${fileLabel}`)
  }

  return sanitized
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
  })

  try {
    const result = await parser.getText({
      pageJoiner: '\n\n',
    })

    return ensureExtractedContent(result.text, 'the PDF file')
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })

  return ensureExtractedContent(result.value, 'the Word document')
}

async function extractDocText(buffer: ArrayBuffer): Promise<string> {
  const WordExtractor = require('word-extractor')
  const extractor = new WordExtractor()
  const document = await extractor.extract(Buffer.from(buffer))

  const sections = [
    document.getBody?.(),
    document.getFootnotes?.(),
    document.getEndnotes?.(),
    document.getHeaders?.(),
    document.getTextboxes?.(),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  return ensureExtractedContent(sections.join('\n\n'), 'the Word document')
}

export async function extractTextFromDocumentFile(file: File): Promise<{
  content: string
  extension: string
  fileType: string
  fileSize: number
}> {
  if (!isSupportedDocumentFile(file)) {
    throw new Error('Unsupported file type')
  }

  const extension = getFileExtension(file.name)
  const fileType = file.type || extension || 'application/octet-stream'

  if (
    extension === 'md' ||
    extension === 'markdown' ||
    fileType === 'text/markdown' ||
    fileType === 'text/x-markdown'
  ) {
    return {
      content: ensureExtractedContent(await file.text(), 'the Markdown file'),
      extension,
      fileType,
      fileSize: file.size,
    }
  }

  if (extension === 'txt' || fileType === 'text/plain') {
    return {
      content: ensureExtractedContent(await file.text(), 'the text file'),
      extension,
      fileType,
      fileSize: file.size,
    }
  }

  const buffer = await file.arrayBuffer()

  if (extension === 'pdf' || fileType === 'application/pdf') {
    return {
      content: await extractPdfText(buffer),
      extension,
      fileType,
      fileSize: file.size,
    }
  }

  if (
    extension === 'docx' ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      content: await extractDocxText(buffer),
      extension,
      fileType,
      fileSize: file.size,
    }
  }

  return {
    content: await extractDocText(buffer),
    extension,
    fileType,
    fileSize: file.size,
  }
}
