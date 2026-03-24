import { NextResponse, type NextRequest } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  clearAuthCookieOptions,
  getAdminSession,
  getAuthCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE,
  refreshAccessToken,
  verifyToken,
} from '@/lib/auth'

export function withAuth() {
  return async function proxy(request: NextRequest) {
    const isLocalTestHost = ['127.0.0.1', 'localhost'].includes(request.nextUrl.hostname)

    if (
      process.env.PLAYWRIGHT_TEST === '1'
      && process.env.NODE_ENV !== 'production'
      && isLocalTestHost
    ) {
      return NextResponse.next()
    }

    const token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value
    const session = await getAdminSession(token)

    if (session) {
      return NextResponse.next()
    }

    const verification = await verifyToken(token)

    if (verification) {
      return NextResponse.redirect(new URL('/403', request.url))
    }

    const refreshed = await refreshAccessToken(refreshToken)

    if (refreshed) {
      const response = refreshed.session.role === 'admin'
        ? NextResponse.next()
        : NextResponse.redirect(new URL('/403', request.url))

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

    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())
    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, '', clearAuthCookieOptions())
    return response
  }
}

export const proxy = withAuth()

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
