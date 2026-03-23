jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
  },
}))

jest.mock('@/lib/services/advanced-embedding-service', () => ({
  advancedEmbeddingService: {
    getDimension: jest.fn(),
  },
}))

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    isEnabled: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getStats: jest.fn(),
  },
}))

import { NextRequest } from 'next/server'
import { APP_CONFIG } from '@/lib/constants'
import { db } from '@/lib/db'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { responseCacheService } from '@/lib/services/response-cache'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { GET as healthGET } from '@/app/api/health/route'
import { GET as metricsGET } from '@/app/api/metrics/route'
import { GET as adminHealthFullGET } from '@/app/api/admin/health/full/route'
import { createAuthHeaders } from '../helpers/auth'

describe('health and metrics routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(db.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
    ;(advancedEmbeddingService.getDimension as jest.Mock).mockReturnValue(384)
    ;(responseCacheService.isEnabled as jest.Mock).mockReturnValue(true)
    ;(responseCacheService.get as jest.Mock).mockReturnValue({ success: true })
    ;(responseCacheService.getStats as jest.Mock).mockReturnValue({
      totalEntries: 3,
      totalHits: 5,
      totalMisses: 2,
      hitRate: 0.71,
      oldestEntry: 0,
      newestEntry: 0,
      memoryUsage: 100,
    })
    ;(llmProviderRegistry.getStats as jest.Mock).mockResolvedValue({
      totalProviders: 1,
      activeProviders: 1,
      healthyProviders: 1,
      primaryProvider: 'primary',
      totalRequests: 10,
      totalErrors: 0,
    })
  })

  it('returns a minimal degraded public health payload', async () => {
    ;(responseCacheService.isEnabled as jest.Mock).mockReturnValue(false)
    ;(llmProviderRegistry.getStats as jest.Mock).mockResolvedValue({
      totalProviders: 0,
      activeProviders: 0,
      healthyProviders: 0,
      primaryProvider: null,
      totalRequests: 0,
      totalErrors: 0,
    })

    const response = await healthGET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      status: 'degraded',
      version: APP_CONFIG.version,
      timestamp: expect.any(String),
    })
  })

  it('exposes sanitized prometheus-style metrics without cache or provider internals', async () => {
    const response = await metricsGET(new NextRequest('http://localhost/api/metrics'))
    const text = await response.text()

    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(text).toContain('environmentgpt_health_status 1')
    expect(text).toContain('environmentgpt_service_status{service="database"} 1')
    expect(text).toContain('environmentgpt_uptime_seconds')
    expect(text).not.toContain('environmentgpt_cache_entries_total')
    expect(text).not.toContain('environmentgpt_cache_hit_rate')
    expect(text).not.toContain('environmentgpt_llm_providers_active')
    expect(text).not.toContain('environmentgpt_llm_providers_healthy')
  })

  it('returns full sanitized health diagnostics for admin callers', async () => {
    const response = await adminHealthFullGET(new NextRequest('http://localhost/api/admin/health/full', {
      headers: createAuthHeaders('admin', 'admin-user'),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.health).toMatchObject({
      status: 'ok',
      version: APP_CONFIG.version,
      environment: expect.any(String),
      service: expect.any(String),
    })
    expect(body.health.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'database',
        status: 'ok',
      }),
    ]))
    expect(body.health.services[0].message).toBeUndefined()
  })
})
