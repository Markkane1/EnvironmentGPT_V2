import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import type { UserRole } from '@/types'
import {
  ACCESS_TOKEN_EXPIRES_IN,
  generateRefreshToken,
  getRefreshTokenCookieOptions,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  signAuthToken,
} from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { createValidationErrorResponse } from '@/lib/validators'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(255, 'Username must be 255 characters or fewer'),
  password: z.string().min(1, 'Password is required').max(128, 'Password must be 128 characters or fewer'),
}).strict()

export const runtime = 'nodejs'

async function handlePost(request: NextRequest) {
  // Intentionally public: this endpoint establishes the authenticated session.
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const validated = parsed.data

    const user = await db.user.findUnique({
      where: { username: validated.username },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    })

    if (!user || !user.isActive || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const passwordMatches = await bcrypt.compare(validated.password, user.passwordHash)

    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const token = signAuthToken({
      userId: user.id,
      role: user.role as UserRole,
    })
    const refreshToken = generateRefreshToken()
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt()

    await db.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
    })

    const response = NextResponse.json({
      success: true,
      token,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      getRefreshTokenCookieOptions(refreshTokenExpiresAt)
    )

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate user' },
      { status: 500 }
    )
  }
}


export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'auth')
