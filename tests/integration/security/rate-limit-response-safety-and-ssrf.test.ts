import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as postProviders } from '@/app/api/admin/providers/route'
import { db } from '@/lib/db'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { clearRateLimitStore } from '@/lib/security/rate-limiter'
import { createAuthHeaders } from '../../helpers/auth'

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

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    addProvider: jest.fn(),
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
const mockProviderRegistry = llmProviderRegistry as {
  addProvider: jest.Mock
}

function loginRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function adminJsonRequest(body: unknown): Request {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  for (const [key, value] of Object.entries(createAuthHeaders('admin', 'admin-user'))) {
    headers.set(key, value)
  }

  return new Request('http://localhost/api/admin/providers', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('security: rate limiting, safe failures, and SSRF protections', () => {
  const originalAllowPrivateProviderUrls = process.env.ALLOW_PRIVATE_PROVIDER_URLS

  beforeEach(() => {
    jest.clearAllMocks()
    clearRateLimitStore()
    delete process.env.ALLOW_PRIVATE_PROVIDER_URLS
  })

  afterAll(() => {
    clearRateLimitStore()

    if (originalAllowPrivateProviderUrls === undefined) {
      delete process.env.ALLOW_PRIVATE_PROVIDER_URLS
    } else {
      process.env.ALLOW_PRIVATE_PROVIDER_URLS = originalAllowPrivateProviderUrls
    }
  })

  it('returns 429 after repeated rapid login attempts from the same client', async () => {
    mockDb.user.findUnique.mockResolvedValue(null as never)

    let response: Response | undefined
    for (let attempt = 0; attempt < 12; attempt += 1) {
      response = await loginPost(loginRequest({
        username: 'admin',
        password: 'WrongPass123!',
      }) as never)
    }

    const payload = await response!.json()

    expect(response!.status).toBe(429)
    expect(payload).toEqual(expect.objectContaining({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: expect.any(Number),
    }))
  })

  it('returns a safe login error response without leaking internal database details', async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error('P1001 connect ECONNREFUSED database.internal:5432'))

    const response = await loginPost(loginRequest({
      username: 'admin',
      password: 'TestPass123!',
    }) as never)
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      success: false,
      error: 'Failed to authenticate user',
    })
    expect(serialized).not.toContain('P1001')
    expect(serialized).not.toContain('ECONNREFUSED')
    expect(serialized).not.toContain('database.internal')
  })

  it('rejects private and loopback provider base URLs by default', async () => {
    const response = await postProviders(adminJsonRequest({
      name: 'Local vLLM',
      baseUrl: 'http://localhost:11434/v1',
      modelId: 'qwen3-30b-a3b',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      success: false,
      error: 'Invalid baseUrl: URL hostname "localhost" is private or internal and is not allowed.',
    })
    expect(mockProviderRegistry.addProvider).not.toHaveBeenCalled()
  })

  it('allows explicitly opted-in local provider URLs for controlled development environments', async () => {
    process.env.ALLOW_PRIVATE_PROVIDER_URLS = '1'
    mockProviderRegistry.addProvider.mockResolvedValue({
      id: 'provider-1',
      name: 'Local vLLM',
      displayName: 'Local vLLM',
      providerType: 'openai_compat',
      baseUrl: 'http://localhost:11434/v1',
      modelId: 'qwen3-30b-a3b',
      apiKeyEnvVar: null,
      role: 'available',
      isActive: true,
      priority: 1,
      timeoutSeconds: 60,
      maxTokens: 2048,
      temperature: 0.1,
      notes: null,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      healthStatus: 'unknown',
      lastHealthCheck: null,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    } as never)

    const response = await postProviders(adminJsonRequest({
      name: 'Local vLLM',
      baseUrl: 'http://localhost:11434/v1',
      modelId: 'qwen3-30b-a3b',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(mockProviderRegistry.addProvider).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'http://localhost:11434/v1',
    }))
  })
})
