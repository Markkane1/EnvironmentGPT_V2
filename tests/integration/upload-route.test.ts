/** @jest-environment node */
import { POST } from '@/app/api/upload/route'
import { createAuthHeaders } from '../helpers/auth'

jest.mock('@/lib/services/document-ingestion-service', () => ({
  documentIngestionService: {
    ingestDocument: jest.fn(),
  },
}))

import { documentIngestionService } from '@/lib/services/document-ingestion-service'

function createMultipartRequest(fields: Record<string, string | File>): Request {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }

  return new Request('http://localhost/api/upload', {
    method: 'POST',
    headers: createAuthHeaders(),
    body: formData,
  })
}

describe('/api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects malformed tags with a 400 response', async () => {
    const request = createMultipartRequest({
      file: new File(
        ['This upload is intentionally long enough to pass content validation. '.repeat(3)],
        'report.txt',
        { type: 'text/plain' }
      ),
      category: 'Air Quality',
      title: 'Valid Title',
      content: 'This upload is intentionally long enough to pass content validation. '.repeat(3),
      tags: 'not-json',
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Validation failed')
    expect(body.error.details).toEqual([
      {
        path: 'tags',
        message: 'Tags must be provided as a JSON array of strings',
      },
    ])
    expect(documentIngestionService.ingestDocument).not.toHaveBeenCalled()
  })

  it('uploads and ingests a valid markdown document', async () => {
    const content = 'Air quality monitoring in Lahore is critical for public health. '.repeat(4)
    const file = new File([content], 'air-report.md', { type: 'text/markdown' })

    ;(documentIngestionService.ingestDocument as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      title: 'Air Report',
      content,
      category: 'Air Quality',
      audience: 'General Public',
      tags: ['air', 'monitoring'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const request = createMultipartRequest({
      file,
      category: 'Air Quality',
      title: 'Air Report',
      tags: JSON.stringify(['air', 'monitoring']),
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.document.id).toBe('doc-1')
    expect(documentIngestionService.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Air Report',
        content: content.trim(),
        category: 'Air Quality',
        audience: 'General Public',
        tags: ['air', 'monitoring'],
        source: 'air-report.md',
        fileType: 'text/markdown',
        fileSize: file.size,
      })
    )
  })

  it('sanitizes uploaded filenames before persisting metadata', async () => {
    const content = 'Air quality monitoring in Lahore is critical for public health. '.repeat(4)
    const file = new File([content], '../../private/air-report.md', { type: 'text/markdown' })

    ;(documentIngestionService.ingestDocument as jest.Mock).mockResolvedValue({
      id: 'doc-safe',
      title: 'air-report',
      content,
      category: 'Air Quality',
      audience: 'General Public',
      tags: [],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const request = createMultipartRequest({
      file,
      category: 'Air Quality',
    })

    const response = await POST(request as unknown as Parameters<typeof POST>[0])

    expect(response.status).toBe(201)
    expect(documentIngestionService.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'air-report',
        source: 'air-report.md',
      })
    )
  })
})
