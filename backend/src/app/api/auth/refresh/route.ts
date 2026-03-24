import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { UserRole } from '@/types'
import {
  ACCESS_TOKEN_EXPIRES_IN,
  generateRefreshToken,
  getRefreshTokenCookieOptions,
  getRefreshTokenExpiresAt,
  getExpiredRefreshTokenCookieOptions,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  signAuthToken,
} from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'

export const runtime = 'nodejs'

function createUnauthorizedRefreshResponse() {
  const response = NextResponse.json(
    { success: false, error: 'Invalid or expired refresh token' },
    { status: 401 }
  )

  response.cookies.set(
    REFRESH_TOKEN_COOKIE_NAME,
    '',
    getExpiredRefreshTokenCookieOptions()
  )

  return response
}

async function handlePost(request: NextRequest) {
  // Intentionally public: refresh is authenticated by the httpOnly refresh-token cookie.
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value

    if (!refreshToken) {
      return createUnauthorizedRefreshResponse()
    }

    const tokenRecord = await db.refreshToken.findUnique({
      where: {
        hashedToken: hashRefreshToken(refreshToken),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    })

    if (
      !tokenRecord ||
      tokenRecord.revoked ||
      tokenRecord.expiresAt <= new Date() ||
      !tokenRecord.user ||
      !tokenRecord.user.isActive
    ) {
      return createUnauthorizedRefreshResponse()
    }

    const token = signAuthToken({
      userId: tokenRecord.user.id,
      role: tokenRecord.user.role as UserRole,
    })
    const rotatedRefreshToken = generateRefreshToken()
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt()

    await db.refreshToken.update({
      where: {
        hashedToken: hashRefreshToken(refreshToken),
      },
      data: {
        hashedToken: hashRefreshToken(rotatedRefreshToken),
        expiresAt: refreshTokenExpiresAt,
        revoked: false,
      },
    })

    const response = NextResponse.json({
      success: true,
      token,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: {
        id: tokenRecord.user.id,
        username: tokenRecord.user.username,
        email: tokenRecord.user.email,
        name: tokenRecord.user.name,
        role: tokenRecord.user.role,
      },
    })

    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      rotatedRefreshToken,
      getRefreshTokenCookieOptions(refreshTokenExpiresAt)
    )

    return response
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh access token' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'auth')

