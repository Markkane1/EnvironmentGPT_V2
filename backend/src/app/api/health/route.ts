import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/constants'
import { getHealthSnapshot } from '@/lib/monitoring/health'
import { buildPublicHealthPayload } from '@/lib/monitoring/health-response'

export const runtime = 'nodejs'

export async function GET() {
  // Intentionally public: load balancers and uptime monitors must reach health checks without auth.
  try {
    const snapshot = await getHealthSnapshot()
    const payload = buildPublicHealthPayload(snapshot)

    return NextResponse.json(payload, {
      status: payload.status === 'ok' ? 200 : 503,
    })
  } catch {
    return NextResponse.json({
      status: 'degraded',
      version: APP_CONFIG.version,
      timestamp: new Date().toISOString(),
    }, {
      status: 503,
    })
  }
}
