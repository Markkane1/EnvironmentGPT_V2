const mockPdfGetText = jest.fn()
const mockPdfDestroy = jest.fn()
const mockPDFParse = jest.fn().mockImplementation(() => ({
  getText: mockPdfGetText,
  destroy: mockPdfDestroy,
}))

const mockMammothExtractRawText = jest.fn()
const mockWordExtract = jest.fn()
const mockWordExtractor = jest.fn().mockImplementation(() => ({
  extract: mockWordExtract,
}))

jest.mock('pdf-parse', () => ({
  PDFParse: mockPDFParse,
}))

jest.mock('mammoth', () => ({
  extractRawText: mockMammothExtractRawText,
}))

jest.mock('word-extractor', () => mockWordExtractor)

import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { isSupportedDocumentFile } from '@/lib/utils/document-upload'
import { SUPPORTED_FILE_TYPES } from '@/lib/constants'

function createTestFile(
  parts: Array<string | Uint8Array>,
  name: string,
  options: { type: string }
): File {
  const file = new File(parts, name, options)
  const buffers = parts.map(part => typeof part === 'string' ? Buffer.from(part) : Buffer.from(part))
  const combined = Buffer.concat(buffers)

  Object.defineProperty(file, 'text', {
    value: async () => combined.toString('utf8'),
  })

  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ),
  })

  return file
}

describe('document upload support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPdfDestroy.mockResolvedValue(undefined)
  })

  it('accepts PDF, Word, and Markdown files by extension', () => {
    expect(isSupportedDocumentFile(createTestFile(['pdf'], 'report.pdf', { type: '' }))).toBe(true)
    expect(isSupportedDocumentFile(createTestFile(['doc'], 'report.doc', { type: '' }))).toBe(true)
    expect(isSupportedDocumentFile(createTestFile(['docx'], 'report.docx', { type: '' }))).toBe(true)
    expect(isSupportedDocumentFile(createTestFile(['md'], 'report.md', { type: '' }))).toBe(true)
  })

  it('only advertises file families that the extractor actually supports', () => {
    expect(SUPPORTED_FILE_TYPES).toEqual({
      documents: ['.pdf', '.doc', '.docx', '.md', '.markdown', '.txt'],
    })
  })

  it('extracts Markdown text directly', async () => {
    const file = createTestFile(['# Heading\r\n\r\nParagraph'], 'notes.md', { type: 'text/markdown' })

    const result = await extractTextFromDocumentFile(file)

    expect(result).toEqual({
      content: '# Heading\n\nParagraph',
      extension: 'md',
      fileType: 'text/markdown',
      fileSize: file.size,
    })
  })

  it('uses the PDF parser for PDF files', async () => {
    mockPdfGetText.mockResolvedValue({
      text: 'Page one\n\nPage two',
    })

    const file = createTestFile([new Uint8Array([37, 80, 68, 70])], 'report.pdf', { type: 'application/pdf' })
    const result = await extractTextFromDocumentFile(file)

    expect(mockPDFParse).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    })
    expect(mockPdfGetText).toHaveBeenCalledWith({
      pageJoiner: '\n\n',
    })
    expect(mockPdfDestroy).toHaveBeenCalled()
    expect(result.content).toBe('Page one\n\nPage two')
  })

  it('uses Mammoth for DOCX files', async () => {
    mockMammothExtractRawText.mockResolvedValue({
      value: 'DOCX content\r\n\r\nMore content',
    })

    const file = createTestFile([new Uint8Array([80, 75, 3, 4])], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const result = await extractTextFromDocumentFile(file)

    expect(mockMammothExtractRawText).toHaveBeenCalledTimes(1)
    expect(mockMammothExtractRawText.mock.calls[0][0].arrayBuffer.byteLength).toBeGreaterThan(0)
    expect(result.content).toBe('DOCX content\n\nMore content')
  })

  it('uses the legacy Word extractor for DOC files', async () => {
    mockWordExtract.mockResolvedValue({
      getBody: () => 'Legacy body',
      getFootnotes: () => 'Footnote',
      getEndnotes: () => '',
      getHeaders: () => 'Header',
      getTextboxes: () => 'Textbox',
    })

    const file = createTestFile([new Uint8Array([208, 207, 17, 224])], 'report.doc', {
      type: 'application/msword',
    })
    const result = await extractTextFromDocumentFile(file)

    expect(mockWordExtractor).toHaveBeenCalled()
    expect(mockWordExtract).toHaveBeenCalledWith(expect.any(Buffer))
    expect(result.content).toBe('Legacy body\n\nFootnote\n\nHeader\n\nTextbox')
  })
})
