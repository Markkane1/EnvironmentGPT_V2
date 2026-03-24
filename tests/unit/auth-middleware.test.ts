import jwt from 'jsonwebtoken'
import httpMocks from 'node-mocks-http'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  authenticateToken,
  generateRefreshToken,
  getExpiredRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
  requireAdmin,
  signAuthToken,
  verifyAuthToken,
} from '@/middleware/auth'

describe('auth middleware helpers', () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret'
  })

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret
    jest.restoreAllMocks()
  })

  it('should sign and verify a valid access token round trip', () => {
    const token = signAuthToken({
      userId: 'user-1',
      role: 'admin',
    })

    expect(verifyAuthToken(token)).toEqual({
      userId: 'user-1',
      role: 'admin',
    })
  })

  it('should reject tokens with a string payload or an invalid role payload', () => {
    const stringPayloadToken = jwt.sign('bad-payload', process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
    })
    const invalidRoleToken = jwt.sign(
      { userId: 'user-1', role: 'superadmin' },
      process.env.JWT_SECRET as string,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
      }
    )

    expect(() => verifyAuthToken(stringPayloadToken)).toThrow('Invalid token payload')
    expect(() => verifyAuthToken(invalidRoleToken)).toThrow('Invalid token payload')
  })

  it('should throw when the JWT secret is missing', () => {
    delete process.env.JWT_SECRET

    expect(() => signAuthToken({ userId: 'user-1', role: 'admin' })).toThrow('JWT_SECRET is not configured')
  })

  it('should generate refresh tokens, hash them, and return secure cookie options', () => {
    jest.spyOn(require('crypto'), 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(48)))

    const token = generateRefreshToken()
    const expiresAt = new Date('2026-03-31T00:00:00.000Z')

    expect(token).toBeTruthy()
    expect(hashRefreshToken(token)).toHaveLength(64)
    expect(getRefreshTokenCookieOptions(expiresAt)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    })
    expect(getExpiredRefreshTokenCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })

    const ttlSeconds = Math.round(
      (getRefreshTokenCookieOptions().expires.getTime() - Date.now()) / 1000
    )
    expect(ttlSeconds).toBeLessThanOrEqual(REFRESH_TOKEN_TTL_SECONDS)
    expect(ttlSeconds).toBeGreaterThan(REFRESH_TOKEN_TTL_SECONDS - 5)
  })

  it('should authenticate requests from bearer tokens and cookie fallbacks', () => {
    const next = jest.fn()
    const bearerToken = signAuthToken({ userId: 'user-1', role: 'viewer' })
    const cookieToken = signAuthToken({ userId: 'user-2', role: 'admin' })

    const bearerRequest = httpMocks.createRequest({
      headers: {
        authorization: `Bearer ${bearerToken}`,
      },
    })
    const bearerResponse = httpMocks.createResponse()

    authenticateToken(bearerRequest as never, bearerResponse as never, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect((bearerRequest as any).user).toEqual({
      userId: 'user-1',
      role: 'viewer',
    })

    next.mockClear()

    const cookieRequest = httpMocks.createRequest({
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${cookieToken}; theme=dark`,
      },
    })
    const cookieResponse = httpMocks.createResponse()

    authenticateToken(cookieRequest as never, cookieResponse as never, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect((cookieRequest as any).user).toEqual({
      userId: 'user-2',
      role: 'admin',
    })
  })

  it('should return 401 when the token is missing or invalid', () => {
    const next = jest.fn()
    const missingRequest = httpMocks.createRequest()
    const missingResponse = httpMocks.createResponse()

    authenticateToken(missingRequest as never, missingResponse as never, next)

    expect(missingResponse.statusCode).toBe(401)
    expect(missingResponse._getJSONData()).toEqual({
      error: 'Authentication token required',
    })

    const invalidRequest = httpMocks.createRequest({
      headers: {
        authorization: 'Bearer invalid-token',
      },
    })
    const invalidResponse = httpMocks.createResponse()

    authenticateToken(invalidRequest as never, invalidResponse as never, next)

    expect(invalidResponse.statusCode).toBe(401)
    expect(invalidResponse._getJSONData()).toEqual({
      error: 'Invalid or expired token',
    })
  })

  it('should enforce admin-only access for non-admin users', () => {
    const next = jest.fn()
    const adminRequest = httpMocks.createRequest({
      user: { userId: 'admin-1', role: 'admin' },
    })
    const adminResponse = httpMocks.createResponse()

    requireAdmin(adminRequest as never, adminResponse as never, next)
    expect(next).toHaveBeenCalledTimes(1)

    const viewerRequest = httpMocks.createRequest({
      user: { userId: 'viewer-1', role: 'viewer' },
    })
    const viewerResponse = httpMocks.createResponse()

    requireAdmin(viewerRequest as never, viewerResponse as never, next)
    expect(viewerResponse.statusCode).toBe(403)
    expect(viewerResponse._getJSONData()).toEqual({
      error: 'Admin access required',
    })
  })
})
