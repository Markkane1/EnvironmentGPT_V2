import { NextRequest, NextResponse } from 'next/server'
import { SYSTEM_LIMITS } from './src/lib/constants'
import {
  buildCorsHeaders,
  createRequestId,
  isAllowedCorsOrigin,
} from './src/lib/security/request-security'

const REQUEST_ID_HEADER = 'X-Request-ID'
const JSON_BODY_LIMIT_BYTES = 1 * 1024 * 1024
const SMALL_JSON_BODY_LIMIT_BYTES = 128 * 1024
const AUTH_JSON_BODY_LIMIT_BYTES = 16 * 1024
const MULTIPART_BODY_LIMIT_BYTES = SYSTEM_LIMITS.maxFileSize + 1024 * 1024
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
    "connect-src 'self'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
}

function isApiRequest(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function isUploadRoute(pathname: string): boolean {
  return pathname === '/api/upload' || pathname === '/api/ingest'
}

function isAuthRoute(pathname: string): boolean {
  return pathname === '/api/auth/login' || pathname === '/api/auth/refresh' || pathname === '/api/auth/logout'
}

function isSmallJsonRoute(pathname: string): boolean {
  return pathname === '/api/chat' || pathname === '/api/query' || pathname === '/api/feedback'
}

function getContentLength(request: NextRequest): number | null {
  const header = request.headers.get('content-length')

  if (!header) {
    return null
  }

  const value = Number.parseInt(header, 10)
  return Number.isFinite(value) ? value : null
}

function getRequestBodyLimit(request: NextRequest, pathname: string): number | null {
  if (!isApiRequest(pathname) || !['POST', 'PUT', 'PATCH'].includes(request.method)) {
    return null
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''

  if (contentType.includes('multipart/form-data') && isUploadRoute(pathname)) {
    return MULTIPART_BODY_LIMIT_BYTES
  }

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    if (isAuthRoute(pathname)) {
      return AUTH_JSON_BODY_LIMIT_BYTES
    }

    if (isSmallJsonRoute(pathname)) {
      return SMALL_JSON_BODY_LIMIT_BYTES
    }

    return JSON_BODY_LIMIT_BYTES
  }

  return null
}

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
}

function applyCorsHeaders(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get('origin')
  const requestedHeaders = request.headers.get('access-control-request-headers')

  response.headers.append('Vary', 'Origin')

  if (requestedHeaders) {
    response.headers.append('Vary', 'Access-Control-Request-Headers')
  }

  if (!origin) {
    return
  }

  const corsHeaders = buildCorsHeaders(origin, requestedHeaders)

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
}

function createApiErrorResponse(status: number, request: NextRequest, requestId: string, error: string) {
  const response = NextResponse.json({ success: false, error }, { status })

  response.headers.set(REQUEST_ID_HEADER, requestId)
  applySecurityHeaders(response)

  if (isApiRequest(request.nextUrl.pathname)) {
    applyCorsHeaders(response, request)
  }

  return response
}

export function proxy(request: NextRequest) {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER))
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const pathname = request.nextUrl.pathname
  const requestBodyLimit = getRequestBodyLimit(request, pathname)
  const contentLength = getContentLength(request)

  if (requestBodyLimit !== null && contentLength !== null && contentLength > requestBodyLimit) {
    const limitLabel = isUploadRoute(pathname) ? 'upload' : 'JSON'

    return createApiErrorResponse(
      413,
      request,
      requestId,
      `${limitLabel} request payload exceeds the allowed size limit.`
    )
  }

  if (isApiRequest(pathname) && request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    const status = origin && !isAllowedCorsOrigin(origin) ? 403 : 204
    const response = new NextResponse(null, { status })

    response.headers.set(REQUEST_ID_HEADER, requestId)
    applySecurityHeaders(response)
    applyCorsHeaders(response, request)

    return response
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set(REQUEST_ID_HEADER, requestId)
  applySecurityHeaders(response)

  if (isApiRequest(pathname)) {
    applyCorsHeaders(response, request)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
