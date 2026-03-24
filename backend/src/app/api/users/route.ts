// =====================================================
// EPA Punjab EnvironmentGPT - User Management
// Phase 5: User Management API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { createValidationErrorResponse } from '@/lib/validators'
import { z } from 'zod'

const HTML_LIKE_PATTERN = /[<>]/

function rejectHtmlLikeMarkup(value: string) {
  return !HTML_LIKE_PATTERN.test(value)
}

// User schema for validation
const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  password: z.string().min(8).max(128).optional(),
  name: z.string().trim().min(2).max(255).refine(rejectHtmlLikeMarkup, 'HTML-like markup is not allowed'),
  role: z.enum(['admin', 'analyst', 'viewer', 'guest']).default('viewer'),
  department: z.string().trim().min(1).max(255).refine(rejectHtmlLikeMarkup, 'HTML-like markup is not allowed').optional()
}).strict()

const updateUserSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  password: z.string().min(8).max(128).optional(),
  name: z.string().trim().min(2).max(255).refine(rejectHtmlLikeMarkup, 'HTML-like markup is not allowed').optional(),
  role: z.enum(['admin', 'analyst', 'viewer', 'guest']).optional(),
  department: z.string().trim().min(1).max(255).refine(rejectHtmlLikeMarkup, 'HTML-like markup is not allowed').optional()
}).strict()

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2025'
}

async function buildCreateUserData(validated: z.infer<typeof createUserSchema>) {
  const { password, ...userData } = validated

  return {
    ...userData,
    ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
  }
}

async function buildUpdateUserData(validated: z.infer<typeof updateUserSchema>) {
  const { password, ...userData } = validated

  return {
    ...userData,
    ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
  }
}

// Get all users (admin only)
async function handleGet(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

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
        username: true,
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
        username: u.username,
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
async function handlePost(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const validated = parsed.data
    
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

    if (validated.username) {
      const existingUsername = await db.user.findUnique({
        where: { username: validated.username }
      })

      if (existingUsername) {
        return NextResponse.json(
          { success: false, error: 'User with this username already exists' },
          { status: 409 }
        )
      }
    }

    const userData = await buildCreateUserData(validated)
    
    const user = await db.user.create({
      data: userData
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// Update user
async function handlePatch(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

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
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const validated = parsed.data
    const userData = await buildUpdateUserData(validated)
    
    const user = await db.user.update({
      where: { id: userId },
      data: userData
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
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
async function handleDelete(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

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


export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'admin')
export const PATCH = withRateLimit((request) => handlePatch(request as NextRequest), 'admin')
export const DELETE = withRateLimit((request) => handleDelete(request as NextRequest), 'admin')

