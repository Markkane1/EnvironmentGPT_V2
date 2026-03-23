import type { HealthSnapshot, ServiceHealthStatus } from '@/lib/monitoring/health'

export type PublicHealthStatus = 'ok' | 'degraded'
export type PublicServiceStatus = 'ok' | 'degraded' | 'error'

function mapHealthStatus(status: HealthSnapshot['status']): PublicHealthStatus {
  return status === 'healthy' ? 'ok' : 'degraded'
}

function mapServiceStatus(status: ServiceHealthStatus['status']): PublicServiceStatus {
  if (status === 'up') {
    return 'ok'
  }

  if (status === 'degraded') {
    return 'degraded'
  }

  return 'error'
}

function sanitizeServices(services: HealthSnapshot['services']) {
  return services.map((service) => ({
    name: service.name.toLowerCase(),
    status: mapServiceStatus(service.status),
    ...(typeof service.latency === 'number' ? { latency: service.latency } : {}),
  }))
}

function sanitizeChecks(checks: HealthSnapshot['checks']) {
  return Object.fromEntries(
    Object.entries(checks).map(([name, status]) => [name, mapServiceStatus(status)])
  ) as Record<string, PublicServiceStatus>
}

export function buildPublicHealthPayload(snapshot: Pick<HealthSnapshot, 'status' | 'timestamp' | 'version'>) {
  return {
    status: mapHealthStatus(snapshot.status),
    version: snapshot.version,
    timestamp: snapshot.timestamp,
  }
}

export function buildStatsHealthPayload(snapshot: HealthSnapshot) {
  return {
    status: mapHealthStatus(snapshot.status),
    timestamp: snapshot.timestamp,
    services: sanitizeServices(snapshot.services),
    checks: sanitizeChecks(snapshot.checks),
  }
}

export function buildAdminHealthPayload(snapshot: HealthSnapshot) {
  return {
    status: mapHealthStatus(snapshot.status),
    version: snapshot.version,
    timestamp: snapshot.timestamp,
    service: snapshot.service,
    environment: snapshot.environment,
    uptime: snapshot.uptime,
    responseTime: snapshot.responseTime,
    services: sanitizeServices(snapshot.services),
    checks: sanitizeChecks(snapshot.checks),
  }
}
