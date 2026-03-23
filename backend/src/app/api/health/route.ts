import { NextResponse } from 'next/server'
import { getHealthSnapshot } from '@/lib/monitoring/health'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const snapshot = await getHealthSnapshot()

    return NextResponse.json(snapshot, {
      status: snapshot.status === 'unhealthy' ? 503 : 200,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: 0,
    }, {
      status: 503,
    })
  }
}
