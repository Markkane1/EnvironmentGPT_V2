// =====================================================
// EPA Punjab EnvironmentGPT - Sessions API Route
// Phase 1: Chat Session Management
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { chatService } from '@/lib/services/chat-service'
import { authenticateToken } from '@/middleware/auth'
import { createSessionSchema, validateOrThrow, ValidationError } from '@/lib/validators'
import { getRouteAuthContext } from '@/lib/route-middleware'

// Get sessions
export async function GET(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '10', 10)
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 50)
      : 10
    
    if (sessionId) {
      // Get single session with messages
      const session = await chatService.getSession(sessionId)
      
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        )
      }

      if (user.role !== 'admin' && session.userId !== user.userId) {
        return NextResponse.json(
          { success: false, error: 'You do not have access to this session' },
          { status: 403 }
        )
      }
      
      return NextResponse.json({
        success: true,
        session,
        timestamp: new Date()
      })
    }
    
    // Get recent sessions
    const sessions = await chatService.getRecentSessions(
      limit,
      user.role === 'admin' ? undefined : user.userId
    )
    
    return NextResponse.json({
      success: true,
      sessions,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Sessions API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve sessions' },
      { status: 500 }
    )
  }
}

// Create new session
export async function POST(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const body = await request.json()
    
    // Validate input
    const validatedInput = validateOrThrow(createSessionSchema, body)
    
    // Create session
    const session = await chatService.createOwnedSession(
      user.userId,
      validatedInput.title,
      validatedInput.documentId
    )
    
    return NextResponse.json({
      success: true,
      session,
      timestamp: new Date()
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create session error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toApiResponse(), { status: 400 })
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// Delete session
export async function DELETE(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }
    
    const session = await chatService.getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    if (user.role !== 'admin' && session.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this session' },
        { status: 403 }
      )
    }

    const deleted = await chatService.deleteSession(sessionId)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
