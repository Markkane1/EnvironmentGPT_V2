import type { NextFunction, Request, Response } from 'express'
import crypto from 'crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import type { UserRole } from '@/types'

export const ACCESS_TOKEN_EXPIRES_IN = '15m'
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
export const ACCESS_TOKEN_COOKIE_NAME = 'token'
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'

export interface AuthenticatedUser {
  userId: string
  role: UserRole
}

interface VerifiedTokenPayload extends JwtPayload {
  userId?: string
  role?: string
  exp?: number
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return secret
}

function isUserRole(role: string): role is UserRole {
  return ['admin', 'analyst', 'viewer', 'guest'].includes(role)
}

function normalizeVerifiedPayload(decoded: string | JwtPayload): AuthenticatedUser {
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload')
  }

  const payload = decoded as VerifiedTokenPayload

  if (
    !payload.userId
    || !payload.role
    || !isUserRole(payload.role)
    || typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid token payload')
  }

  return {
    userId: payload.userId,
    role: payload.role,
  }
}

function getBearerToken(authorizationHeader?: string | string[]): string | null {
  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader

  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

function getCookieToken(
  cookieHeader?: string | string[],
  cookieName: string = ACCESS_TOKEN_COOKIE_NAME
): string | null {
  const header = Array.isArray(cookieHeader)
    ? cookieHeader[0]
    : cookieHeader

  if (!header) {
    return null
  }

  const cookies = header.split(';')

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=')
    if (rawName !== cookieName || rawValueParts.length === 0) {
      continue
    }

    return rawValueParts.join('=')
  }

  return null
}

export function signAuthToken(user: AuthenticatedUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

export function verifyAuthToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
  })
  return normalizeVerifiedPayload(decoded)
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function getRefreshTokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000)
}

export function getRefreshTokenCookieOptions(expiresAt: Date = getRefreshTokenExpiresAt()) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: 'strict' as const,
    path: '/',
    expires: expiresAt,
  }
}

export function getExpiredRefreshTokenCookieOptions() {
  return {
    ...getRefreshTokenCookieOptions(new Date(0)),
    maxAge: 0,
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req.headers.authorization)
    ?? getCookieToken(req.headers.cookie)

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' })
  }

  try {
    req.user = verifyAuthToken(token)
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  return next()
}
