// =====================================================
// EPA Punjab EnvironmentGPT - Rate Limiter
// Phase 5: Security - Rate Limiting Middleware
// =====================================================

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
}

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
  blockDuration: number // Block duration in ms after limit exceeded
}

type RateLimitEnv = {
  TRUST_PROXY_HEADERS?: string
}

function readPositiveIntegerEnv(
  name: string,
  fallback: number
): number {
  const rawValue = process.env[name]
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return parsedValue
}

// Default configurations for different endpoints
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  chat: {
    windowMs: readPositiveIntegerEnv('RATE_LIMIT_CHAT_WINDOW', 60 * 1000),
    maxRequests: readPositiveIntegerEnv('RATE_LIMIT_CHAT_MAX', 20),
    blockDuration: readPositiveIntegerEnv('RATE_LIMIT_CHAT_BLOCK_DURATION', 60 * 1000)
  },
  upload: {
    windowMs: readPositiveIntegerEnv('RATE_LIMIT_UPLOAD_WINDOW', 60 * 60 * 1000),
    maxRequests: readPositiveIntegerEnv('RATE_LIMIT_UPLOAD_MAX', 10),
    blockDuration: readPositiveIntegerEnv('RATE_LIMIT_UPLOAD_BLOCK_DURATION', 30 * 60 * 1000)
  },
  api: {
    windowMs: readPositiveIntegerEnv('RATE_LIMIT_WINDOW', 60 * 1000),
    maxRequests: readPositiveIntegerEnv('RATE_LIMIT_MAX', 100),
    blockDuration: readPositiveIntegerEnv('RATE_LIMIT_BLOCK_DURATION', 60 * 1000)
  },
  admin: {
    windowMs: readPositiveIntegerEnv('RATE_LIMIT_ADMIN_WINDOW', 60 * 1000),
    maxRequests: readPositiveIntegerEnv('RATE_LIMIT_ADMIN_MAX', 30),
    blockDuration: readPositiveIntegerEnv('RATE_LIMIT_ADMIN_BLOCK_DURATION', 5 * 60 * 1000)
  },
  auth: {
    windowMs: readPositiveIntegerEnv('RATE_LIMIT_AUTH_WINDOW', 60 * 1000),
    maxRequests: readPositiveIntegerEnv('RATE_LIMIT_AUTH_MAX', 10),
    blockDuration: readPositiveIntegerEnv('RATE_LIMIT_AUTH_BLOCK_DURATION', 30 * 60 * 1000)
  }
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000) as unknown as { unref?: () => void }

if (typeof rateLimitCleanupTimer.unref === 'function') {
  rateLimitCleanupTimer.unref()
}

export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  identifier: string,
  endpoint: keyof typeof rateLimitConfigs = 'api'
): {
  limited: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
} {
  const config = rateLimitConfigs[endpoint]
  const key = `${endpoint}:${identifier}`
  const now = Date.now()
  
  let entry = rateLimitStore.get(key)
  
  // Check if blocked from previous violation
  if (entry?.blocked && entry.resetTime > now) {
    return {
      limited: true,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    }
  }
  
  // Initialize or reset window
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      blocked: false
    }
  }
  
  // Increment count
  entry.count++
  
  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    entry.blocked = true
    entry.resetTime = now + config.blockDuration
    rateLimitStore.set(key, entry)
    
    return {
      limited: true,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil(config.blockDuration / 1000)
    }
  }
  
  rateLimitStore.set(key, entry)
  
  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Get client identifier from request
 */
function trustProxyHeaders(env: RateLimitEnv = process.env as RateLimitEnv): boolean {
  return env.TRUST_PROXY_HEADERS === '1'
}

export function getClientIdentifier(request: Request, env: RateLimitEnv = process.env as RateLimitEnv): string {
  if (!trustProxyHeaders(env)) {
    return 'unknown'
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIp) {
    return realIp
  }
  
  return 'unknown'
}

/**
 * Rate limit headers to add to response
 */
export function getRateLimitHeaders(
  endpoint: keyof typeof rateLimitConfigs,
  remaining: number,
  resetTime: number
): Record<string, string> {
  const config = rateLimitConfigs[endpoint]
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000))
  }
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response | undefined>,
  endpoint: keyof typeof rateLimitConfigs = 'api'
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const clientId = getClientIdentifier(request)
    const result = checkRateLimit(clientId, endpoint)
    
    if (result.limited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter || 60),
            ...getRateLimitHeaders(endpoint, 0, result.resetTime)
          }
        }
      )
    }
    
    const response = await handler(request)

    if (!response) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request handler did not return a response.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }
    
    // Add rate limit headers to response
    const headers = getRateLimitHeaders(endpoint, result.remaining, result.resetTime)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    
    return response
  }
}

