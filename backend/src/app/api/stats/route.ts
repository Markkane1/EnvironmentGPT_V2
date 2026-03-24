// =====================================================
// EPA Punjab EnvironmentGPT - Statistics API Route
// Phase 1: System Statistics & Health
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getHealthSnapshot } from '@/lib/monitoring/health'
import { buildStatsHealthPayload } from '@/lib/monitoring/health-response'
import { documentService } from '@/lib/services/document-service'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { APP_CONFIG, SYSTEM_LIMITS, DEFAULT_FEATURE_FLAGS } from '@/lib/constants'

// Get system statistics
export async function GET(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'

    switch (type) {
      case 'overview':
        return await getOverviewStats()
      case 'documents':
        return await getDocumentStats()
      case 'chat':
        return await getChatStats()
      case 'feedback':
        return await getFeedbackStats()
      case 'health':
        return await getHealthStatus()
      case 'config':
        return getConfig()
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid stats type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve statistics' },
      { status: 500 }
    )
  }
}

async function getOverviewStats() {
  const [documentCount, sessionCount, messageCount, feedbackCount] = await Promise.all([
    db.document.count({ where: { isActive: true } }),
    db.chatSession.count(),
    db.chatMessage.count(),
    db.feedback.count(),
  ])

  return NextResponse.json({
    success: true,
    statistics: {
      documents: documentCount,
      sessions: sessionCount,
      messages: messageCount,
      feedback: feedbackCount,
    },
    timestamp: new Date(),
  })
}

async function getDocumentStats() {
  const [stats, recentlyAdded] = await Promise.all([
    documentService.getStatistics(),
    db.document.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        year: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    statistics: {
      ...stats,
      recentlyAdded: recentlyAdded.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category || 'Uncategorized',
        year: doc.year,
        createdAt: doc.createdAt.toISOString(),
      })),
    },
    timestamp: new Date(),
  })
}

async function getChatStats() {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [sessionsToday, sessionsWeek, totalMessages, latencyStats] = await Promise.all([
    db.chatSession.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
    db.chatSession.count({
      where: { createdAt: { gte: oneWeekAgo } },
    }),
    db.chatMessage.count({ where: { role: 'user' } }),
    db.lLMRequestLog.aggregate({
      where: {
        latencyMs: { not: null },
        createdAt: { gte: oneWeekAgo },
      },
      _avg: { latencyMs: true },
    }),
  ])

  return NextResponse.json({
    success: true,
    statistics: {
      sessionsToday,
      sessionsWeek,
      totalQueries: totalMessages,
      avgResponseTime: Math.round(latencyStats._avg.latencyMs || 0),
    },
    timestamp: new Date(),
  })
}

async function getFeedbackStats() {
  const [feedbackCount, feedbackAverage, feedbackDistribution, recentFeedback] = await Promise.all([
    db.feedback.count(),
    db.feedback.aggregate({
      _avg: {
        rating: true,
      },
    }),
    db.feedback.groupBy({
      by: ['rating'],
      _count: {
        rating: true,
      },
    }),
    db.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const avgRating = feedbackAverage._avg.rating || 0

  const ratingDistribution: Record<number, number> = {}
  for (let i = 1; i <= 5; i++) {
    ratingDistribution[i] = 0
  }

  for (const group of feedbackDistribution) {
    ratingDistribution[group.rating] = group._count.rating
  }

  const positiveFeedbackCount = (ratingDistribution[4] || 0) + (ratingDistribution[5] || 0)

  return NextResponse.json({
    success: true,
    statistics: {
      total: feedbackCount,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDistribution,
      positiveRate: feedbackCount > 0
        ? Math.round((positiveFeedbackCount / feedbackCount) * 100)
        : 0,
      recentFeedback: recentFeedback.map((feedback) => ({
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment || '',
        createdAt: feedback.createdAt.toISOString(),
      })),
    },
    timestamp: new Date(),
  })
}

async function getHealthStatus() {
  const snapshot = await getHealthSnapshot()

  return NextResponse.json({
    success: true,
    health: buildStatsHealthPayload(snapshot),
  })
}

function getConfig() {
  return NextResponse.json({
    success: true,
    config: {
      app: APP_CONFIG,
      limits: SYSTEM_LIMITS,
      features: DEFAULT_FEATURE_FLAGS,
    },
    timestamp: new Date(),
  })
}
