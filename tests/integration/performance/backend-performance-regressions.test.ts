import { NextRequest } from 'next/server'
import { clearRateLimitStore } from '@/lib/security/rate-limiter'
import { createAuthHeaders } from '../../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    document: {
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    documentChunk: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    feedback: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/utils', () => ({
  createChunks: jest.fn(),
  calculateRelevanceScore: jest.fn().mockReturnValue(1),
}))

jest.mock('@/lib/monitoring/health', () => ({
  getHealthSnapshot: jest.fn(),
}))

import { db } from '@/lib/db'
import { createChunks } from '@/lib/utils'
import { DocumentService } from '@/lib/services/document-service'
import { RAGService } from '@/lib/services/rag-service'
import { GET as getStats } from '@/app/api/stats/route'

const mockDb = db as any
const mockCreateChunks = createChunks as jest.Mock

function adminRequest(url: string) {
  return new NextRequest(url, {
    headers: createAuthHeaders('admin', 'admin-user'),
  })
}

describe('backend performance regressions', () => {
  beforeEach(() => {
    clearRateLimitStore()
    jest.clearAllMocks()
  })

  it('should persist 50 document chunks with one bulk createMany call instead of per-chunk inserts', async () => {
    const service = new DocumentService()
    const chunks = Array.from({ length: 50 }, (_, index) => ({
      text: `chunk-${index}`,
      startIndex: index * 10,
      endIndex: index * 10 + 9,
    }))

    mockCreateChunks.mockReturnValue(chunks)
    mockDb.document.create.mockResolvedValue({
      id: 'doc-1',
      title: 'AQI report',
      content: 'content',
      source: 'EPA Punjab',
      sourceUrl: null,
      category: 'Air Quality',
      reportSeries: 'Annual Report',
      year: 2026,
      audience: 'General Public',
      author: 'EPA Punjab',
      tags: JSON.stringify(['air']),
      isActive: true,
      language: 'en',
      fileType: 'txt',
      fileSize: 1024,
      summary: null,
      ownerId: 'admin-user',
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    })
    mockDb.documentChunk.createMany.mockResolvedValue({ count: 50 })

    await service.createDocument({
      ownerId: 'admin-user',
      title: 'AQI report',
      content: 'content',
      source: 'EPA Punjab',
      fileType: 'txt',
      fileSize: 1024,
      category: 'Air Quality',
      reportSeries: 'Annual Report',
      year: 2026,
      audience: 'General Public',
      author: 'EPA Punjab',
      tags: ['air'],
    })

    expect(mockDb.documentChunk.createMany).toHaveBeenCalledTimes(1)
    expect(mockDb.documentChunk.createMany.mock.calls[0][0].data).toHaveLength(50)
    expect(mockDb.documentChunk.create).not.toHaveBeenCalled()
  })

  it('should resolve 50 source chunks with one document lookup instead of per-chunk queries', async () => {
    const service = new RAGService()
    const chunks = Array.from({ length: 50 }, (_, index) => ({
      id: `chunk-${index}`,
      documentId: `doc-${index}`,
      content: `Excerpt ${index}`,
    }))
    const scores = Array.from({ length: 50 }, (_, index) => 1 - (index / 100))

    mockDb.document.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => ({
        id: `doc-${index}`,
        title: `Document ${index}`,
        category: 'Air Quality',
      }))
    )

    const sources = await (service as any).formatSources(chunks, scores)

    expect(mockDb.document.findMany).toHaveBeenCalledTimes(1)
    expect(mockDb.document.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-0', 'doc-1', 'doc-2', 'doc-3', 'doc-4'] } },
      select: { id: true, title: true, category: true },
    })
    expect(sources).toHaveLength(5)
  })

  it('should compute feedback stats with bounded aggregate queries instead of scanning the whole table', async () => {
    mockDb.feedback.count.mockResolvedValue(50)
    mockDb.feedback.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
    })
    mockDb.feedback.groupBy.mockResolvedValue([
      { rating: 5, _count: { rating: 20 } },
      { rating: 4, _count: { rating: 15 } },
      { rating: 3, _count: { rating: 10 } },
      { rating: 2, _count: { rating: 3 } },
      { rating: 1, _count: { rating: 2 } },
    ])
    mockDb.feedback.findMany.mockResolvedValue([
      {
        id: 'feedback-1',
        rating: 5,
        comment: 'Helpful',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      },
    ])

    const response = await getStats(adminRequest('http://localhost/api/stats?type=feedback'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockDb.feedback.count).toHaveBeenCalledTimes(1)
    expect(mockDb.feedback.aggregate).toHaveBeenCalledTimes(1)
    expect(mockDb.feedback.groupBy).toHaveBeenCalledTimes(1)
    expect(mockDb.feedback.findMany).toHaveBeenCalledTimes(1)
    expect(mockDb.feedback.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    expect(payload.statistics.total).toBe(50)
    expect(payload.statistics.positiveRate).toBe(70)
  })

  it('should build document statistics with count and groupBy queries instead of loading every row', async () => {
    const service = new DocumentService()

    mockDb.document.count.mockResolvedValue(50)
    mockDb.document.groupBy
      .mockResolvedValueOnce([
        { category: 'Air Quality', _count: { category: 30 } },
        { category: 'Water Resources', _count: { category: 20 } },
      ])
      .mockResolvedValueOnce([
        { year: 2025, _count: { year: 20 } },
        { year: 2026, _count: { year: 30 } },
      ])

    const result = await service.getStatistics()

    expect(mockDb.document.count).toHaveBeenCalledTimes(1)
    expect(mockDb.document.groupBy).toHaveBeenCalledTimes(2)
    expect(mockDb.document.findMany).not.toHaveBeenCalled()
    expect(result.total).toBe(50)
    expect(result.byCategory['Air Quality']).toBe(30)
  })
})
