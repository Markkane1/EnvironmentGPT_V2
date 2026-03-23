import { createRequest, createResponse } from 'node-mocks-http'
import type { NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  authenticateToken,
  generateRefreshToken,
  getExpiredRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  requireAdmin,
  signAuthToken,
  verifyAuthToken,
} from '@/middleware/auth'

describe('JWT auth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret'
  })

  afterEach(() => {
    delete process.env.JWT_SECRET
  })

  it('signs and verifies auth tokens with user claims', () => {
    const token = signAuthToken({
      userId: 'user-1',
      role: 'admin',
    })

    expect(verifyAuthToken(token)).toEqual({
      userId: 'user-1',
      role: 'admin',
    })

    const decoded = jwt.decode(token) as jwt.JwtPayload
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(ACCESS_TOKEN_TTL_SECONDS)
  })

  it('generates stable refresh token hashes and strict cookie options', () => {
    const refreshToken = generateRefreshToken()
    const expiresAt = getRefreshTokenExpiresAt(new Date('2026-03-23T00:00:00.000Z'))

    expect(hashRefreshToken(refreshToken)).toBe(hashRefreshToken(refreshToken))
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
    expect(REFRESH_TOKEN_COOKIE_NAME).toBe('refreshToken')
  })

  it('returns 401 when the bearer token is missing', () => {
    const req = createRequest()
    const res = createResponse()
    const next = jest.fn() as NextFunction

    authenticateToken(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res._getJSONData()).toEqual({
      error: 'Authentication token required',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('attaches req.user when the token is valid', () => {
    const token = signAuthToken({
      userId: 'user-2',
      role: 'viewer',
    })
    const req = createRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
    const res = createResponse()
    const next = jest.fn() as NextFunction

    authenticateToken(req, res, next)

    expect(req.user).toEqual({
      userId: 'user-2',
      role: 'viewer',
    })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns 401 for expired bearer tokens', () => {
    const expiredToken = jwt.sign(
      {
        userId: 'user-expired',
        role: 'viewer',
      },
      process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: -1,
      }
    )
    const req = createRequest({
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    })
    const res = createResponse()
    const next = jest.fn() as NextFunction

    authenticateToken(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res._getJSONData()).toEqual({
      error: 'Invalid or expired token',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects alg:none tokens', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      userId: 'user-none',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60,
    })).toString('base64url')
    const forgedToken = `${header}.${payload}.`
    const req = createRequest({
      headers: {
        authorization: `Bearer ${forgedToken}`,
      },
    })
    const res = createResponse()
    const next = jest.fn() as NextFunction

    authenticateToken(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res._getJSONData()).toEqual({
      error: 'Invalid or expired token',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 for non-admin users', () => {
    const req = createRequest({
      user: {
        userId: 'user-3',
        role: 'viewer',
      },
    })
    const res = createResponse()
    const next = jest.fn() as NextFunction

    requireAdmin(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(res._getJSONData()).toEqual({
      error: 'Admin access required',
    })
    expect(next).not.toHaveBeenCalled()
  })
})
