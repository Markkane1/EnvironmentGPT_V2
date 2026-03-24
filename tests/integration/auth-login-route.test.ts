process.env.JWT_SECRET = 'integration-secret'

import bcrypt from 'bcryptjs'
import { POST } from '@/app/api/auth/login/route'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE_NAME,
  verifyAuthToken,
} from '@/middleware/auth'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'

jest.setTimeout(15000)

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  },
}))

const mockDb = db as {
  user: {
    findUnique: jest.Mock
  }
  refreshToken: {
    create: jest.Mock
  }
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a signed JWT for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4)

    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      passwordHash,
    } as never)

    const response = await POST(jsonRequest('http://localhost/api/auth/login', {
      username: 'admin',
      password: 'correct-horse-battery-staple',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.expiresIn).toBe('15m')
    expect(verifyAuthToken(payload.token)).toEqual({
      userId: 'user-1',
      role: 'admin',
    })
    const decoded = jwt.decode(payload.token) as jwt.JwtPayload
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(ACCESS_TOKEN_TTL_SECONDS)
    expect(payload.user).toMatchObject({
      id: 'user-1',
      username: 'admin',
      role: 'admin',
    })
    expect(mockDb.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        hashedToken: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    })
    expect(response.headers.get('set-cookie')).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    expect(response.headers.get('set-cookie')).toContain('SameSite=strict')
  })

  it('returns 401 for invalid credentials', async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'viewer',
      isActive: true,
      passwordHash: await bcrypt.hash('valid-password', 4),
    } as never)

    const response = await POST(jsonRequest('http://localhost/api/auth/login', {
      username: 'viewer',
      password: 'wrong-password',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      success: false,
      error: 'Invalid username or password',
    })
  })

  it('returns structured validation errors for invalid request bodies', async () => {
    const response = await POST(jsonRequest('http://localhost/api/auth/login', {
      username: '',
      password: '',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toBe('Validation failed')
    expect(payload.error.details).toEqual(
      expect.arrayContaining([
        {
          path: 'username',
          message: 'Username is required',
        },
        {
          path: 'password',
          message: 'Password is required',
        },
      ])
    )
  })
})
