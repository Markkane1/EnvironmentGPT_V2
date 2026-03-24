import { NextRequest, NextResponse } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  clearAuthCookieOptions,
  getBackendUrl,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value

    if (refreshToken) {
      try {
        await fetch(`${getBackendUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            cookie: `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}`,
          },
          cache: 'no-store',
        })
      } catch (error) {
        console.error('Frontend auth logout proxy failed:', error)
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())
    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())

    return response
  } catch (error) {
    console.error('Frontend auth logout route failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log out' },
      { status: 500 }
    )
  }
}
