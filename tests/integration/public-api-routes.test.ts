import { db } from '@/lib/db'
import { chatService } from '@/lib/services/chat-service'
import { responseCacheService } from '@/lib/services/response-cache'
import { queryProcessorService } from '@/lib/services/query-processor'
import { createAuthHeaders } from '../helpers/auth'
import {
  GET as getUsers,
  PATCH as patchUsers,
  DELETE as deleteUsers,
} from '@/app/api/users/route'
import {
  GET as getSessions,
  POST as postSessions,
  DELETE as deleteSessions,
} from '@/app/api/sessions/route'
import {
  POST as postFeedback,
  GET as getFeedback,
} from '@/app/api/feedback/route'
import {
  POST as postCache,
} from '@/app/api/cache/route'
import {
  POST as postQuery,
} from '@/app/api/query/route'

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    chatMessage: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    feedback: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/chat-service', () => ({
  chatService: {
    getRecentSessions: jest.fn(),
    getSession: jest.fn(),
    createOwnedSession: jest.fn(),
    deleteSession: jest.fn(),
  },
}))

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    getStats: jest.fn(),
    getPopularQueries: jest.fn(),
    isEnabled: jest.fn(),
    clear: jest.fn(),
    invalidatePattern: jest.fn(),
    invalidateOlderThan: jest.fn(),
    cleanup: jest.fn(),
    setEnabled: jest.fn(),
  },
}))

jest.mock('@/lib/services/query-processor', () => ({
  queryProcessorService: {
    processQuery: jest.fn(),
    generateFollowUpQuestions: jest.fn(),
    isWithinScope: jest.fn(),
  },
}))

const mockDb = db as any
const mockChatService = chatService as any
const mockResponseCacheService = responseCacheService as any
const mockQueryProcessorService = queryProcessorService as any

function jsonRequest(url: string, body?: unknown, method = 'POST'): Request {
  const init: RequestInit = {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  return new Request(url, init)
}

function authenticatedRequest(
  url: string,
  init: RequestInit = {},
  role: 'admin' | 'viewer' = 'viewer'
): Request {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(createAuthHeaders(role, `${role}-user`))) {
    headers.set(key, value)
  }

  return new Request(url, {
    ...init,
    headers,
  })
}

