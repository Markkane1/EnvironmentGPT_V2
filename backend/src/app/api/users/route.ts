// =====================================================
// EPA Punjab EnvironmentGPT - User Management
// Phase 5: User Management API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// User schema for validation
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'analyst', 'viewer', 'guest']).default('viewer'),
  department: z.string().optional()
})

const updateUserSchema = createUserSchema.partial()

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2025'
}

// Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    
    const where: Record<string, unknown> = {}
    if (role) {
      where.role = role
    }
    
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            chatSessions: true,
            feedback: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        isActive: u.isActive,
        sessionsCount: u._count.chatSessions,
        feedbackCount: u._count.feedback,
        createdAt: u.createdAt
      }))
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve users' },
      { status: 500 }
    )
  }
}

// Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createUserSchema.parse(body)
    
    // Check if user exists
    const existing = await db.user.findUnique({
      where: { email: validated.email }
    })
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }
    
    const user = await db.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        role: validated.role,
        department: validated.department
      }
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// Update user
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const validated = updateUserSchema.parse(body)
    
    const user = await db.user.update({
      where: { id: userId },
      data: validated
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      }
    })
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.error('Update user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// Deactivate user (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }
    
    // Soft delete by setting isActive to false
    await db.user.update({
      where: { id: userId },
      data: { isActive: false }
    })
    
    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully'
    })
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.error('Delete user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate user' },
      { status: 500 }
    )
  }
}
