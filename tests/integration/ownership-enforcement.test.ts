import { NextRequest } from 'next/server'
import { createAuthHeaders } from '../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    chatSession: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    chatMessage: {
      count: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    feedback: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/conversation-memory', () => ({
  conversationMemoryService: {
    getConversationContext: jest.fn(),
    getRecentConversations: jest.fn(),
    deleteConversation: jest.fn(),
  },
}))

jest.mock('@/lib/services/advanced-embedding-service', () => ({
  advancedEmbeddingService: {
    retrieveRelevantChunks: jest.fn(),
  },
}))

jest.mock('@/lib/services/query-processor', () => ({
  queryProcessorService: {
    processQuery: jest.fn(),
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

jest.mock('@/lib/services/llm-router-service', () => ({
  llmRouter: {
    processQuery: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getProviders: jest.fn(),
  },
}))

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getDocument: jest.fn(),
    listDocuments: jest.fn(),
    searchDocuments: jest.fn(),
    deleteDocument: jest.fn(),
  },
}))

import { db } from '@/lib/db'
import { conversationMemoryService } from '@/lib/services/conversation-memory'
import { documentService } from '@/lib/services/document-service'
import { GET as getChat, DELETE as deleteChat } from '@/app/api/chat/route'
import { GET as getDocuments } from '@/app/api/documents/route'
import { GET as getExport } from '@/app/api/export/route'

const mockDb = db as any
const mockConversationMemoryService = conversationMemoryService as any
const mockDocumentService = documentService as any

describe('ownership enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when viewing another user chat session', async () => {
    mockDb.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'other-user',
      title: 'Other session',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      messages: [],
    } as never)

    const response = await getChat(new NextRequest('http://localhost/api/chat?sessionId=session-1', {
      headers: createAuthHeaders('viewer', 'viewer-user'),
    }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('You do not have access to this session')
  })

  it('returns 403 when deleting another user chat session', async () => {
    mockDb.chatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'other-user',
    } as never)

    const response = await deleteChat(new NextRequest('http://localhost/api/chat?id=session-1', {
      method: 'DELETE',
      headers: createAuthHeaders('viewer', 'viewer-user'),
    }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('You do not have access to this session')
    expect(mockConversationMemoryService.deleteConversation).not.toHaveBeenCalled()
  })

  it('returns 403 when a non-admin requests another user document', async () => {
    mockDocumentService.getDocument.mockResolvedValue({
      id: 'doc-1',
      ownerId: 'other-user',
      title: 'Restricted document',
      content: 'content',
      category: 'Air Quality',
      audience: 'General Public',
      tags: [],
      isActive: true,
      language: 'en',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never)

    const response = await getDocuments(new NextRequest('http://localhost/api/documents?id=doc-1', {
      headers: createAuthHeaders('viewer', 'viewer-user'),
    }))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('You do not have access to this document')
  })

  it('filters exported documents to the current owner', async () => {
    mockDb.document.findMany.mockResolvedValue([] as never)

    await getExport(new NextRequest('http://localhost/api/export?type=documents&format=json', {
      headers: createAuthHeaders('viewer', 'viewer-user'),
    }))

    expect(mockDb.document.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        ownerId: 'viewer-user',
      }),
    }))
  })

  it('filters exported stats to the current owner', async () => {
    mockDb.document.count.mockResolvedValue(1)
    mockDb.chatSession.count.mockResolvedValue(2)
    mockDb.chatMessage.count.mockResolvedValue(3)
    mockDb.feedback.count.mockResolvedValue(0)
    mockDb.document.groupBy.mockResolvedValue([])
    mockDb.feedback.findMany.mockResolvedValue([])

    await getExport(new NextRequest('http://localhost/api/export?type=stats&format=json', {
      headers: createAuthHeaders('viewer', 'viewer-user'),
    }))

    expect(mockDb.document.count).toHaveBeenCalledWith({
      where: {
        isActive: true,
        ownerId: 'viewer-user',
      },
    })
    expect(mockDb.chatSession.count).toHaveBeenCalledWith({
      where: {
        userId: 'viewer-user',
      },
    })
    expect(mockDb.chatMessage.count).toHaveBeenCalledWith({
      where: {
        session: {
          userId: 'viewer-user',
        },
      },
    })
  })
})