describe('Public API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('users route', () => {
    it('maps user counts in the GET response', async () => {
      mockDb.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          department: 'Ops',
          isActive: true,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          _count: {
            chatSessions: 4,
            feedback: 2,
          },
        },
      ] as never)

      const response = await getUsers(authenticatedRequest('http://localhost/api/users', {}, 'admin'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.users).toHaveLength(1)
      expect(payload.users[0]).toMatchObject({
        id: 'user-1',
        sessionsCount: 4,
        feedbackCount: 2,
      })
    })

    it('returns 404 when patching a missing user', async () => {
      mockDb.user.update.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'P2025' }))

      const response = await patchUsers(authenticatedRequest('http://localhost/api/users?id=user-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      }, 'admin'))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('User not found')
    })

    it('returns 404 when deleting a missing user', async () => {
      mockDb.user.update.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'P2025' }))

      const response = await deleteUsers(authenticatedRequest('http://localhost/api/users?id=user-1', {
        method: 'DELETE',
      }, 'admin'))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('User not found')
    })
  })

  describe('sessions route', () => {
    it('clamps an invalid limit to the default session window', async () => {
      mockChatService.getRecentSessions.mockResolvedValue([
        { id: 'session-1', title: 'First session' },
      ] as never)

      const response = await getSessions(authenticatedRequest('http://localhost/api/sessions?limit=abc'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockChatService.getRecentSessions).toHaveBeenCalledWith(10, 'viewer-user')
      expect(payload.sessions).toHaveLength(1)
    })

    it('returns 404 when deleting a missing session', async () => {
      mockChatService.getSession.mockResolvedValue({
        id: 'session-1',
        userId: 'viewer-user',
      } as never)
      mockChatService.deleteSession.mockResolvedValue(false)

      const response = await deleteSessions(authenticatedRequest('http://localhost/api/sessions?id=session-1', {
        method: 'DELETE',
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Session not found')
    })

    it('creates a session through the chat service', async () => {
      mockChatService.createOwnedSession.mockResolvedValue({
        id: 'session-new',
        title: 'New session',
        userId: 'viewer-user',
      } as never)

      const response = await postSessions(authenticatedRequest('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New session',
          documentId: 'doc-1',
        }),
      }))
      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(mockChatService.createOwnedSession).toHaveBeenCalledWith('viewer-user', 'New session', 'doc-1')
      expect(payload.session.id).toBe('session-new')
    })

    it('returns 403 when deleting another user session', async () => {
      mockChatService.getSession.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
      } as never)

      const response = await deleteSessions(authenticatedRequest('http://localhost/api/sessions?id=session-1', {
        method: 'DELETE',
      }))
      const payload = await response.json()

      expect(response.status).toBe(403)
      expect(payload.error).toBe('You do not have access to this session')
      expect(mockChatService.deleteSession).not.toHaveBeenCalled()
    })
  })

  describe('feedback route', () => {
    it('creates feedback after validating the message exists', async () => {
      mockDb.chatMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        session: {
          userId: 'viewer-user',
        },
      } as never)
      mockDb.feedback.create.mockResolvedValue({
        id: 'feedback-1',
        messageId: 'msg-1',
        userId: 'viewer-user',
        rating: 5,
        comment: 'Helpful',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      } as never)

      const response = await postFeedback(authenticatedRequest('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-1',
          rating: 5,
          comment: 'Helpful',
        }),
      }))
      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(payload.feedback.messageId).toBe('msg-1')
      expect(mockDb.feedback.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-1',
          userId: 'viewer-user',
          rating: 5,
          comment: 'Helpful',
        },
      })
    })

    it('returns 404 when requesting feedback for a message with no feedback', async () => {
      mockDb.feedback.findFirst.mockResolvedValue(null)

      const response = await getFeedback(authenticatedRequest('http://localhost/api/feedback?messageId=msg-1', {
        method: 'GET',
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Feedback not found')
    })
  })

  describe('cache route', () => {
    it('invalidates by structured pattern', async () => {
      mockResponseCacheService.invalidatePattern.mockReturnValue(3)

      const response = await postCache(authenticatedRequest('http://localhost/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalidate',
          params: {
            pattern: {
              query: 'air quality',
            },
          },
        }),
      }, 'admin'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockResponseCacheService.invalidatePattern).toHaveBeenCalledWith({
        query: 'air quality',
      })
      expect(payload.invalidated).toBe(3)
    })

    it('rejects empty invalidation patterns', async () => {
      const response = await postCache(authenticatedRequest('http://localhost/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalidate',
          params: {
            pattern: {},
          },
        }),
      }, 'admin'))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toBe('Pattern required for invalidation')
    })
  })

  describe('query route', () => {
    it('returns a processed analysis payload', async () => {
      mockQueryProcessorService.processQuery.mockReturnValue({
        original: 'What is the air quality in Lahore?',
        cleaned: 'what is the air quality in lahore?',
        expanded: 'what is the air quality in lahore? smog air pollution',
        keywords: ['air', 'quality', 'lahore'],
        entities: {
          locations: ['Lahore'],
          parameters: [],
          years: [],
          organizations: [],
          measurements: [],
        },
        intent: {
          type: 'information',
          confidence: 0.8,
        },
        category: 'Air Quality',
        suggestedFilters: {
          category: 'Air Quality',
          location: 'Lahore',
        },
      })
      mockQueryProcessorService.generateFollowUpQuestions.mockReturnValue([
        'What are the main sources of air pollution in Lahore?',
      ])
      mockQueryProcessorService.isWithinScope.mockReturnValue({
        inScope: true,
      })

      const response = await postQuery(authenticatedRequest('http://localhost/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is the air quality in Lahore?',
        }),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.analysis).toMatchObject({
        category: 'Air Quality',
        inScope: true,
      })
      expect(mockQueryProcessorService.processQuery).toHaveBeenCalledWith(
        'What is the air quality in Lahore?'
      )
    })
  })
})
