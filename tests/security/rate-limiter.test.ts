const envSnapshot = {
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
  RATE_LIMIT_BLOCK_DURATION: process.env.RATE_LIMIT_BLOCK_DURATION,
  TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
}

process.env.RATE_LIMIT_MAX = '2'
process.env.RATE_LIMIT_WINDOW = '5000'
process.env.RATE_LIMIT_BLOCK_DURATION = '8000'
delete process.env.TRUST_PROXY_HEADERS

const {
  checkRateLimit,
  clearRateLimitStore,
  getClientIdentifier,
  getRateLimitHeaders,
  rateLimitConfigs,
  withRateLimit,
} = require('@/lib/security/rate-limiter') as typeof import('@/lib/security/rate-limiter')

describe('rate-limiter', () => {
  afterEach(() => {
    clearRateLimitStore()
    delete process.env.TRUST_PROXY_HEADERS
  })

  afterAll(() => {
    clearRateLimitStore()
    process.env.RATE_LIMIT_MAX = envSnapshot.RATE_LIMIT_MAX
    process.env.RATE_LIMIT_WINDOW = envSnapshot.RATE_LIMIT_WINDOW
    process.env.RATE_LIMIT_BLOCK_DURATION = envSnapshot.RATE_LIMIT_BLOCK_DURATION
    process.env.TRUST_PROXY_HEADERS = envSnapshot.TRUST_PROXY_HEADERS
  })

  it('reads API limits from environment variables', () => {
    expect(rateLimitConfigs.api.maxRequests).toBe(2)
    expect(rateLimitConfigs.api.windowMs).toBe(5000)
    expect(rateLimitConfigs.api.blockDuration).toBe(8000)
  })

  it('tracks requests and blocks clients after the configured limit', async () => {
    const handler = jest.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const wrapped = withRateLimit(handler, 'api')
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.5',
      },
    })

    const firstResponse = await wrapped(request)
    expect(firstResponse.status).toBe(200)
    expect(firstResponse.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(firstResponse.headers.get('X-RateLimit-Remaining')).toBe('1')
    expect(handler).toHaveBeenCalledTimes(1)

    const secondResponse = await wrapped(request)
    expect(secondResponse.status).toBe(200)
    expect(secondResponse.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(handler).toHaveBeenCalledTimes(2)

    const thirdResponse = await wrapped(request)
    expect(thirdResponse.status).toBe(429)
    expect(thirdResponse.headers.get('Retry-After')).toBe('8')
    expect(thirdResponse.headers.get('X-RateLimit-Remaining')).toBe('0')

    const payload = await thirdResponse.json()
    expect(payload.error).toContain('Too many requests')
    expect(payload.retryAfter).toBe(8)
  })

  it('ignores forwarded headers unless proxy trust is enabled', () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.5',
      },
    })

    expect(getClientIdentifier(request)).toBe('unknown')

    process.env.TRUST_PROXY_HEADERS = '1'
    expect(getClientIdentifier(request)).toBe('203.0.113.10')
  })

  it('resets request counters when the store is cleared', () => {
    const first = checkRateLimit('client-1', 'api')
    expect(first.limited).toBe(false)

    clearRateLimitStore()

    const second = checkRateLimit('client-1', 'api')
    expect(second.limited).toBe(false)
    expect(second.remaining).toBe(1)
  })

  it('returns rate limit headers for the configured endpoint', () => {
    const headers = getRateLimitHeaders('api', 1, 123456789)

    expect(headers['X-RateLimit-Limit']).toBe('2')
    expect(headers['X-RateLimit-Remaining']).toBe('1')
    expect(headers['X-RateLimit-Reset']).toBe('123457')
  })

  it('unrefs the cleanup timer so module load does not keep the event loop alive', () => {
    const unref = jest.fn()
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval').mockReturnValue({
      unref,
    } as unknown as ReturnType<typeof setInterval>)

    jest.isolateModules(() => {
      require('@/lib/security/rate-limiter')
    })

    expect(unref).toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })
})
