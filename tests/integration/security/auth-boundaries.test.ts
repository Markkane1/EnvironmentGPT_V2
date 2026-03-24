import jwt from 'jsonwebtoken'
import { GET as getUsers } from '@/app/api/users/route'
import { GET as getDocuments } from '@/app/api/documents/route'
import { GET as getFeedback } from '@/app/api/feedback/route'
import { documentService } from '@/lib/services/document-service'
import { db } from '@/lib/db'
import { createAuthHeaders } from '../../helpers/auth'

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getDocument: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    feedback: {
      findFirst: jest.fn(),
    },
  },
}))

const mockDocumentService = documentService as {
  getDocument: jest.Mock
}
const mockDb = db as {
  feedback: {
    findFirst: jest.Mock
  }
}

process.env.JWT_SECRET = 'integration-secret'

function requestWithHeaders(url: string, headers?: HeadersInit, method = 'GET'): Request {
  return new Request(url, {
    method,
    headers,
  })
}

function invalidTokenHeaders(): HeadersInit {
  return {
    Authorization: 'Bearer definitely-not-a-valid-jwt',
  }
}

function wrongSecretHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${jwt.sign({ userId: 'viewer-user', role: 'viewer' }, 'wrong-secret', {
      algorithm: 'HS256',
      expiresIn: '15m',
    })}`,
  }
}

function expiredHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${jwt.sign({ userId: 'viewer-user', role: 'viewer' }, process.env.JWT_SECRET!, {
      algorithm: 'HS256',
      expiresIn: -1,
    })}`,
  }
}

describe('security: authentication and authorization boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects missing and malformed tokens on protected routes', async () => {
    const missingResponse = await getDocuments(requestWithHeaders('http://localhost/api/documents') as never)
    const missingPayload = await missingResponse.json()
    const malformedResponse = await getDocuments(requestWithHeaders('http://localhost/api/documents', invalidTokenHeaders()) as never)
    const malformedPayload = await malformedResponse.json()

    expect(missingResponse.status).toBe(401)
    expect(missingPayload.error).toBe('Authentication token required')
    expect(malformedResponse.status).toBe(401)
    expect(malformedPayload.error).toBe('Invalid or expired token')
  })

  it('rejects tokens signed with the wrong secret and expired tokens', async () => {
    const wrongSecretResponse = await getUsers(requestWithHeaders('http://localhost/api/users', wrongSecretHeaders()) as never)
    const wrongSecretPayload = await wrongSecretResponse.json()
    const expiredResponse = await getUsers(requestWithHeaders('http://localhost/api/users', expiredHeaders()) as never)
    const expiredPayload = await expiredResponse.json()

    expect(wrongSecretResponse.status).toBe(401)
    expect(wrongSecretPayload.error).toBe('Invalid or expired token')
    expect(expiredResponse.status).toBe(401)
    expect(expiredPayload.error).toBe('Invalid or expired token')
  })

  it('rejects regular users on admin-only routes', async () => {
    const response = await getUsers(requestWithHeaders('http://localhost/api/users', createAuthHeaders('viewer', 'viewer-user')) as never)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Admin access required')
  })

  it('blocks viewers from reading documents owned by another user', async () => {
    mockDocumentService.getDocument.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'other-user',
      title: 'Restricted document',
      content: 'AQI report '.repeat(20),
    } as never)

    const response = await getDocuments(requestWithHeaders('http://localhost/api/documents?id=doc-1', createAuthHeaders('viewer', 'viewer-user')) as never)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('You do not have access to this document')
  })

  it('blocks viewers from reading feedback attached to another users session', async () => {
    mockDb.feedback.findFirst.mockResolvedValue({
      id: 'feedback-1',
      messageId: 'message-1',
      userId: 'other-user',
      rating: 5,
      comment: 'Helpful',
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      message: {
        session: {
          userId: 'other-user',
        },
      },
    } as never)

    const response = await getFeedback(requestWithHeaders('http://localhost/api/feedback?messageId=message-1', createAuthHeaders('viewer', 'viewer-user')) as never)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('You do not have access to this feedback')
  })
})
