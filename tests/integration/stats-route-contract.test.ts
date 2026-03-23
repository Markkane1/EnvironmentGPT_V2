import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
    document: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    chatSession: {
      count: jest.fn(),
    },
    chatMessage: {
      count: jest.fn(),
    },
    feedback: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    lLMRequestLog: {
      aggregate: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getStatistics: jest.fn(),
  },
}))

jest.mock('@/lib/services/advanced-embedding-service', () => ({
  advancedEmbeddingService: {
    getDimension: jest.fn().mockReturnValue(384),
  },
}))

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    isEnabled: jest.fn().mockReturnValue(true),
    set: jest.fn(),
    get: jest.fn().mockReturnValue({ success: true }),
    delete: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getStats: jest.fn().mockResolvedValue({
      totalProviders: 1,
      activeProviders: 1,
      healthyProviders: 1,
      primaryProvider: 'primary',
      totalRequests: 0,
      totalErrors: 0,
    }),
  },
}))

import { db } from '@/lib/db'
import { documentService } from '@/lib/services/document-service'
import { GET } from '@/app/api/stats/route'
import { createAuthHeaders } from '../helpers/auth'

function adminRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: createAuthHeaders('admin', 'admin-user'),
  })
}

describe('/api/stats contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns recent documents with year metadata for the admin dashboard', async () => {
    ;(documentService.getStatistics as jest.Mock).mockResolvedValue({
      total: 2,
      byCategory: { 'Air Quality': 2 },
      byYear: { 2024: 2 },
    })
    ;(db.document.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Punjab Air Quality Report',
        category: 'Air Quality',
        year: 2024,
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
      },
    ])

    const response = await GET(adminRequest('http://localhost/api/stats?type=documents'))
    const body = await response.json()

    expect(body.statistics.recentlyAdded).toEqual([
      {
        id: 'doc-1',
        title: 'Punjab Air Quality Report',
        category: 'Air Quality',
        year: 2024,
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ])
  })

  it('returns average response time for chat analytics', async () => {
    ;(db.chatSession.count as jest.Mock).mockResolvedValue(3)
    ;(db.chatMessage.count as jest.Mock).mockResolvedValue(12)
    ;(db.lLMRequestLog.aggregate as jest.Mock).mockResolvedValue({
      _avg: { latencyMs: 187.6 },
    })

    const response = await GET(adminRequest('http://localhost/api/stats?type=chat'))
    const body = await response.json()

    expect(body.statistics).toMatchObject({
      sessionsToday: 3,
      totalQueries: 12,
      avgResponseTime: 188,
    })
  })

  it('returns recent feedback entries alongside aggregate feedback stats', async () => {
    ;(db.feedback.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'feedback-1', rating: 5, comment: 'Helpful', createdAt: new Date('2026-03-22T00:00:00.000Z') },
        { id: 'feedback-2', rating: 2, comment: null, createdAt: new Date('2026-03-21T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([
        { id: 'feedback-1', rating: 5, comment: 'Helpful', createdAt: new Date('2026-03-22T00:00:00.000Z') },
      ])

    const response = await GET(adminRequest('http://localhost/api/stats?type=feedback'))
    const body = await response.json()

    expect(body.statistics.recentFeedback).toEqual([
      {
        id: 'feedback-1',
        rating: 5,
        comment: 'Helpful',
        createdAt: '2026-03-22T00:00:00.000Z',
      },
    ])
    expect(body.statistics.positiveRate).toBe(50)
  })

  it('returns sanitized health status without internal failure details', async () => {
    ;(db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'))

    const response = await GET(adminRequest('http://localhost/api/stats?type=health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.health.status).toBe('degraded')
    expect(body.health.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'database',
        status: 'error',
      }),
    ]))
    expect(body.health.environment).toBeUndefined()
    expect(body.health.services[0].message).toBeUndefined()
  })
})
