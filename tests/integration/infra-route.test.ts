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
    it('returns healthy when core dependencies are available', async () => {
      ;(db.$queryRaw as jest.Mock).mockResolvedValueOnce(1)

      const response = await getHealth()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.status).toBe('healthy')
      expect(payload.version).toBe(APP_CONFIG.version)
      expect(payload.service).toBe(APP_CONFIG.name)
      expect(payload.checks).toEqual({
        database: 'up',
        cache: 'up',
        embedding: 'up',
        llm: 'up',
      })
    })

    it('returns unhealthy when the database check fails', async () => {
      ;(db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('database unavailable'))

      const response = await getHealth()
      const payload = await response.json()

      expect(response.status).toBe(503)
      expect(payload.status).toBe('unhealthy')
      expect(payload.checks.database).toBe('down')
      expect(payload.version).toBe(APP_CONFIG.version)
    })
  })
})
