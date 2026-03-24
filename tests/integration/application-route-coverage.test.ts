import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { clearRateLimitStore } from '@/lib/security/rate-limiter'
import { hashRefreshToken, REFRESH_TOKEN_COOKIE_NAME } from '@/middleware/auth'
import { createAuthHeaders } from '../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    chatSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    chatMessage: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    feedback: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    documentChunk: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
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

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getDocument: jest.fn(),
    listDocuments: jest.fn(),
    searchDocuments: jest.fn(),
    createDocument: jest.fn(),
    deleteDocument: jest.fn(),
  },
}))

jest.mock('@/lib/services/document-ingestion-service', () => ({
  documentIngestionService: {
    ingestDocument: jest.fn(),
  },
}))

jest.mock('@/lib/services/conversation-memory', () => ({
  conversationMemoryService: {
    addMessage: jest.fn(),
    getConversationContext: jest.fn(),
    getRecentConversations: jest.fn(),
    deleteConversation: jest.fn(),
  },
}))

jest.mock('@/lib/services/query-processor', () => ({
  queryProcessorService: {
    processQuery: jest.fn(),
    generateFollowUpQuestions: jest.fn(),
    isWithinScope: jest.fn(),
  },
}))

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    generateKey: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/services/advanced-embedding-service', () => ({
  advancedEmbeddingService: {
    retrieveRelevantChunks: jest.fn(),
  },
}))

jest.mock('@/lib/services/embedding-service', () => ({
  embeddingService: {
    generateEmbedding: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-router-service', () => ({
  llmRouter: {
    processQuery: jest.fn(),
    streamQuery: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getProviders: jest.fn(),
  },
}))

jest.mock('@/lib/utils/document-extraction', () => ({
  extractTextFromDocumentFile: jest.fn(),
}))

import { db } from '@/lib/db'
import { chatService } from '@/lib/services/chat-service'
import { documentService } from '@/lib/services/document-service'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { conversationMemoryService } from '@/lib/services/conversation-memory'
import { queryProcessorService } from '@/lib/services/query-processor'
import { responseCacheService } from '@/lib/services/response-cache'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { embeddingService } from '@/lib/services/embedding-service'
import { llmRouter } from '@/lib/services/llm-router-service'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as refreshPost } from '@/app/api/auth/refresh/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
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
import { POST as postQuery, GET as getQuery } from '@/app/api/query/route'
import {
  GET as getSessions,
  POST as postSessions,
  DELETE as deleteSessions,
} from '@/app/api/sessions/route'
import { POST as postUpload, GET as getUpload } from '@/app/api/upload/route'

const mockDb = db as any
const mockChatService = chatService as any
const mockDocumentService = documentService as any
const mockDocumentIngestionService = documentIngestionService as any
const mockConversationMemoryService = conversationMemoryService as any
const mockQueryProcessorService = queryProcessorService as any
const mockResponseCacheService = responseCacheService as any
const mockAdvancedEmbeddingService = advancedEmbeddingService as any
const mockEmbeddingService = embeddingService as any
const mockLlmRouter = llmRouter as any
const mockProviderRegistry = llmProviderRegistry as any
const mockExtractTextFromDocumentFile = extractTextFromDocumentFile as jest.Mock

process.env.JWT_SECRET = 'integration-secret'

function authedRequest(
  url: string,
  init: RequestInit = {},
  role: 'admin' | 'viewer' = 'viewer',
  userId: string = `${role}-user`
) {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(createAuthHeaders(role, userId))) {
    headers.set(key, value)
  }

  return new NextRequest(url, {
    ...init,
    headers,
  })
}

function authedJsonRequest(
  url: string,
  method: string,
  body: unknown,
  role: 'admin' | 'viewer' = 'viewer',
  userId?: string
) {
  return authedRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, role, userId)
}

function formRequest(
  url: string,
  fields: Record<string, string | File>,
  role: 'admin' | 'viewer' = 'viewer',
  userId?: string
) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }

  return authedRequest(url, {
    method: 'POST',
    body: formData,
  }, role, userId)
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

