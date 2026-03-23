// =====================================================
// EPA Punjab EnvironmentGPT - Query Processing API
// Phase 4: Advanced Query Analysis Endpoint
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { authenticateToken } from '@/middleware/auth'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { queryProcessorService } from '@/lib/services/query-processor'
import { createValidationErrorResponse } from '@/lib/validators'
import { z } from 'zod'

const analyzeQuerySchema = z.object({
  query: z.string().trim().min(3).max(1000).refine(value => !/[<>]/.test(value), 'HTML-like markup is not allowed'),
}).strict()

export async function POST(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = analyzeQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const { query } = parsed.data
    
    // Process the query
    const processed = queryProcessorService.processQuery(query)
    
    // Get follow-up suggestions
    const suggestions = queryProcessorService.generateFollowUpQuestions(processed)
    
    // Check scope
    const scopeCheck = queryProcessorService.isWithinScope(query)
    
    return NextResponse.json({
      success: true,
      analysis: {
        original: processed.original,
        cleaned: processed.cleaned,
        expanded: processed.expanded,
        keywords: processed.keywords,
        entities: processed.entities,
        intent: processed.intent,
        category: processed.category,
        suggestedFilters: processed.suggestedFilters,
        followUpSuggestions: suggestions,
        inScope: scopeCheck.inScope,
        scopeReason: scopeCheck.reason
      }
    })
    
  } catch (error) {
    console.error('Query analysis error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to analyze query' },
      { status: 500 }
    )
  }
}

// Get suggested questions based on category
export async function GET(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    
    const suggestions = queryProcessorService.generateFollowUpQuestions({
      original: '',
      cleaned: '',
      expanded: '',
      keywords: [],
      entities: {
        locations: [],
        parameters: [],
        years: [],
        organizations: [],
        measurements: []
      },
      intent: { type: 'information', confidence: 0.8 },
      category: category || 'Air Quality',
      suggestedFilters: {}
    })
    
    return NextResponse.json({
      success: true,
      suggestions
    })
    
  } catch (error) {
    console.error('Suggestions API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}
