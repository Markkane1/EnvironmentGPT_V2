import { NextResponse } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  extractCookieValue,
  getAuthCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE,
} from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const backendResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const payload = await backendResponse.json()
    const refreshToken = extractCookieValue(
      backendResponse.headers,
      REFRESH_TOKEN_COOKIE_NAME
    )

    if (!backendResponse.ok || !payload?.token) {
      return NextResponse.json(
        payload ?? { success: false, error: 'Authentication failed' },
        { status: backendResponse.status || 500 }
      )
    }

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication service did not issue a refresh token' },
        { status: 502 }
      )
    }

    const response = NextResponse.json({
      success: true,
      user: payload.user,
    })

    response.cookies.set({
      name: ACCESS_TOKEN_COOKIE_NAME,
      value: payload.token,
      ...getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE),
    })

    response.cookies.set({
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: refreshToken,
      ...getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE),
    })

    return response
  } catch (error) {
    console.error('Frontend auth login proxy failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reach authentication service' },
      { status: 502 }
    )
  }
}
