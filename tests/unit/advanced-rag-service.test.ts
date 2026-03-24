// =====================================================
// EPA Punjab EnvironmentGPT - Advanced RAG Service Tests
// Phase 8: Unit Tests for advanced-rag-service.ts
// =====================================================

import { EnhancedRAGService } from '@/lib/services/advanced-rag-service'
import { ChatResponse } from '@/types'

const mockChatCompletion = jest.fn()

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    chatCompletion: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    document: {
      findMany: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    chatSession: {
      update: jest.fn(),
    },
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
    generateKey: jest.fn().mockReturnValue('cache-key'),
    get: jest.fn(),
    set: jest.fn(),
  },
}))

import { db } from '@/lib/db'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { queryProcessorService } from '@/lib/services/query-processor'
import { responseCacheService } from '@/lib/services/response-cache'

describe('EnhancedRAGService', () => {
  let ragService: EnhancedRAGService

  beforeEach(() => {
    ragService = new EnhancedRAGService()
    jest.clearAllMocks()

    mockChatCompletion.mockResolvedValue({
      response: {
        choices: [{ message: { content: 'Generated environmental response.' } }],
      },
    })
    ;(llmProviderRegistry.chatCompletion as jest.Mock).mockImplementation(mockChatCompletion)

    ;(queryProcessorService.processQuery as jest.Mock).mockReturnValue({
      original: 'What is air quality in Lahore?',
      cleaned: 'what is air quality in lahore?',
      expanded: 'air quality lahore',
      keywords: ['air', 'quality', 'lahore'],
      entities: {
        locations: ['Lahore'],
        parameters: [],
        years: [],
        organizations: [],
        measurements: [],
      },
      intent: { type: 'information', confidence: 0.9 },
      category: 'Air Quality',
      suggestedFilters: { category: 'Air Quality', location: 'Lahore' },
    })
    ;(queryProcessorService.isWithinScope as jest.Mock).mockReturnValue({ inScope: true })
    ;(advancedEmbeddingService.retrieveRelevantChunks as jest.Mock).mockResolvedValue({
      chunks: [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Lahore experiences seasonal smog.',
          chunkIndex: 0,
          metadata: {},
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
      scores: [0.92],
      totalTokens: 10,
      retrievalTime: 5,
    })
    ;(db.document.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Air Quality Report',
        category: 'Air Quality',
        year: 2024,
        source: 'report.pdf',
      },
    ])
    ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue([])
    ;(db.chatMessage.create as jest.Mock).mockResolvedValue({
      id: 'message-1',
    })
    ;(db.chatMessage.count as jest.Mock).mockResolvedValue(2)
    ;(db.chatSession.update as jest.Mock).mockResolvedValue({ id: 'session-1' })
  })

  describe('processQuery()', () => {
    it('returns an out-of-scope response without calling the LLM', async () => {
      ;(queryProcessorService.isWithinScope as jest.Mock).mockReturnValue({
        inScope: false,
        reason: 'Outside scope',
      })

      const result = await ragService.processQuery({
        message: 'What is the cricket score?',
        sessionId: 'session-1',
      })

      expect(result.response.success).toBe(true)
      expect(result.response.response).toBe('Outside scope')
      expect(mockChatCompletion).not.toHaveBeenCalled()
    })

    it('returns cached responses when available', async () => {
      const cachedResponse: ChatResponse = {
        success: true,
        response: 'Cached response',
        sources: [],
        timestamp: new Date('2024-01-01T00:00:00Z'),
      }

      ;(responseCacheService.get as jest.Mock).mockReturnValue(cachedResponse)

      const result = await ragService.processQuery({
        message: 'What is the air quality in Lahore?',
        sessionId: 'session-1',
      })

      expect(result.response).toEqual(cachedResponse)
      expect(result.metadata.cachedResponse).toBe(true)
      expect(advancedEmbeddingService.retrieveRelevantChunks).not.toHaveBeenCalled()
      expect(mockChatCompletion).not.toHaveBeenCalled()
    })

    it('retrieves context, calls the model, and caches successful responses', async () => {
      ;(responseCacheService.get as jest.Mock).mockReturnValue(null)

      const result = await ragService.processQuery({
        message: 'What is the air quality in Lahore?',
        sessionId: 'session-1',
        audience: 'General Public',
      })

      expect(result.response.success).toBe(true)
      expect(result.response.sources).toHaveLength(1)
      expect(result.response.response).toContain('Generated environmental response')
      expect(advancedEmbeddingService.retrieveRelevantChunks).toHaveBeenCalledWith(
        'air quality lahore',
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          category: 'Air Quality',
          useHybrid: true,
        })
      )
      expect(db.document.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['doc-1'],
          },
        },
        select: {
          id: true,
          title: true,
          category: true,
          year: true,
          source: true,
        },
      })
      expect(mockChatCompletion).toHaveBeenCalled()
      expect(responseCacheService.set).toHaveBeenCalled()
    })
  })

  describe('processQueryStream()', () => {
    it('emits an out-of-scope text chunk followed by done', async () => {
      ;(queryProcessorService.isWithinScope as jest.Mock).mockReturnValue({
        inScope: false,
        reason: 'Outside scope',
      })

      const chunks: Array<{ type: string; content?: string; sources?: unknown[]; error?: string }> = []
      for await (const chunk of ragService.processQueryStream({
        message: 'What is the cricket score?',
      })) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual([
        { type: 'text', content: 'Outside scope' },
        { type: 'done' },
      ])
    })
  })
})
