import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getExpiredRefreshTokenCookieOptions,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'

export const runtime = 'nodejs'

async function handlePost(request: NextRequest) {
  // Intentionally public: logout is authenticated by the httpOnly refresh-token cookie.
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value

    if (refreshToken) {
      await db.refreshToken.updateMany({
        where: {
          hashedToken: hashRefreshToken(refreshToken),
        },
        data: {
          revoked: true,
        },
      })
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      '',
      getExpiredRefreshTokenCookieOptions()
    )

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log out' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'auth')
