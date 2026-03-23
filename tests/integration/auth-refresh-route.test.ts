import { NextRequest } from 'next/server'
import { POST as refreshPOST } from '@/app/api/auth/refresh/route'
import { POST as logoutPOST } from '@/app/api/auth/logout/route'
import {
  hashRefreshToken,
  REFRESH_TOKEN_COOKIE_NAME,
  verifyAuthToken,
} from '@/middleware/auth'
import { db } from '@/lib/db'

jest.mock('@/lib/db', () => ({
  db: {
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

const mockDb = db as {
  refreshToken: {
    findUnique: jest.Mock
    updateMany: jest.Mock
  }
}

function cookieRequest(url: string, token?: string) {
  const headers = new Headers()

  if (token) {
    headers.set('cookie', `${REFRESH_TOKEN_COOKIE_NAME}=${token}`)
  }

  return new NextRequest(url, {
    method: 'POST',
    headers,
  })
}

describe('/api/auth/refresh', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'integration-secret'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.JWT_SECRET
  })

  it('returns a new access token for a valid refresh token cookie', async () => {
    const refreshToken = 'refresh-token-value'

    mockDb.refreshToken.findUnique.mockResolvedValue({
      hashedToken: hashRefreshToken(refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
      },
    } as never)

    const response = await refreshPOST(cookieRequest('http://localhost/api/auth/refresh', refreshToken) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockDb.refreshToken.findUnique).toHaveBeenCalledWith({
      where: {
        hashedToken: hashRefreshToken(refreshToken),
      },
      include: expect.any(Object),
    })
    expect(payload.success).toBe(true)
    expect(payload.expiresIn).toBe('15m')
    expect(verifyAuthToken(payload.token)).toEqual({
      userId: 'user-1',
      role: 'admin',
    })
  })

  it('returns 401 and clears the cookie for missing or invalid refresh tokens', async () => {
    const response = await refreshPOST(cookieRequest('http://localhost/api/auth/refresh') as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      success: false,
      error: 'Invalid or expired refresh token',
    })
    expect(response.headers.get('set-cookie')).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})

describe('/api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('revokes the refresh token and clears the cookie', async () => {
    const refreshToken = 'refresh-token-value'
    mockDb.refreshToken.updateMany.mockResolvedValue({ count: 1 } as never)

    const response = await logoutPOST(cookieRequest('http://localhost/api/auth/logout', refreshToken) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      success: true,
      message: 'Logged out successfully',
    })
    expect(mockDb.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        hashedToken: hashRefreshToken(refreshToken),
      },
      data: {
        revoked: true,
      },
    })
    expect(response.headers.get('set-cookie')).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
