// =====================================================
// EPA Punjab EnvironmentGPT - System Provider Test API
// Sends a lightweight test prompt to a single provider
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { createValidationErrorResponse } from '@/lib/validators'

const providerTestSchema = z.object({
  message: z.string().trim().min(1).max(500).optional(),
}).strict()

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const { id } = await context.params
    const rawBody = request.headers.get('content-length') === '0' ? {} : await request.json().catch(() => ({}))
    const parsed = providerTestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const result = await llmProviderRegistry.testProvider(id, parsed.data.message)

    return NextResponse.json(result, {
      status: result.success ? 200 : 502,
    })
  } catch (error) {
    console.error('[API] Failed to test provider:', error)
    return NextResponse.json(
      { success: false, latencyMs: 0, error: 'Failed to test provider' },
      { status: 500 }
    )
  }
}
