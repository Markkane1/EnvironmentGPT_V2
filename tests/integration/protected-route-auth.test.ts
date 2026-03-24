import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { signAuthToken } from '@/middleware/auth'
import { clearRateLimitStore } from '@/lib/security/rate-limiter'
import { GET as getAdminHealthFull } from '@/app/api/admin/health/full/route'
import {
  GET as getAdminPipeline,
  POST as postAdminPipeline,
} from '@/app/api/admin/pipeline/route'
import {
  GET as getAdminConnectors,
  POST as postAdminConnectors,
  PUT as putAdminConnectors,
  DELETE as deleteAdminConnectors,
} from '@/app/api/admin/connectors/route'
import {
  GET as getAdminProviders,
  POST as postAdminProviders,
  PUT as putAdminProviders,
  DELETE as deleteAdminProviders,
} from '@/app/api/admin/providers/route'
import {
  GET as getSystemProviders,
  POST as postSystemProviders,
} from '@/app/api/admin/system/providers/route'
import {
  PUT as putSystemProvider,
  DELETE as deleteSystemProvider,
} from '@/app/api/admin/system/providers/[id]/route'
import { POST as postSystemProviderTest } from '@/app/api/admin/system/providers/[id]/test/route'
import { GET as getCache, POST as postCache } from '@/app/api/cache/route'
import {
  POST as postChat,
  GET as getChat,
  DELETE as deleteChat,
} from '@/app/api/chat/route'
import {
  GET as getDocuments,
  POST as postDocuments,
  PATCH as patchDocuments,
  DELETE as deleteDocuments,
} from '@/app/api/documents/route'
import { GET as getExport } from '@/app/api/export/route'
import { POST as postFeedback, GET as getFeedback } from '@/app/api/feedback/route'
import {
  POST as postIngest,
  GET as getIngest,
  PUT as putIngest,
  DELETE as deleteIngest,
} from '@/app/api/ingest/route'
import { GET as getMetrics } from '@/app/api/metrics/route'
import { POST as postQuery, GET as getQuery } from '@/app/api/query/route'
import {
  GET as getSessions,
  POST as postSessions,
  DELETE as deleteSessions,
} from '@/app/api/sessions/route'
import { GET as getStats } from '@/app/api/stats/route'
import { POST as postUpload, GET as getUpload } from '@/app/api/upload/route'
import {
  GET as getUsers,
  POST as postUsers,
  PATCH as patchUsers,
  DELETE as deleteUsers,
} from '@/app/api/users/route'

process.env.JWT_SECRET = 'integration-secret'

type ProtectedRouteCase = {
  name: string
  invoke: (headers?: HeadersInit) => Promise<Response>
}

type AdminRouteCase = ProtectedRouteCase

function makeRequest(
  url: string,
  init: RequestInit = {}
): NextRequest {
  return new NextRequest(url, init)
}

