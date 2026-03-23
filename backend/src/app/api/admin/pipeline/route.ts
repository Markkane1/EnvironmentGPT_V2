// =====================================================
// EPA Punjab EnvironmentGPT - Pipeline API
// Combined endpoint for LLM Router operations
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { llmRouter } from '@/lib/services/llm-router-service'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { z } from 'zod'

const pipelineQuerySchema = z.object({
  query: z.string().min(3),
  sessionId: z.string().optional(),
  audienceType: z.enum(['General Public', 'Technical', 'Policy Maker']).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1)
  })).optional()
})

// GET /api/admin/pipeline - Get pipeline statistics and health
async function handleGet(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'health') {
      const health = await llmRouter.healthCheck()
      return NextResponse.json({ success: true, health })
    }

    // Default: get stats
    const stats = await llmRouter.getStats()
    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('[API] Failed to get pipeline stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve pipeline statistics' },
      { status: 500 }
    )
  }
}

// POST /api/admin/pipeline - Execute query through pipeline
async function handlePost(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = pipelineQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid pipeline query' },
        { status: 400 }
      )
    }

    const result = await llmRouter.processQuery({
      query: parsed.data.query,
      sessionId: parsed.data.sessionId,
      audienceType: parsed.data.audienceType,
      category: parsed.data.category,
      location: parsed.data.location,
      conversationHistory: parsed.data.conversationHistory
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Pipeline query failed:', error)
    return NextResponse.json(
      { success: false, error: 'Pipeline query failed' },
      { status: 500 }
    )
  }
}


export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'admin')
