import { POST as postDocuments } from '@/app/api/documents/route'
import { POST as postFeedback } from '@/app/api/feedback/route'
import { POST as postUsers, PATCH as patchUsers } from '@/app/api/users/route'
import { documentService } from '@/lib/services/document-service'
import { db } from '@/lib/db'
import { createAuthHeaders } from '../../helpers/auth'

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    createDocument: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    chatMessage: {
      findUnique: jest.fn(),
    },
    feedback: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const mockDocumentService = documentService as {
  createDocument: jest.Mock
}
const mockDb = db as {
  chatMessage: {
    findUnique: jest.Mock
  }
  feedback: {
    create: jest.Mock
  }
  user: {
    findUnique: jest.Mock
    create: jest.Mock
    update: jest.Mock
  }
}

function authedRequest(
  url: string,
  method: string,
  body: unknown,
  role: 'admin' | 'viewer' = 'viewer',
  userId: string = role === 'admin' ? 'admin-user' : 'viewer-user'
): Request {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  for (const [key, value] of Object.entries(createAuthHeaders(role, userId))) {
    headers.set(key, value)
  }

  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(body),
  })
}

describe('security: input hardening and mass assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects HTML-like document content and privileged owner fields before persistence', async () => {
    const response = await postDocuments(authedRequest('http://localhost/api/documents', 'POST', {
      title: 'AQI report',
      content: '<script>alert(\'xss\')</script>' + 'A'.repeat(140),
      category: 'Air Quality',
      ownerId: 'attacker-user',
    }, 'admin') as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(mockDocumentService.createDocument).not.toHaveBeenCalled()
  })

  it('rejects object-injection payloads for feedback without touching message or feedback storage', async () => {
    const response = await postFeedback(authedRequest('http://localhost/api/feedback', 'POST', {
      messageId: { '$gt': '' },
      rating: 5,
      comment: { '$gt': '' },
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.chatMessage.findUnique).not.toHaveBeenCalled()
    expect(mockDb.feedback.create).not.toHaveBeenCalled()
  })

  it('rejects oversized feedback comments instead of persisting raw unbounded user input', async () => {
    const response = await postFeedback(authedRequest('http://localhost/api/feedback', 'POST', {
      messageId: 'message-1',
      rating: 4,
      comment: 'A'.repeat(10001),
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.chatMessage.findUnique).not.toHaveBeenCalled()
    expect(mockDb.feedback.create).not.toHaveBeenCalled()
  })

  it('rejects HTML-like markup and privileged fields on admin user creation', async () => {
    const response = await postUsers(authedRequest('http://localhost/api/users', 'POST', {
      email: 'viewer@example.com',
      username: 'viewer',
      password: 'TestPass123!',
      name: '<script>alert(\'xss\')</script>',
      role: 'viewer',
      department: 'Air Quality',
      passwordHash: 'attacker-controlled-hash',
      isActive: true,
      _id: 'spoofed-id',
    }, 'admin') as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.user.findUnique).not.toHaveBeenCalled()
    expect(mockDb.user.create).not.toHaveBeenCalled()
  })

  it('rejects privileged fields on user updates instead of allowing silent mass assignment', async () => {
    const response = await patchUsers(authedRequest('http://localhost/api/users?id=user-1', 'PATCH', {
      name: 'Updated User',
      passwordHash: 'attacker-controlled-hash',
      _id: 'spoofed-id',
      isActive: true,
    }, 'admin') as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(mockDb.user.update).not.toHaveBeenCalled()
  })
})
