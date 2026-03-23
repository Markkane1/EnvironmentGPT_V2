import { NextRequest, NextResponse } from 'next/server'
import type { HealthSnapshot } from '@/lib/monitoring/health'
import { getHealthSnapshot } from '@/lib/monitoring/health'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

function buildMetricsBody(health: Pick<HealthSnapshot, 'status' | 'services' | 'uptime'>): string {
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
  ]

  return lines.join('\n') + '\n'
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  try {
    const health = await getHealthSnapshot()

    return new NextResponse(buildMetricsBody(health), {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse(buildMetricsBody({
      status: 'unhealthy',
      services: [],
      uptime: 0,
    }), {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}
