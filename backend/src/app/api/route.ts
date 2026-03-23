import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/constants'

export async function GET() {
  return NextResponse.json({
    success: true,
    service: APP_CONFIG.name,
    version: APP_CONFIG.version,
    status: 'ok',
  })
}
