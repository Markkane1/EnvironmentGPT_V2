import { NextRequest, NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/constants'
import { getHealthSnapshot } from '@/lib/monitoring/health'
import { buildAdminHealthPayload } from '@/lib/monitoring/health-response'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'

export const runtime = 'nodejs'

async function handleGet(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const snapshot = await getHealthSnapshot()

    return NextResponse.json({
      success: true,
      health: buildAdminHealthPayload(snapshot),
    }, {
      status: snapshot.status === 'healthy' ? 200 : 503,
    })
  } catch {
    return NextResponse.json({
      success: false,
      health: {
        status: 'degraded',
        version: APP_CONFIG.version,
        timestamp: new Date().toISOString(),
        service: 'EnvironmentGPT',
        environment: process.env.NODE_ENV || 'development',
      },
    }, {
      status: 503,
    })
  }
}

export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
