import { getConfiguredBackendUrl } from '@/lib/runtime-config'

export interface AuthTokenPayload {
  userId: string
  role: string
  exp?: number
  iat?: number
}

interface AuthTokenHeader {
  alg?: string
  typ?: string
}

export const ACCESS_TOKEN_COOKIE_NAME = 'token'
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'
export const ACCESS_TOKEN_MAX_AGE = 15 * 60
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function parsePayload(segment: string): AuthTokenPayload | null {
  try {
    return JSON.parse(textDecoder.decode(decodeBase64Url(segment))) as AuthTokenPayload
  } catch {
    return null
  }
}

function parseHeader(segment: string): AuthTokenHeader | null {
  try {
    return JSON.parse(textDecoder.decode(decodeBase64Url(segment))) as AuthTokenHeader
  } catch {
    return null
  }
}

async function verifyHs256Signature(
  headerSegment: string,
  payloadSegment: string,
  signatureSegment: string,
  secret: string
): Promise<boolean> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  return crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    decodeBase64Url(signatureSegment) as BufferSource,
    textEncoder.encode(`${headerSegment}.${payloadSegment}`)
  )
}

export async function verifyToken(token?: string | null): Promise<AuthTokenPayload | null> {
  if (!token) {
    return null
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is not configured for frontend auth checks')
    return null
  }

  const [headerSegment, payloadSegment, signatureSegment] = token.split('.')

  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return null
  }

  const header = parseHeader(headerSegment)
  const payload = parsePayload(payloadSegment)

  if (
    !header ||
    header.alg !== 'HS256' ||
    (header.typ && header.typ !== 'JWT') ||
    !payload?.userId ||
    !payload.role ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp)
  ) {
    return null
  }

  const signatureValid = await verifyHs256Signature(
    headerSegment,
    payloadSegment,
    signatureSegment,
    secret
  )

  if (!signatureValid) {
    return null
  }

  const expiresAt = payload.exp ? payload.exp * 1000 : null
  if (expiresAt && expiresAt <= Date.now()) {
    return null
  }

  return payload
}

export async function getAdminSession(token?: string | null): Promise<AuthTokenPayload | null> {
  const payload = await verifyToken(token)

  if (!payload || payload.role !== 'admin') {
    return null
  }

  return payload
}

export function getAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export function clearAuthCookieOptions() {
  return {
    ...getAuthCookieOptions(0),
    maxAge: 0,
  }
}

export function getBackendUrl(): string {
  return getConfiguredBackendUrl(process.env)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readSetCookieHeader(source: Headers | string[] | string | null): string | null {
  if (!source) {
    return null
  }

  if (typeof source === 'string') {
    return source
  }

  if (Array.isArray(source)) {
    return source.join(', ')
  }

  if (typeof source.getSetCookie === 'function') {
    const values = source.getSetCookie()
    if (values.length > 0) {
      return values.join(', ')
    }
  }

  return source.get('set-cookie')
}

export function extractCookieValue(
  source: Headers | string[] | string | null,
  cookieName: string
): string | null {
  const setCookieHeader = readSetCookieHeader(source)

  if (!setCookieHeader) {
    return null
  }

  const match = setCookieHeader.match(new RegExp(`${escapeRegex(cookieName)}=([^;]+)`))
  return match?.[1] ?? null
}

export async function refreshAccessToken(refreshToken?: string | null): Promise<{
  token: string
  session: AuthTokenPayload
  refreshToken?: string | null
} | null> {
  if (!refreshToken) {
    return null
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=${refreshToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()

    if (!payload?.token) {
      return null
    }

    const session = await verifyToken(payload.token)

    if (!session) {
      return null
    }

    return {
      token: payload.token,
      session,
      refreshToken: extractCookieValue(response.headers, REFRESH_TOKEN_COOKIE_NAME),
    }
  } catch {
    return null
  }
}
