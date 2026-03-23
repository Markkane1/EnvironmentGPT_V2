// =====================================================
// EPA Punjab EnvironmentGPT - Cache Management API
// Phase 4: Response Cache Statistics & Management
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { responseCacheService } from '@/lib/services/response-cache'
import { z } from 'zod'

const cacheActionSchema = z.object({
  action: z.enum(['clear', 'invalidate', 'invalidate_old', 'cleanup', 'toggle']),
  params: z.object({
    pattern: z.object({
      query: z.string().optional(),
      audience: z.string().optional(),
      category: z.string().optional(),
    }).partial().optional(),
    maxAgeMs: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  }).partial().optional(),
})

// Get cache statistics
export async function GET(request: NextRequest) {
  try {
    const stats = responseCacheService.getStats()
    const popularQueries = responseCacheService.getPopularQueries(10)
    
    return NextResponse.json({
      success: true,
      stats: {
        totalEntries: stats.totalEntries,
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        hitRate: Math.round(stats.hitRate * 100) / 100,
        memoryUsageBytes: stats.memoryUsage,
        memoryUsageMB: Math.round(stats.memoryUsage / (1024 * 1024) * 100) / 100
      },
      popularQueries,
      config: {
        enabled: responseCacheService.isEnabled()
      }
    })
    
  } catch (error) {
    console.error('Cache stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get cache statistics' },
      { status: 500 }
    )
  }
}

// Manage cache
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = cacheActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid cache action' },
        { status: 400 }
      )
    }

    const { action, params } = parsed.data
    
    switch (action) {
      case 'clear':
        responseCacheService.clear()
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        })
        
      case 'invalidate':
        if (!params?.pattern || Object.values(params.pattern).every(value => value === undefined)) {
          return NextResponse.json(
            { success: false, error: 'Pattern required for invalidation' },
            { status: 400 }
          )
        }
        const count = responseCacheService.invalidatePattern(params.pattern)
        return NextResponse.json({
          success: true,
          invalidated: count
        })
        
      case 'invalidate_old':
        const maxAge = params?.maxAgeMs ?? 1000 * 60 * 60 // Default 1 hour
        const oldCount = responseCacheService.invalidateOlderThan(maxAge)
        return NextResponse.json({
          success: true,
          invalidated: oldCount
        })
        
      case 'cleanup':
        const cleanedCount = responseCacheService.cleanup()
        return NextResponse.json({
          success: true,
          cleaned: cleanedCount
        })
        
      case 'toggle':
        const enabled = params?.enabled ?? !responseCacheService.isEnabled()
        responseCacheService.setEnabled(enabled)
        return NextResponse.json({
          success: true,
          enabled: responseCacheService.isEnabled()
        })
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Cache management error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to manage cache' },
      { status: 500 }
    )
  }
}
