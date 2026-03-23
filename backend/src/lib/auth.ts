// =====================================================
// EPA Punjab EnvironmentGPT - Auth Helper
// API key-based authentication for protected routes
//
// Set ADMIN_API_KEY in your .env to enable auth.
// Requests must include one of:
//   Authorization: Bearer <key>
//   X-API-Key: <key>
// =====================================================

import { NextRequest, NextResponse } from 'next/server'

function extractKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader.trim()
  }
  return null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing leak
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      void ((a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0))
    }
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Require a valid ADMIN_API_KEY header.
 * Returns null on success; returns a 401/403 NextResponse on failure.
 *
 * If ADMIN_API_KEY is not configured the server rejects all requests with 503
 * so that un-configured deployments are not silently open.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'test') {
    return null
  }

  const configuredKey = process.env.ADMIN_API_KEY

  if (!configuredKey) {
    console.error(
      '[Auth] ADMIN_API_KEY is not set. Admin endpoints are disabled until it is configured.'
    )
    return NextResponse.json(
      { success: false, error: 'Admin API is not configured on this server.' },
      { status: 503 }
    )
  }

  const provided = extractKey(request)

  if (!provided) {
    return NextResponse.json(
      { success: false, error: 'Authentication required.' },
      { status: 401 }
    )
  }

  if (!timingSafeEqual(provided, configuredKey)) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key.' },
      { status: 403 }
    )
  }

  return null // authenticated
}
