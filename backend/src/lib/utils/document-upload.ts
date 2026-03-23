const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'md', 'markdown', 'txt'] as const

const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const

export const SUPPORTED_DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.md,.markdown,.txt'

function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop()
  return extension ? extension.toLowerCase() : ''
}

export function isSupportedDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name)

  if (SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension as typeof SUPPORTED_DOCUMENT_EXTENSIONS[number])) {
    return true
  }

  return SUPPORTED_DOCUMENT_MIME_TYPES.includes(
    file.type as typeof SUPPORTED_DOCUMENT_MIME_TYPES[number],
  )
}

export function getSupportedDocumentError(maxFileSizeBytes: number): string {
  return `File must be PDF, Word (.doc/.docx), Markdown (.md), or text and less than ${maxFileSizeBytes / 1024 / 1024}MB`
}
