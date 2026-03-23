// =====================================================
// EPA Punjab EnvironmentGPT - Feedback API Route
// Phase 1: User Feedback Management
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedbackSchema, validateOrThrow, ValidationError } from '@/lib/validators'

// Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedInput = validateOrThrow(feedbackSchema, body)
    
    // Check if message exists
    const message = await db.chatMessage.findUnique({
      where: { id: validatedInput.messageId }
    })
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }
    
    // Create feedback
    const feedback = await db.feedback.create({
      data: {
        messageId: validatedInput.messageId,
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
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    
    if (messageId) {
      // Get feedback for specific message
      const feedback = await db.feedback.findFirst({
        where: { messageId },
        orderBy: { createdAt: 'desc' }
      })

      if (!feedback) {
        return NextResponse.json(
          { success: false, error: 'Feedback not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        feedback,
        timestamp: new Date()
      })
    }
    
    // Get overall feedback statistics
    const allFeedback = await db.feedback.findMany()
    
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
