import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'

describe('admin API key auth helper', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAdminApiKey = process.env.ADMIN_API_KEY
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalAdminApiKey === undefined) {
      delete process.env.ADMIN_API_KEY
    } else {
      process.env.ADMIN_API_KEY = originalAdminApiKey
    }

    consoleErrorSpy.mockClear()
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should bypass API key checks entirely when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.ADMIN_API_KEY

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics'))

    expect(response).toBeNull()
  })

  it('should return 503 when the admin API key is not configured outside test mode', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ADMIN_API_KEY

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics'))

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toEqual({
      success: false,
      error: 'Admin API is not configured on this server.',
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should return 401 when no API key header is provided', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'super-secret-key'

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics'))

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({
      success: false,
      error: 'Authentication required.',
    })
  })

  it('should return 403 when the bearer token does not match the configured key', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'super-secret-key'

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics', {
      headers: {
        authorization: 'Bearer wrong-key',
      },
    }))

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      success: false,
      error: 'Invalid API key.',
    })
  })

  it('should accept a matching bearer token with surrounding whitespace trimmed', () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'super-secret-key'

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics', {
      headers: {
        authorization: 'Bearer super-secret-key   ',
      },
    }))

    expect(response).toBeNull()
  })

  it('should accept a matching x-api-key header when no bearer token is provided', () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'super-secret-key'

    const response = requireAdmin(new NextRequest('http://localhost/api/metrics', {
      headers: {
        'x-api-key': ' super-secret-key ',
      },
    }))

    expect(response).toBeNull()
  })
})
