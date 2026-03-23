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

import { db } from '@/lib/db'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { responseCacheService } from '@/lib/services/response-cache'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { GET as healthGET } from '@/app/api/health/route'
import { GET as metricsGET } from '@/app/api/metrics/route'

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

  it('surfaces degraded cache and llm provider state in /api/health', async () => {
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

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks.cache).toBe('degraded')
    expect(body.checks.llm).toBe('degraded')
  })

  it('exposes prometheus-style metrics for health, cache, and provider counts', async () => {
    const response = await metricsGET()
    const text = await response.text()

    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(text).toContain('environmentgpt_health_status 1')
    expect(text).toContain('environmentgpt_cache_entries_total 3')
    expect(text).toContain('environmentgpt_llm_providers_active 1')
    expect(text).toContain('environmentgpt_service_status{service="database"} 1')
  })
})
