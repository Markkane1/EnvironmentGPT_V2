import { db } from '@/lib/db'
import { APP_CONFIG } from '@/lib/constants'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { responseCacheService } from '@/lib/services/response-cache'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'

export interface ServiceHealthStatus {
  name: string
  status: 'up' | 'down' | 'degraded'
  latency?: number
  message?: string
}

export interface HealthSnapshot {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  responseTime: number
  version: string
  service: string
  environment: string
  services: ServiceHealthStatus[]
  checks: Record<string, ServiceHealthStatus['status']>
}

export async function checkDatabase(): Promise<ServiceHealthStatus> {
  const start = Date.now()

  try {
    await db.$queryRaw`SELECT 1`
    return {
      name: 'Database',
      status: 'up',
      latency: Date.now() - start,
    }
  } catch (error) {
    return {
      name: 'Database',
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkCache(): Promise<ServiceHealthStatus> {
  const start = Date.now()

  if (!responseCacheService.isEnabled()) {
    return {
      name: 'Cache',
      status: 'degraded',
      latency: Date.now() - start,
      message: 'Response cache is disabled',
    }
  }

  const probeKey = `health-check-${Date.now()}`

  try {
    responseCacheService.set(
      probeKey,
      {
        success: true,
        response: 'health-check',
        timestamp: new Date(),
      },
      {
        query: 'health-check',
        audience: 'system',
        documentCount: 0,
      },
      1000
    )

    const cached = responseCacheService.get(probeKey)
    responseCacheService.delete(probeKey)

    if (!cached?.success) {
      throw new Error('Cache probe value could not be retrieved')
    }

    return {
      name: 'Cache',
      status: 'up',
      latency: Date.now() - start,
    }
  } catch (error) {
    return {
      name: 'Cache',
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkEmbeddingService(): Promise<ServiceHealthStatus> {
  const start = Date.now()

  try {
    const dimension = advancedEmbeddingService.getDimension()

    if (dimension <= 0) {
      return {
        name: 'Embedding Service',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'Invalid embedding dimension',
      }
    }

    return {
      name: 'Embedding Service',
      status: 'up',
      latency: Date.now() - start,
    }
  } catch (error) {
    return {
      name: 'Embedding Service',
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkLLMService(): Promise<ServiceHealthStatus> {
  const start = Date.now()

  try {
    const providerStats = await llmProviderRegistry.getStats()

    if (providerStats.activeProviders === 0) {
      return {
        name: 'LLM Service',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'No active LLM providers configured',
      }
    }

    if (providerStats.healthyProviders === 0) {
      return {
        name: 'LLM Service',
        status: 'down',
        latency: Date.now() - start,
        message: 'All configured LLM providers are unhealthy',
      }
    }

    if (providerStats.healthyProviders < providerStats.activeProviders) {
      return {
        name: 'LLM Service',
        status: 'degraded',
        latency: Date.now() - start,
        message: `${providerStats.healthyProviders}/${providerStats.activeProviders} providers healthy`,
      }
    }

    return {
      name: 'LLM Service',
      status: 'up',
      latency: Date.now() - start,
      message: `${providerStats.healthyProviders} providers healthy`,
    }
  } catch (error) {
    return {
      name: 'LLM Service',
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const startTime = Date.now()
  const services = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkEmbeddingService(),
    checkLLMService(),
  ])

  const hasDown = services.some((service) => service.status === 'down')
  const hasDegraded = services.some((service) => service.status === 'degraded')

  let status: HealthSnapshot['status']
  if (hasDown) {
    status = 'unhealthy'
  } else if (hasDegraded) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    version: APP_CONFIG.version,
    service: APP_CONFIG.name,
    environment: process.env.NODE_ENV || 'development',
    services,
    checks: {
      database: services[0].status,
      cache: services[1].status,
      embedding: services[2].status,
      llm: services[3].status,
    },
  }
}