function makeJsonRequest(
  url: string,
  method: string,
  body: unknown,
  headers?: HeadersInit
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function makeMultipartRequest(
  url: string,
  method: string,
  headers?: HeadersInit
): NextRequest {
  const formData = new FormData()
  return new NextRequest(url, {
    method,
    headers,
    body: formData,
  })
}

function validHeaders(role: 'admin' | 'viewer' = 'viewer'): HeadersInit {
  return {
    Authorization: `Bearer ${signAuthToken({ userId: `${role}-user`, role })}`,
  }
}

function invalidHeaders(): HeadersInit {
  return {
    Authorization: 'Bearer definitely-not-a-valid-jwt',
  }
}

function expiredHeaders(role: 'admin' | 'viewer' = 'viewer'): HeadersInit {
  return {
    Authorization: `Bearer ${jwt.sign(
      { userId: `${role}-user`, role },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: -1 }
    )}`,
  }
}

const protectedRoutes: ProtectedRouteCase[] = [
  {
    name: 'GET /api/admin/health/full',
    invoke: (headers) => getAdminHealthFull(makeRequest('http://localhost/api/admin/health/full', { headers })),
  },
  {
    name: 'GET /api/admin/pipeline',
    invoke: (headers) => getAdminPipeline(makeRequest('http://localhost/api/admin/pipeline', { headers })),
  },
  {
    name: 'POST /api/admin/pipeline',
    invoke: (headers) => postAdminPipeline(makeJsonRequest('http://localhost/api/admin/pipeline', 'POST', { query: 'Ping' }, headers)),
  },
  {
    name: 'GET /api/admin/connectors',
    invoke: (headers) => getAdminConnectors(makeRequest('http://localhost/api/admin/connectors', { headers })),
  },
  {
    name: 'POST /api/admin/connectors',
    invoke: (headers) => postAdminConnectors(makeJsonRequest('http://localhost/api/admin/connectors', 'POST', { name: 'AQI' }, headers)),
  },
  {
    name: 'PUT /api/admin/connectors',
    invoke: (headers) => putAdminConnectors(makeJsonRequest('http://localhost/api/admin/connectors', 'PUT', { id: 'connector-1' }, headers)),
  },
  {
    name: 'DELETE /api/admin/connectors',
    invoke: (headers) => deleteAdminConnectors(makeRequest('http://localhost/api/admin/connectors?id=connector-1', { method: 'DELETE', headers })),
  },
  {
    name: 'GET /api/admin/providers',
    invoke: (headers) => getAdminProviders(makeRequest('http://localhost/api/admin/providers', { headers })),
  },
  {
    name: 'POST /api/admin/providers',
    invoke: (headers) => postAdminProviders(makeJsonRequest('http://localhost/api/admin/providers', 'POST', { name: 'OpenAI' }, headers)),
  },
  {
    name: 'PUT /api/admin/providers',
    invoke: (headers) => putAdminProviders(makeJsonRequest('http://localhost/api/admin/providers', 'PUT', { id: 'provider-1' }, headers)),
  },
  {
    name: 'DELETE /api/admin/providers',
    invoke: (headers) => deleteAdminProviders(makeRequest('http://localhost/api/admin/providers?id=provider-1', { method: 'DELETE', headers })),
  },
  {
    name: 'GET /api/admin/system/providers',
    invoke: (headers) => getSystemProviders(makeRequest('http://localhost/api/admin/system/providers', { headers })),
  },
  {
    name: 'POST /api/admin/system/providers',
    invoke: (headers) => postSystemProviders(makeJsonRequest('http://localhost/api/admin/system/providers', 'POST', { name: 'OpenAI' }, headers)),
  },
  {
    name: 'PUT /api/admin/system/providers/[id]',
    invoke: (headers) => putSystemProvider(
      makeJsonRequest('http://localhost/api/admin/system/providers/provider-1', 'PUT', {}, headers),
      { params: Promise.resolve({ id: 'provider-1' }) }
    ),
  },
  {
    name: 'DELETE /api/admin/system/providers/[id]',
    invoke: (headers) => deleteSystemProvider(
      makeRequest('http://localhost/api/admin/system/providers/provider-1', { method: 'DELETE', headers }),
      { params: Promise.resolve({ id: 'provider-1' }) }
    ),
  },
  {
    name: 'POST /api/admin/system/providers/[id]/test',
    invoke: (headers) => postSystemProviderTest(
      makeJsonRequest('http://localhost/api/admin/system/providers/provider-1/test', 'POST', {}, headers),
      { params: Promise.resolve({ id: 'provider-1' }) }
    ),
  },
  {
    name: 'GET /api/cache',
    invoke: (headers) => getCache(makeRequest('http://localhost/api/cache', { headers })),
  },
  {
    name: 'POST /api/cache',
    invoke: (headers) => postCache(makeJsonRequest('http://localhost/api/cache', 'POST', { action: 'clear' }, headers)),
  },
  {
    name: 'GET /api/chat',
    invoke: (headers) => getChat(makeRequest('http://localhost/api/chat', { headers })),
  },
  {
    name: 'DELETE /api/chat',
    invoke: (headers) => deleteChat(makeRequest('http://localhost/api/chat?id=session-1', { method: 'DELETE', headers })),
  },
  {
    name: 'GET /api/documents',
    invoke: (headers) => getDocuments(makeRequest('http://localhost/api/documents', { headers })),
  },
  {
    name: 'POST /api/documents',
    invoke: (headers) => postDocuments(makeJsonRequest('http://localhost/api/documents', 'POST', { title: 'Doc' }, headers)),
  },
  {
    name: 'PATCH /api/documents',
    invoke: (headers) => patchDocuments(makeRequest('http://localhost/api/documents?id=doc-1', { method: 'PATCH', headers })),
  },
  {
    name: 'DELETE /api/documents',
    invoke: (headers) => deleteDocuments(makeRequest('http://localhost/api/documents?id=doc-1', { method: 'DELETE', headers })),
  },
  {
    name: 'GET /api/export',
    invoke: (headers) => getExport(makeRequest('http://localhost/api/export?type=documents&format=json', { headers })),
  },
  {
    name: 'POST /api/feedback',
    invoke: (headers) => postFeedback(makeJsonRequest('http://localhost/api/feedback', 'POST', { messageId: 'msg-1', rating: 5 }, headers)),
  },
  {
    name: 'GET /api/feedback',
    invoke: (headers) => getFeedback(makeRequest('http://localhost/api/feedback', { headers })),
  },
  {
    name: 'POST /api/ingest',
    invoke: (headers) => postIngest(makeJsonRequest('http://localhost/api/ingest', 'POST', { title: 'Doc' }, headers)),
  },
  {
    name: 'GET /api/ingest',
    invoke: (headers) => getIngest(makeRequest('http://localhost/api/ingest', { headers })),
  },
  {
    name: 'PUT /api/ingest',
    invoke: (headers) => putIngest(makeJsonRequest('http://localhost/api/ingest', 'PUT', { documentId: 'doc-1' }, headers)),
  },
  {
    name: 'DELETE /api/ingest',
    invoke: (headers) => deleteIngest(makeRequest('http://localhost/api/ingest?id=doc-1', { method: 'DELETE', headers })),
  },
  {
    name: 'POST /api/query',
    invoke: (headers) => postQuery(makeJsonRequest('http://localhost/api/query', 'POST', { query: 'What is AQI?' }, headers)),
  },
  {
    name: 'GET /api/query',
    invoke: (headers) => getQuery(makeRequest('http://localhost/api/query', { headers })),
  },
  {
    name: 'GET /api/sessions',
    invoke: (headers) => getSessions(makeRequest('http://localhost/api/sessions', { headers })),
  },
  {
    name: 'POST /api/sessions',
    invoke: (headers) => postSessions(makeJsonRequest('http://localhost/api/sessions', 'POST', { title: 'Session' }, headers)),
  },
  {
    name: 'DELETE /api/sessions',
    invoke: (headers) => deleteSessions(makeRequest('http://localhost/api/sessions?id=session-1', { method: 'DELETE', headers })),
  },
  {
    name: 'GET /api/stats',
    invoke: (headers) => getStats(makeRequest('http://localhost/api/stats', { headers })),
  },
  {
    name: 'POST /api/upload',
    invoke: (headers) => postUpload(makeMultipartRequest('http://localhost/api/upload', 'POST', headers)),
  },
  {
    name: 'GET /api/upload',
    invoke: (headers) => getUpload(makeRequest('http://localhost/api/upload?documentId=doc-1', { headers })),
  },
  {
    name: 'GET /api/users',
    invoke: (headers) => getUsers(makeRequest('http://localhost/api/users', { headers })),
  },
  {
    name: 'POST /api/users',
    invoke: (headers) => postUsers(makeJsonRequest('http://localhost/api/users', 'POST', { email: 'user@example.com' }, headers)),
  },
  {
    name: 'PATCH /api/users',
    invoke: (headers) => patchUsers(makeJsonRequest('http://localhost/api/users?id=user-1', 'PATCH', { name: 'Updated' }, headers)),
  },
  {
    name: 'DELETE /api/users',
    invoke: (headers) => deleteUsers(makeRequest('http://localhost/api/users?id=user-1', { method: 'DELETE', headers })),
  },
]

const adminOnlyRoutes: AdminRouteCase[] = protectedRoutes.filter((route) =>
  route.name.startsWith('GET /api/admin/')
  || route.name.startsWith('POST /api/admin/')
  || route.name.startsWith('PUT /api/admin/')
  || route.name.startsWith('DELETE /api/admin/')
  || route.name.startsWith('GET /api/cache')
  || route.name.startsWith('POST /api/cache')
  || route.name.startsWith('POST /api/documents')
  || route.name.startsWith('GET /api/stats')
  || route.name.startsWith('GET /api/users')
  || route.name.startsWith('POST /api/users')
  || route.name.startsWith('PATCH /api/users')
  || route.name.startsWith('DELETE /api/users')
)

describe('protected route auth matrix', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAdminApiKey = process.env.ADMIN_API_KEY

  beforeEach(() => {
    clearRateLimitStore()
    process.env.JWT_SECRET = 'integration-secret'
    process.env.NODE_ENV = 'test'
    delete process.env.ADMIN_API_KEY
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalAdminApiKey === undefined) {
      delete process.env.ADMIN_API_KEY
    } else {
      process.env.ADMIN_API_KEY = originalAdminApiKey
    }
  })

  it.each(protectedRoutes)(
    'returns 401 when no token is provided for $name',
    async ({ invoke }) => {
      const response = await invoke()
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error).toBe('Authentication token required')
    }
  )

  it.each(protectedRoutes)(
    'returns 401 when an invalid token is provided for $name',
    async ({ invoke }) => {
      const response = await invoke(invalidHeaders())
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error).toBe('Invalid or expired token')
    }
  )

  it.each(protectedRoutes)(
    'returns 401 when an expired token is provided for $name',
    async ({ invoke }) => {
      const response = await invoke(expiredHeaders())
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error).toBe('Invalid or expired token')
    }
  )

  it.each(adminOnlyRoutes)(
    'returns 403 when a valid non-admin user calls $name',
    async ({ invoke }) => {
      const response = await invoke(validHeaders('viewer'))
      const payload = await response.json()

      expect(response.status).toBe(403)
      expect(payload.error).toBe('Admin access required')
    }
  )

  it('returns 401 when /api/chat receives an invalid optional auth header', async () => {
    const response = await postChat(makeJsonRequest(
      'http://localhost/api/chat',
      'POST',
      { message: 'Hello from Lahore', stream: false },
      invalidHeaders()
    ))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Invalid or expired token')
  })

  it('returns 401 when /api/metrics is called without an API key outside test bypass', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'metrics-secret'

    const response = await getMetrics(makeRequest('http://localhost/api/metrics'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      success: false,
      error: 'Authentication required.',
    })
  })

  it('returns 403 when /api/metrics is called with an invalid API key outside test bypass', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ADMIN_API_KEY = 'metrics-secret'

    const response = await getMetrics(makeRequest('http://localhost/api/metrics', {
      headers: {
        Authorization: 'Bearer wrong-secret',
      },
    }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      success: false,
      error: 'Invalid API key.',
    })
  })
})