describe('application route coverage expansion', () => {
  beforeEach(() => {
    clearRateLimitStore()
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'integration-secret'
    mockQueryProcessorService.processQuery.mockReturnValue({
      original: 'What is the AQI in Lahore?',
      cleaned: 'what is the aqi in lahore?',
      expanded: 'what is the aqi in lahore?',
      keywords: ['aqi', 'lahore'],
      entities: {
        locations: ['Lahore'],
        parameters: [],
        years: [],
        organizations: [],
        measurements: [],
      },
      intent: {
        type: 'information',
        confidence: 0.9,
      },
      category: 'Air Quality',
      suggestedFilters: {
        category: 'Air Quality',
      },
    })
    mockQueryProcessorService.generateFollowUpQuestions.mockReturnValue([
      'How has the AQI changed this week?',
    ])
    mockQueryProcessorService.isWithinScope.mockReturnValue({
      inScope: true,
    })
    mockResponseCacheService.generateKey.mockReturnValue('cache-key')
    mockResponseCacheService.get.mockReturnValue(null)
    mockProviderRegistry.getProviders.mockResolvedValue([])
    mockAdvancedEmbeddingService.retrieveRelevantChunks.mockResolvedValue({
      chunks: [],
    } as never)
  })

  describe('auth routes', () => {
    it('returns a safe 500 when login lookup fails unexpectedly', async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error('database unavailable'))

      const response = await loginPost(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'Password123!',
        }),
      }) as never)
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Failed to authenticate user',
      })
    })

    it('returns 401 for revoked refresh tokens and 500 for refresh store failures', async () => {
      const refreshToken = 'refresh-token-value'
      mockDb.refreshToken.findUnique
        .mockResolvedValueOnce({
          hashedToken: hashRefreshToken(refreshToken),
          revoked: true,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 'user-1',
            username: 'admin',
            email: 'admin@example.com',
            name: 'Admin',
            role: 'admin',
            isActive: true,
          },
        } as never)
        .mockRejectedValueOnce(new Error('refresh store failed'))

      const revokedResponse = await refreshPost(cookieRequest('http://localhost/api/auth/refresh', refreshToken) as never)
      const revokedPayload = await revokedResponse.json()
      const errorResponse = await refreshPost(cookieRequest('http://localhost/api/auth/refresh', refreshToken) as never)
      const errorPayload = await errorResponse.json()

      expect(revokedResponse.status).toBe(401)
      expect(revokedPayload.error).toBe('Invalid or expired refresh token')
      expect(errorResponse.status).toBe(500)
      expect(errorPayload).toEqual({
        success: false,
        error: 'Failed to refresh access token',
      })
    })

    it('logs out safely without a cookie and returns a safe 500 on store failure', async () => {
      mockDb.refreshToken.updateMany.mockRejectedValueOnce(new Error('logout failed'))

      const successResponse = await logoutPost(cookieRequest('http://localhost/api/auth/logout') as never)
      const successPayload = await successResponse.json()
      const errorResponse = await logoutPost(cookieRequest('http://localhost/api/auth/logout', 'refresh-token') as never)
      const errorPayload = await errorResponse.json()

      expect(successResponse.status).toBe(200)
      expect(successPayload.message).toBe('Logged out successfully')
      expect(mockDb.refreshToken.updateMany).toHaveBeenCalledTimes(1)
      expect(errorResponse.status).toBe(500)
      expect(errorPayload).toEqual({
        success: false,
        error: 'Failed to log out',
      })
    })
  })

  describe('chat routes', () => {
    it('returns cached chat responses without invoking retrieval or providers', async () => {
      mockResponseCacheService.get.mockReturnValue({
        success: true,
        response: 'Cached AQI answer',
        sources: [],
        sessionId: 'session-1',
      })

      const response = await postChat(authedJsonRequest('http://localhost/api/chat', 'POST', {
        message: 'What is the AQI in Lahore?',
        stream: false,
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.response).toBe('Cached AQI answer')
      expect(payload.cached).toBe(true)
      expect(mockAdvancedEmbeddingService.retrieveRelevantChunks).not.toHaveBeenCalled()
    })

    it('returns an out-of-scope chat response when the query is outside supported domains', async () => {
      mockQueryProcessorService.isWithinScope.mockReturnValue({
        inScope: false,
        reason: 'This assistant only answers environmental questions.',
      })

      const response = await postChat(authedJsonRequest('http://localhost/api/chat', 'POST', {
        message: 'Write me a sonnet about Mars',
        stream: false,
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.response).toBe('This assistant only answers environmental questions.')
      expect(payload.metadata.outOfScope).toBe(true)
    })

    it('lists, fetches, and deletes chat sessions through the conversation service', async () => {
      mockConversationMemoryService.getRecentConversations.mockResolvedValue([
        {
          id: 'session-1',
          title: 'AQI session',
          lastMessage: new Date('2026-03-24T00:00:00.000Z'),
          preview: 'AQI summary',
          messageCount: 2,
        },
      ] as never)
      mockDb.chatSession.findUnique
        .mockResolvedValueOnce({
          id: 'session-1',
          userId: 'viewer-user',
          title: 'AQI session',
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          updatedAt: new Date('2026-03-24T00:00:00.000Z'),
          messages: [
            {
              id: 'msg-1',
              sessionId: 'session-1',
              role: 'assistant',
              content: 'AQI summary',
              sources: JSON.stringify([{ id: 'doc-1' }]),
              createdAt: new Date('2026-03-24T00:00:00.000Z'),
            },
          ],
        } as never)
        .mockResolvedValueOnce({
          id: 'session-1',
          userId: 'viewer-user',
        } as never)
      mockConversationMemoryService.getConversationContext.mockResolvedValue({
        summary: 'AQI summary',
      } as never)
      mockConversationMemoryService.deleteConversation.mockResolvedValue(true as never)

      const listResponse = await getChat(authedRequest('http://localhost/api/chat'))
      const listPayload = await listResponse.json()
      const singleResponse = await getChat(authedRequest('http://localhost/api/chat?sessionId=session-1'))
      const singlePayload = await singleResponse.json()
      const deleteResponse = await deleteChat(authedRequest('http://localhost/api/chat?id=session-1', { method: 'DELETE' }))
      const deletePayload = await deleteResponse.json()

      expect(listResponse.status).toBe(200)
      expect(listPayload.sessions).toHaveLength(1)
      expect(singleResponse.status).toBe(200)
      expect(singlePayload.session.messages[0].sources).toEqual([{ id: 'doc-1' }])
      expect(deleteResponse.status).toBe(200)
      expect(deletePayload).toEqual({ success: true })
    })

    it('returns a safe 500 when chat deletion fails after authorization succeeds', async () => {
      mockDb.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'viewer-user',
      } as never)
      mockConversationMemoryService.deleteConversation.mockResolvedValue(false as never)

      const response = await deleteChat(authedRequest('http://localhost/api/chat?id=session-1', { method: 'DELETE' }))
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Failed to delete session',
      })
    })
  })

  describe('documents routes', () => {
    it('lists and searches documents for the current owner', async () => {
      mockDocumentService.listDocuments.mockResolvedValue({
        documents: [{ id: 'doc-1', title: 'AQI report' }],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      } as never)
      mockDocumentService.searchDocuments.mockResolvedValue({
        documents: [{ id: 'doc-2', title: 'Water report' }],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      } as never)

      const listResponse = await getDocuments(authedRequest('http://localhost/api/documents?page=1&pageSize=10'))
      const listPayload = await listResponse.json()
      const searchResponse = await getDocuments(authedRequest('http://localhost/api/documents?query=water&limit=5'))
      const searchPayload = await searchResponse.json()

      expect(listResponse.status).toBe(200)
      expect(mockDocumentService.listDocuments).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        10,
        'viewer-user'
      )
      expect(listPayload.documents[0].id).toBe('doc-1')
      expect(searchResponse.status).toBe(200)
      expect(searchPayload.documents[0].id).toBe('doc-2')
    })

    it('creates, validates, patches, and deletes documents through the service layer', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        title: 'AQI report',
        content: 'Air quality report '.repeat(10),
        category: 'Air Quality',
        audience: 'General Public',
      } as never)
      mockDocumentService.getDocument
        .mockResolvedValueOnce({
          id: 'doc-1',
          ownerId: 'admin-user',
          title: 'AQI report',
          content: 'Air quality report '.repeat(10),
        } as never)
      mockDocumentService.deleteDocument.mockResolvedValue(true as never)

      const postResponse = await postDocuments(authedJsonRequest('http://localhost/api/documents', 'POST', {
        title: 'AQI report',
        content: 'Air quality report '.repeat(10),
        category: 'Air Quality',
      }, 'admin', 'admin-user'))
      const postPayload = await postResponse.json()
      const validationResponse = await postDocuments(authedJsonRequest('http://localhost/api/documents', 'POST', {
        title: '',
      }, 'admin', 'admin-user'))
      const validationPayload = await validationResponse.json()
      const patchResponse = await patchDocuments(authedRequest('http://localhost/api/documents', { method: 'PATCH' }))
      const patchPayload = await patchResponse.json()
      const deleteResponse = await deleteDocuments(authedRequest('http://localhost/api/documents?id=doc-1', { method: 'DELETE' }, 'admin', 'admin-user'))
      const deletePayload = await deleteResponse.json()

      expect(postResponse.status).toBe(201)
      expect(postPayload.document.id).toBe('doc-1')
      expect(validationResponse.status).toBe(400)
      expect(validationPayload.error.code).toBe('VALIDATION_ERROR')
      expect(patchResponse.status).toBe(400)
      expect(patchPayload.error).toBe('Document ID is required')
      expect(deleteResponse.status).toBe(200)
      expect(deletePayload.success).toBe(true)
    })
  })

  describe('export route', () => {
    it('exports chat, documents, and stats payloads in supported formats', async () => {
      mockDb.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'viewer-user',
        title: 'AQI session',
        messages: [
          {
            role: 'assistant',
            content: 'AQI summary',
            sources: null,
            createdAt: new Date('2026-03-24T00:00:00.000Z'),
          },
        ],
      } as never)
      mockDb.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'AQI report',
          category: 'Air Quality',
          reportSeries: null,
          year: 2026,
          audience: 'General Public',
          author: 'EPA Punjab',
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          _count: {
            chunks: 4,
          },
        },
      ] as never)
      mockDb.document.count.mockResolvedValue(1)
      mockDb.chatSession.count.mockResolvedValue(2)
      mockDb.chatMessage.count.mockResolvedValue(3)
      mockDb.feedback.count.mockResolvedValue(1)
      mockDb.document.groupBy
        .mockResolvedValueOnce([{ category: 'Air Quality', _count: { id: 1 } }] as never)
        .mockResolvedValueOnce([{ year: 2026, _count: { id: 1 } }] as never)
      mockDb.feedback.findMany.mockResolvedValue([{ rating: 5 }] as never)

      const chatResponse = await getExport(authedRequest('http://localhost/api/export?type=chat&format=json&sessionId=session-1'))
      const chatText = await chatResponse.text()
      const documentsResponse = await getExport(authedRequest('http://localhost/api/export?type=documents&format=csv'))
      const documentsText = await documentsResponse.text()
      const statsResponse = await getExport(authedRequest('http://localhost/api/export?type=stats&format=json'))
      const statsText = await statsResponse.text()

      expect(chatResponse.status).toBe(200)
      expect(chatText).toContain('"title": "AQI session"')
      expect(documentsResponse.status).toBe(200)
      expect(documentsText).toContain('AQI report')
      expect(statsResponse.status).toBe(200)
      expect(statsText).toContain('"documents": 1')
    })

    it('returns 400 for invalid export requests', async () => {
      const invalidTypeResponse = await getExport(authedRequest('http://localhost/api/export?type=unknown&format=json'))
      const invalidTypePayload = await invalidTypeResponse.json()

      mockDb.chatSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'viewer-user',
        title: 'AQI session',
        messages: [],
      } as never)

      const invalidFormatResponse = await getExport(authedRequest('http://localhost/api/export?type=chat&format=xml&sessionId=session-1'))
      const invalidFormatPayload = await invalidFormatResponse.json()

      expect(invalidTypeResponse.status).toBe(400)
      expect(invalidTypePayload.error).toBe('Invalid export type')
      expect(invalidFormatResponse.status).toBe(400)
      expect(invalidFormatPayload.error).toBe('Unsupported format')
    })
  })

  describe('feedback route', () => {
    it('creates message feedback, returns feedback stats, and returns message-scoped feedback details', async () => {
      mockDb.chatMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        session: {
          userId: 'viewer-user',
        },
      } as never)
      mockDb.feedback.create.mockResolvedValue({
        id: 'feedback-1',
        messageId: 'msg-1',
        rating: 4,
        comment: 'Helpful',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      } as never)
      mockDb.feedback.findMany.mockResolvedValue([
        { rating: 4 },
        { rating: 5 },
      ] as never)
      mockDb.feedback.findFirst.mockResolvedValue({
        id: 'feedback-1',
        messageId: 'msg-1',
        userId: 'viewer-user',
        rating: 4,
        comment: 'Helpful',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        message: {
          session: {
            userId: 'viewer-user',
          },
        },
      } as never)

      const postResponse = await postFeedback(authedJsonRequest('http://localhost/api/feedback', 'POST', {
        messageId: 'msg-1',
        rating: 4,
        comment: 'Helpful',
      }))
      const postPayload = await postResponse.json()
      const statsResponse = await getFeedback(authedRequest('http://localhost/api/feedback'))
      const statsPayload = await statsResponse.json()
      const singleResponse = await getFeedback(authedRequest('http://localhost/api/feedback?messageId=msg-1'))
      const singlePayload = await singleResponse.json()

      expect(postResponse.status).toBe(201)
      expect(postPayload.feedback.id).toBe('feedback-1')
      expect(statsResponse.status).toBe(200)
      expect(statsPayload.statistics.total).toBe(2)
      expect(singleResponse.status).toBe(200)
      expect(singlePayload.feedback.messageId).toBe('msg-1')
    })

    it('returns 404 and 403 for invalid feedback targets', async () => {
      mockDb.chatMessage.findUnique
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({
          id: 'msg-2',
          session: {
            userId: 'other-user',
          },
        } as never)

      const missingResponse = await postFeedback(authedJsonRequest('http://localhost/api/feedback', 'POST', {
        messageId: 'missing',
        rating: 5,
      }))
      const missingPayload = await missingResponse.json()
      const forbiddenResponse = await postFeedback(authedJsonRequest('http://localhost/api/feedback', 'POST', {
        messageId: 'msg-2',
        rating: 5,
      }))
      const forbiddenPayload = await forbiddenResponse.json()

      expect(missingResponse.status).toBe(404)
      expect(missingPayload.error).toBe('Message not found')
      expect(forbiddenResponse.status).toBe(403)
      expect(forbiddenPayload.error).toBe('You do not have access to this message')
    })
  })

  describe('query route', () => {
    it('returns category suggestions and safe validation errors for bad query bodies', async () => {
      const getResponse = await getQuery(authedRequest('http://localhost/api/query?category=Water%20Resources'))
      const getPayload = await getResponse.json()
      const badResponse = await postQuery(authedJsonRequest('http://localhost/api/query', 'POST', {
        query: '<script>alert(1)</script>',
      }))
      const badPayload = await badResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getPayload.suggestions).toEqual(['How has the AQI changed this week?'])
      expect(badResponse.status).toBe(400)
      expect(badPayload.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('sessions route', () => {
    it('retrieves a single session, rejects invalid session bodies, and validates delete ids', async () => {
      mockChatService.getSession.mockResolvedValue({
        id: 'session-1',
        userId: 'viewer-user',
        title: 'AQI session',
      } as never)

      const getResponse = await getSessions(authedRequest('http://localhost/api/sessions?id=session-1'))
      const getPayload = await getResponse.json()
      const badPostResponse = await postSessions(authedJsonRequest('http://localhost/api/sessions', 'POST', {
        title: '<script>alert(1)</script>',
      }))
      const badPostPayload = await badPostResponse.json()
      const deleteResponse = await deleteSessions(authedRequest('http://localhost/api/sessions', { method: 'DELETE' }))
      const deletePayload = await deleteResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getPayload.session.id).toBe('session-1')
      expect(badPostResponse.status).toBe(400)
      expect(badPostPayload.error.code).toBe('VALIDATION_ERROR')
      expect(deleteResponse.status).toBe(400)
      expect(deletePayload.error).toBe('Session ID is required')
    })
  })

  describe('ingest route', () => {
    it('lists ingestion status, returns single-document status, reindexes, and deletes documents', async () => {
      mockDb.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'AQI report',
          category: 'Air Quality',
          year: 2026,
          audience: 'General Public',
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          _count: {
            chunks: 3,
          },
        },
      ] as never)
      mockDb.document.findUnique
        .mockResolvedValueOnce({
          id: 'doc-1',
          ownerId: 'viewer-user',
          chunks: [
            { embedding: '[0.1]' },
            { embedding: '[0.2]' },
          ],
        } as never)
        .mockResolvedValueOnce({
          id: 'doc-1',
          ownerId: 'viewer-user',
          content: 'AQI report '.repeat(80),
        } as never)
        .mockResolvedValueOnce({
          id: 'doc-1',
          ownerId: 'viewer-user',
        } as never)
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3] as never)
      mockDb.documentChunk.deleteMany.mockResolvedValue({ count: 2 } as never)
      mockDb.documentChunk.createMany.mockResolvedValue({ count: 1 } as never)
      mockDb.document.delete.mockResolvedValue({ id: 'doc-1' } as never)

      const listResponse = await getIngest(authedRequest('http://localhost/api/ingest'))
      const listPayload = await listResponse.json()
      const singleResponse = await getIngest(authedRequest('http://localhost/api/ingest?documentId=doc-1'))
      const singlePayload = await singleResponse.json()
      const putResponse = await putIngest(authedJsonRequest('http://localhost/api/ingest', 'PUT', {
        documentId: 'doc-1',
      }))
      const putPayload = await putResponse.json()
      const deleteResponse = await deleteIngest(authedRequest('http://localhost/api/ingest?id=doc-1', { method: 'DELETE' }))
      const deletePayload = await deleteResponse.json()

      expect(listResponse.status).toBe(200)
      expect(listPayload.documents[0].chunkCount).toBe(3)
      expect(singleResponse.status).toBe(200)
      expect(singlePayload.status.isComplete).toBe(true)
      expect(putResponse.status).toBe(200)
      expect(putPayload.chunksCreated).toBeGreaterThan(0)
      expect(deleteResponse.status).toBe(200)
      expect(deletePayload.message).toBe('Document deleted successfully')
    })

    it('returns 404 when reindexing a missing document', async () => {
      mockDb.document.findUnique.mockResolvedValue(null as never)

      const response = await putIngest(authedJsonRequest('http://localhost/api/ingest', 'PUT', {
        documentId: 'missing-doc',
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Document not found')
    })
  })

  describe('upload route', () => {
    it('returns upload status for owned documents and safely handles ingestion failures', async () => {
      mockDb.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        ownerId: 'viewer-user',
        title: 'AQI report',
        isActive: true,
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        _count: {
          chunks: 4,
        },
      } as never)
      mockExtractTextFromDocumentFile.mockResolvedValue({
        content: 'Air quality report '.repeat(10),
        fileType: 'text/plain',
        fileSize: 512,
      })
      mockDocumentIngestionService.ingestDocument.mockRejectedValue(new Error('ingestion failed'))

      const getResponse = await getUpload(authedRequest('http://localhost/api/upload?documentId=doc-1'))
      const getPayload = await getResponse.json()
      const postResponse = await postUpload(formRequest('http://localhost/api/upload', {
        file: new File(['Air quality report '.repeat(10)], 'report.txt', { type: 'text/plain' }),
        category: 'Air Quality',
      }))
      const postPayload = await postResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getPayload.status.chunkCount).toBe(4)
      expect(postResponse.status).toBe(500)
      expect(postPayload).toEqual({
        success: false,
        error: 'Failed to upload document',
      })
    })
  })
})
