// =====================================================
// EPA Punjab EnvironmentGPT - Feedback API Route
// Phase 1: User Feedback Management
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateToken } from '@/middleware/auth'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { feedbackSchema, validateOrThrow, ValidationError } from '@/lib/validators'

function canAccessOwnedSession(ownerId: string | null | undefined, userId: string, role: string) {
  return role === 'admin' || ownerId === userId
}

// Submit feedback
export async function POST(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const body = await request.json()
    
    // Validate input
    const validatedInput = validateOrThrow(feedbackSchema, body)
    
    // Check if message exists
    const message = await db.chatMessage.findUnique({
      where: { id: validatedInput.messageId },
      include: {
        session: {
          select: {
            userId: true,
          },
        },
      },
    })
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    if (!canAccessOwnedSession(message.session.userId, user.userId, user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this message' },
        { status: 403 }
      )
    }
    
    // Create feedback
    const feedback = await db.feedback.create({
      data: {
        messageId: validatedInput.messageId,
        userId: user.userId,
        rating: validatedInput.rating,
        comment: validatedInput.comment,
      }
    })
    
    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        messageId: feedback.messageId,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt
      },
      timestamp: new Date()
    }, { status: 201 })
    
  } catch (error) {
    console.error('Feedback API error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toApiResponse(), { status: 400 })
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

// Get feedback statistics
export async function GET(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    
    if (messageId) {
      // Get feedback for specific message
      const feedback = await db.feedback.findFirst({
        where: { messageId },
        orderBy: { createdAt: 'desc' },
        include: {
          message: {
            include: {
              session: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      })

      if (!feedback) {
        return NextResponse.json(
          { success: false, error: 'Feedback not found' },
          { status: 404 }
        )
      }

      if (!canAccessOwnedSession(feedback.message.session.userId, user.userId, user.role)) {
        return NextResponse.json(
          { success: false, error: 'You do not have access to this feedback' },
          { status: 403 }
        )
      }
      
      return NextResponse.json({
        success: true,
        feedback: {
          id: feedback.id,
          messageId: feedback.messageId,
          userId: feedback.userId,
          rating: feedback.rating,
          comment: feedback.comment,
          createdAt: feedback.createdAt,
        },
        timestamp: new Date()
      })
    }
    
    // Get overall feedback statistics
    const allFeedback = await db.feedback.findMany({
      where: user.role === 'admin'
        ? undefined
        : {
            userId: user.userId,
          },
    })
    
    const avgRating = allFeedback.length > 0
      ? allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length
      : 0
    
    const ratingDistribution: Record<number, number> = {}
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = allFeedback.filter(f => f.rating === i).length
    }
    
    return NextResponse.json({
      success: true,
      statistics: {
        total: allFeedback.length,
        avgRating: Math.round(avgRating * 10) / 10,
        ratingDistribution
      },
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Feedback statistics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve feedback statistics' },
      { status: 500 }
    )
  }
}
