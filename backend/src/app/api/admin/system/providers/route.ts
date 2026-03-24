// =====================================================
// EPA Punjab EnvironmentGPT - System Providers API
// Spec-aligned provider-registry list/create endpoints
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { handlePost } from '@/app/api/admin/providers/route'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'

async function handleGet(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const providers = await llmProviderRegistry.availableProviders()
    return NextResponse.json({
      success: true,
      providers,
    })
  } catch (error) {
    console.error('[API] Failed to get system providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve providers' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'admin')
