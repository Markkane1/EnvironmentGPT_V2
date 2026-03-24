import type { HealthSnapshot } from '@/lib/monitoring/health'
import {
  buildAdminHealthPayload,
  buildPublicHealthPayload,
  buildStatsHealthPayload,
} from '@/lib/monitoring/health-response'

describe('health-response helpers', () => {
  const snapshot: HealthSnapshot = {
    status: 'healthy',
    timestamp: '2026-03-24T12:00:00.000Z',
    uptime: 321,
    responseTime: 45,
    version: '1.0.0',
    service: 'EnvironmentGPT',
    environment: 'production',
    services: [
      { name: 'Database', status: 'up', latency: 10 },
      { name: 'Cache', status: 'degraded', latency: 2 },
      { name: 'LLM Service', status: 'down' },
    ],
    checks: {
      database: 'up',
      cache: 'degraded',
      llm: 'down',
    },
  }

  it('should build the public payload with only status, version, and timestamp', () => {
    expect(buildPublicHealthPayload(snapshot)).toEqual({
      status: 'ok',
      version: '1.0.0',
      timestamp: '2026-03-24T12:00:00.000Z',
    })
  })

  it('should downgrade unhealthy or degraded snapshots to the public degraded status', () => {
    expect(buildPublicHealthPayload({ ...snapshot, status: 'degraded' })).toEqual({
      status: 'degraded',
      version: '1.0.0',
      timestamp: '2026-03-24T12:00:00.000Z',
    })

    expect(buildPublicHealthPayload({ ...snapshot, status: 'unhealthy' })).toEqual({
      status: 'degraded',
      version: '1.0.0',
      timestamp: '2026-03-24T12:00:00.000Z',
    })
  })

  it('should sanitize service and check status names for the stats payload', () => {
    expect(buildStatsHealthPayload(snapshot)).toEqual({
      status: 'ok',
      timestamp: '2026-03-24T12:00:00.000Z',
      services: [
        { name: 'database', status: 'ok', latency: 10 },
        { name: 'cache', status: 'degraded', latency: 2 },
        { name: 'llm service', status: 'error' },
      ],
      checks: {
        database: 'ok',
        cache: 'degraded',
        llm: 'error',
      },
    })
  })

  it('should include service metadata for the admin payload', () => {
    expect(buildAdminHealthPayload(snapshot)).toEqual({
      status: 'ok',
      version: '1.0.0',
      timestamp: '2026-03-24T12:00:00.000Z',
      service: 'EnvironmentGPT',
      environment: 'production',
      uptime: 321,
      responseTime: 45,
      services: [
        { name: 'database', status: 'ok', latency: 10 },
        { name: 'cache', status: 'degraded', latency: 2 },
        { name: 'llm service', status: 'error' },
      ],
      checks: {
        database: 'ok',
        cache: 'degraded',
        llm: 'error',
      },
    })
  })

  it('should preserve zero-latency service values instead of dropping them', () => {
    expect(buildAdminHealthPayload({
      ...snapshot,
      services: [{ name: 'Cache', status: 'up', latency: 0 }],
      checks: { cache: 'up' },
    })).toEqual({
      status: 'ok',
      version: '1.0.0',
      timestamp: '2026-03-24T12:00:00.000Z',
      service: 'EnvironmentGPT',
      environment: 'production',
      uptime: 321,
      responseTime: 45,
      services: [{ name: 'cache', status: 'ok', latency: 0 }],
      checks: { cache: 'ok' },
    })
  })
})
