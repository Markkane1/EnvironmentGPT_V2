jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
  },
}))

jest.mock('@/lib/services/advanced-embedding-service', () => ({
  advancedEmbeddingService: {
    getDimension: jest.fn(() => 384),
  },
}))

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    isEnabled: jest.fn(() => true),
    set: jest.fn(),
    get: jest.fn(() => ({ success: true })),
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

import { APP_CONFIG } from '@/lib/constants'
import { db } from '@/lib/db'
import { GET as getHealth } from '@/app/api/health/route'
import { GET as getRoot } from '@/app/api/route'

describe('infra API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api', () => {
    it('returns a stable operational payload', async () => {
      const response = await getRoot()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        success: true,
        service: APP_CONFIG.name,
        version: APP_CONFIG.version,
        status: 'ok',
      })
    })
  })

  describe('GET /api/health', () => {
    it('returns a minimal ok payload when core dependencies are available', async () => {
      ;(db.$queryRaw as jest.Mock).mockResolvedValueOnce(1)

      const response = await getHealth()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload).toEqual({
        status: 'ok',
        version: APP_CONFIG.version,
        timestamp: expect.any(String),
      })
      expect(payload.service).toBeUndefined()
      expect(payload.checks).toBeUndefined()
    })

    it('returns degraded when the database check fails', async () => {
      ;(db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'))

      const response = await getHealth()
      const payload = await response.json()

      expect(response.status).toBe(503)
      expect(payload).toEqual({
        status: 'degraded',
        version: APP_CONFIG.version,
        timestamp: expect.any(String),
      })
    })
  })
})
