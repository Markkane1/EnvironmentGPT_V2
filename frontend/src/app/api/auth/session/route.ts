import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  clearAuthCookieOptions,
  getAuthCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE,
  refreshAccessToken,
  verifyToken,
} from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value
  const session = await verifyToken(token)

  if (!session) {
    const refreshed = await refreshAccessToken(refreshToken)

    if (refreshed) {
      const response = NextResponse.json({
        authenticated: true,
        role: refreshed.session.role,
        userId: refreshed.session.userId,
      })

      response.cookies.set({
        name: ACCESS_TOKEN_COOKIE_NAME,
        value: refreshed.token,
        ...getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE),
      })

      if (refreshed.refreshToken) {
        response.cookies.set({
          name: REFRESH_TOKEN_COOKIE_NAME,
          value: refreshed.refreshToken,
          ...getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE),
        })
      }

      return response
    }

    const response = NextResponse.json({
      authenticated: false,
      role: null,
    })

    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())
    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())

    return response
  }

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    userId: session.userId,
  })
}
