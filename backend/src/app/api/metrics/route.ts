import { NextResponse } from 'next/server'
import { getHealthSnapshot } from '@/lib/monitoring/health'
import { responseCacheService } from '@/lib/services/response-cache'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'

export const runtime = 'nodejs'

export async function GET() {
  const [health, cacheStats, providerStats] = await Promise.all([
    getHealthSnapshot(),
    Promise.resolve(responseCacheService.getStats()),
    llmProviderRegistry.getStats(),
  ])

  const lines = [
    '# HELP environmentgpt_health_status Overall application health (1 healthy, 0 otherwise)',
    '# TYPE environmentgpt_health_status gauge',
    `environmentgpt_health_status ${health.status === 'healthy' ? 1 : 0}`,
    '# HELP environmentgpt_service_status Service health by dependency (1 up, 0.5 degraded, 0 down)',
    '# TYPE environmentgpt_service_status gauge',
    ...health.services.map((service) => {
      const value = service.status === 'up' ? 1 : service.status === 'degraded' ? 0.5 : 0
      return `environmentgpt_service_status{service="${service.name.toLowerCase().replace(/\s+/g, '_')}"} ${value}`
    }),
    '# HELP environmentgpt_uptime_seconds Process uptime in seconds',
    '# TYPE environmentgpt_uptime_seconds gauge',
    `environmentgpt_uptime_seconds ${health.uptime}`,
    '# HELP environmentgpt_cache_entries_total Current cache entry count',
    '# TYPE environmentgpt_cache_entries_total gauge',
    `environmentgpt_cache_entries_total ${cacheStats.totalEntries}`,
    '# HELP environmentgpt_cache_hit_rate Cache hit rate from 0 to 1',
    '# TYPE environmentgpt_cache_hit_rate gauge',
    `environmentgpt_cache_hit_rate ${cacheStats.hitRate}`,
    '# HELP environmentgpt_llm_providers_active Active configured LLM providers',
    '# TYPE environmentgpt_llm_providers_active gauge',
    `environmentgpt_llm_providers_active ${providerStats.activeProviders}`,
    '# HELP environmentgpt_llm_providers_healthy Healthy configured LLM providers',
    '# TYPE environmentgpt_llm_providers_healthy gauge',
    `environmentgpt_llm_providers_healthy ${providerStats.healthyProviders}`,
  ]

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
