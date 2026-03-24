import { NextRequest } from 'next/server'
import { createAuthHeaders } from '../../helpers/auth'

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getDocument: jest.fn(),
    listDocuments: jest.fn(),
    searchDocuments: jest.fn(),
  },
}))

import { documentService } from '@/lib/services/document-service'
import { GET } from '@/app/api/documents/route'

function authedRequest(url: string) {
  return new NextRequest(url, {
    headers: createAuthHeaders('viewer', 'viewer-user'),
  })
}

describe('document route performance regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should clamp collection page size to 100 and strip large content payloads from list responses', async () => {
    ;(documentService.listDocuments as jest.Mock).mockResolvedValue({
      documents: [{
        id: 'doc-1',
        title: 'Punjab Air Quality Report',
        content: 'A'.repeat(1200),
        category: 'Air Quality',
        audience: 'General Public',
        tags: ['air'],
        chunks: [{ id: 'chunk-1' }],
      }],
      total: 1,
      page: 1,
      pageSize: 100,
      hasMore: false,
    })

    const response = await GET(authedRequest('http://localhost/api/documents?page=1&pageSize=500'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(documentService.listDocuments).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      100,
      'viewer-user'
    )
    expect(payload.pageSize).toBe(100)
    expect(payload.documents[0].content.length).toBeLessThanOrEqual(503)
    expect(payload.documents[0].content.endsWith('...')).toBe(true)
    expect(payload.documents[0].chunks).toBeUndefined()
  })

  it('should clamp search limits to 100 and omit nested chunk payloads from search responses', async () => {
    ;(documentService.searchDocuments as jest.Mock).mockResolvedValue({
      documents: [{
        id: 'doc-2',
        title: 'Water Monitoring Summary',
        content: 'B'.repeat(900),
        category: 'Water Resources',
        audience: 'Technical',
        tags: ['water'],
        chunks: [{ id: 'chunk-2' }],
      }],
      total: 1,
      page: 1,
      pageSize: 100,
      hasMore: false,
    })

    const response = await GET(authedRequest('http://localhost/api/documents?query=water&limit=999'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(documentService.searchDocuments).toHaveBeenCalledWith(
      'water',
      expect.any(Object),
      100,
      'viewer-user'
    )
    expect(payload.documents[0].content.length).toBeLessThanOrEqual(503)
    expect(payload.documents[0].chunks).toBeUndefined()
  })
})
