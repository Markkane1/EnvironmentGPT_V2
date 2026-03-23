import { NextRequest } from 'next/server'
import { proxy } from '../../backend/proxy'
import {
  buildCorsHeaders,
  createRequestId,
  getAllowedCorsOrigins,
  isAllowedCorsOrigin,
} from '@/lib/security/request-security'

describe('request security helpers', () => {
  it('parses explicit CORS allowlists from the environment', () => {
    expect(getAllowedCorsOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com, https://admin.example.com ',
    })).toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  it('falls back to localhost origins in development only', () => {
    expect(getAllowedCorsOrigins({ NODE_ENV: 'development' })).toContain('http://localhost:3000')
    expect(getAllowedCorsOrigins({ NODE_ENV: 'production' })).toEqual([])
  })

  it('only enables credentials for allowlisted origins', () => {
    expect(buildCorsHeaders('https://app.example.com', 'Authorization', {
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      NODE_ENV: 'production',
    })).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
    })

    expect(buildCorsHeaders('https://evil.example.com', 'Authorization', {
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      NODE_ENV: 'production',
    })).toEqual({})
  })

  it('preserves existing request IDs and generates new UUIDs when absent', () => {
    expect(createRequestId('trace-123')).toBe('trace-123')
    expect(createRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('matches origins against the computed allowlist', () => {
    expect(isAllowedCorsOrigin('https://app.example.com', {
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      NODE_ENV: 'production',
    })).toBe(true)

    expect(isAllowedCorsOrigin('https://evil.example.com', {
      CORS_ALLOWED_ORIGINS: 'https://app.example.com',
      NODE_ENV: 'production',
    })).toBe(false)
  })
})

describe('backend middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV ?? 'test'
  const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalCorsAllowedOrigins === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS
    } else {
      process.env.CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins
    }
  })

  it('adds request IDs, security headers, and allowlisted CORS headers to preflight requests', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.CORS_ALLOWED_ORIGINS

    const response = proxy(new NextRequest('http://localhost/api/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    }))

    expect(response.status).toBe(204)
    expect(response.headers.get('X-Request-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('rejects disallowed preflight origins and preserves provided request IDs', () => {
    process.env.NODE_ENV = 'production'
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com'

    const response = proxy(new NextRequest('http://localhost/api/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example.com',
        'x-request-id': 'incoming-trace-id',
      },
    }))

    expect(response.status).toBe(403)
    expect(response.headers.get('X-Request-ID')).toBe('incoming-trace-id')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('sets request IDs on normal API responses and only reflects allowlisted origins', () => {
    process.env.NODE_ENV = 'production'
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com'

    const response = proxy(new NextRequest('http://localhost/api/health', {
      headers: {
        origin: 'https://app.example.com',
        'x-request-id': 'trace-abc',
      },
    }))

    expect(response.headers.get('X-Request-ID')).toBe('trace-abc')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('rejects oversized JSON API requests before they reach route handlers', () => {
    process.env.NODE_ENV = 'production'

    const response = proxy(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(2 * 1024 * 1024 + 1),
      },
    }))

    expect(response.status).toBe(413)
    expect(response.headers.get('X-Request-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('rejects oversized multipart upload requests before route parsing', () => {
    process.env.NODE_ENV = 'production'

    const response = proxy(new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test-boundary',
        'content-length': String(50 * 1024 * 1024 + 1024 * 1024 + 1),
      },
    }))

    expect(response.status).toBe(413)
    expect(response.headers.get('X-Request-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })
})
