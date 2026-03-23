// =====================================================
// EPA Punjab EnvironmentGPT - Query Processing API
// Phase 4: Advanced Query Analysis Endpoint
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { queryProcessorService } from '@/lib/services/query-processor'
import { z } from 'zod'

const analyzeQuerySchema = z.object({
  query: z.string().min(3).max(1000)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = analyzeQuerySchema.parse(body)
    
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
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to analyze query' },
      { status: 500 }
    )
  }
}

// Get suggested questions based on category
export async function GET(request: NextRequest) {
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
