/** @jest-environment node */
jest.mock('@/lib/db', () => ({
  db: {
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    documentChunk: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/document-ingestion-service', () => ({
  documentIngestionService: {
    ingestDocument: jest.fn(),
  },
}))

jest.mock('@/lib/services/embedding-service', () => ({
  embeddingService: {
    generateEmbedding: jest.fn(),
    processDocumentEmbeddings: jest.fn(),
  },
}))

import { POST } from '@/app/api/ingest/route'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'

function createMultipartRequest(fields: Record<string, string | File>): Request {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }

  return new Request('http://localhost/api/ingest', {
    method: 'POST',
    body: formData,
  })
}

function createJsonRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/ingest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects multipart uploads that do not contain enough content', async () => {
    const request = createMultipartRequest({
      file: new File(['too short'], 'summary.txt', { type: 'text/plain' }),
      category: 'Air Quality',
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([
      expect.objectContaining({
        path: 'content',
        message: 'Content must be at least 100 characters',
      }),
    ])
    expect(documentIngestionService.ingestDocument).not.toHaveBeenCalled()
  })

  it('ingests a valid JSON document payload', async () => {
    const content = 'Environmental monitoring data for Punjab continues to expand across districts. '.repeat(3)

    ;(documentIngestionService.ingestDocument as jest.Mock).mockResolvedValue({
      id: 'doc-42',
      title: 'Punjab Monitoring Report',
      content,
      category: 'Policy & Regulation',
      audience: 'Technical',
      tags: ['monitoring'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const request = createJsonRequest({
      title: 'Punjab Monitoring Report',
      content,
      category: 'Policy & Regulation',
      audience: 'Technical',
      tags: ['monitoring'],
      source: 'api',
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.document.id).toBe('doc-42')
    expect(documentIngestionService.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Punjab Monitoring Report',
        content,
        category: 'Policy & Regulation',
        audience: 'Technical',
        tags: ['monitoring'],
        source: 'api',
      })
    )
  })

  it('ingests a valid markdown multipart payload', async () => {
    const content = '# Punjab Environmental Update\n\nAir monitoring coverage expanded significantly across districts. '.repeat(3)
    const file = new File([content], 'update.md', { type: 'text/markdown' })

    ;(documentIngestionService.ingestDocument as jest.Mock).mockResolvedValue({
      id: 'doc-md',
      title: 'Punjab Environmental Update',
      content,
      category: 'Policy & Regulation',
      audience: 'General Public',
      tags: ['markdown'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const request = createMultipartRequest({
      file,
      title: 'Punjab Environmental Update',
      category: 'Policy & Regulation',
      tags: JSON.stringify(['markdown']),
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.document.id).toBe('doc-md')
    expect(documentIngestionService.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Punjab Environmental Update',
        content: content.trim(),
        category: 'Policy & Regulation',
        audience: 'General Public',
        tags: ['markdown'],
        source: 'update.md',
        fileType: 'text/markdown',
        fileSize: file.size,
      })
    )
  })
})
