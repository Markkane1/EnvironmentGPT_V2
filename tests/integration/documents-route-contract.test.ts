import { NextRequest } from 'next/server'

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getDocument: jest.fn(),
    searchDocuments: jest.fn(),
    listDocuments: jest.fn(),
    createDocument: jest.fn(),
    deleteDocument: jest.fn(),
  },
}))

import { documentService } from '@/lib/services/document-service'
import { GET } from '@/app/api/documents/route'

describe('/api/documents contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a single document when an id query param is provided', async () => {
    ;(documentService.getDocument as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      title: 'Punjab Air Quality Report',
      content: 'Full document text',
      category: 'Air Quality',
      audience: 'General Public',
      tags: [],
      isActive: true,
      language: 'en',
      createdAt: new Date('2026-03-20T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
    })

    const response = await GET(new NextRequest('http://localhost/api/documents?id=doc-1'))
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.document.title).toBe('Punjab Air Quality Report')
    expect(documentService.getDocument).toHaveBeenCalledWith('doc-1')
  })
})
