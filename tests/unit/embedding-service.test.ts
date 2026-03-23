// =====================================================
// EPA Punjab EnvironmentGPT - Embedding Service Tests
// Phase 8: Unit Tests for advanced-embedding-service.ts
// =====================================================

// Mock the ZAI SDK before importing the service
jest.mock('z-ai-web-dev-sdk', () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }],
          }),
        },
      },
    }),
  },
}))

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    documentChunk: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    document: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

import { AdvancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { db } from '@/lib/db'

// ==================== Embedding Service Tests ====================

describe('AdvancedEmbeddingService', () => {
  let service: AdvancedEmbeddingService

  beforeEach(() => {
    service = new AdvancedEmbeddingService(384)
    jest.clearAllMocks()
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('embedText()', () => {
    it('should generate embedding for text', async () => {
      const result = await service.embedText('Air quality in Lahore')
      
      expect(result.embedding).toBeDefined()
      expect(result.embedding.length).toBe(384)
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.cached).toBe(false)
    })

    it('should return cached embedding on second call', async () => {
      const text = 'Water pollution in River Ravi'
      
      const result1 = await service.embedText(text)
      const result2 = await service.embedText(text)
      
      expect(result1.cached).toBe(false)
      expect(result2.cached).toBe(true)
      expect(result1.embedding).toEqual(result2.embedding)
    })

    it('should not use cache when disabled', async () => {
      const text = 'Climate change impacts'
      
      const result1 = await service.embedText(text, { useCache: false })
      const result2 = await service.embedText(text, { useCache: false })
      
      expect(result1.cached).toBe(false)
      expect(result2.cached).toBe(false)
    })

    it('should generate different embeddings for different texts', async () => {
      const result1 = await service.embedText('Air pollution')
      const result2 = await service.embedText('Water contamination')
      
      expect(result1.embedding).not.toEqual(result2.embedding)
    })

    it('should handle empty text', async () => {
      const result = await service.embedText('')
      
      expect(result.embedding).toBeDefined()
      expect(result.embedding.length).toBe(384)
    })
  })

  describe('embedBatch()', () => {
    it('should embed multiple texts', async () => {
      const texts = [
        'Air quality in Lahore',
        'Water pollution in Ravi',
        'Climate change effects'
      ]
      
      const result = await service.embedBatch(texts)
      
      expect(result.embeddings.length).toBe(3)
      expect(result.totalTokens).toBeGreaterThan(0)
    })

    it('should handle empty array', async () => {
      const result = await service.embedBatch([])
      
      expect(result.embeddings.length).toBe(0)
      expect(result.totalTokens).toBe(0)
    })

    it('should process in batches', async () => {
      const texts = Array.from({ length: 15 }, (_, i) => `Text ${i}`)
      
      const result = await service.embedBatch(texts, { batchSize: 5 })
      
      expect(result.embeddings.length).toBe(15)
    })
  })

  describe('cosineSimilarity()', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [0.5, 0.5, 0.5, 0.5]
      const similarity = service.cosineSimilarity(vec, vec)
      
      expect(similarity).toBeCloseTo(1, 5)
    })

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0, 0]
      const vec2 = [0, 1, 0, 0]
      const similarity = service.cosineSimilarity(vec1, vec2)
      
      expect(similarity).toBeCloseTo(0, 5)
    })

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 0, 0, 0]
      const vec2 = [-1, 0, 0, 0]
      const similarity = service.cosineSimilarity(vec1, vec2)
      
      expect(similarity).toBeCloseTo(-1, 5)
    })

    it('should return 0 for vectors of different lengths', () => {
      const vec1 = [1, 2, 3]
      const vec2 = [1, 2]
      const similarity = service.cosineSimilarity(vec1, vec2)
      
      expect(similarity).toBe(0)
    })

    it('should return 0 for zero vectors', () => {
      const vec1 = [0, 0, 0, 0]
      const vec2 = [1, 2, 3, 4]
      const similarity = service.cosineSimilarity(vec1, vec2)
      
      expect(similarity).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      await service.embedText('Test text')
      
      service.clearCache()
      
      const stats = service.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should return cache stats', async () => {
      await service.embedText('Text 1')
      await service.embedText('Text 2')
      
      const stats = service.getCacheStats()
      
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(10000)
    })
  })

  describe('getDimension()', () => {
    it('should return configured dimension', () => {
      const dim = service.getDimension()
      
      expect(dim).toBe(384)
    })

    it('should respect custom dimension', () => {
      const customService = new AdvancedEmbeddingService(512)
      
      expect(customService.getDimension()).toBe(512)
    })
  })

  describe('retrieveRelevantChunks()', () => {
    it('should skip malformed embeddings instead of throwing', async () => {
      ;(db.documentChunk.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Malformed embedding chunk',
          chunkIndex: 0,
          embedding: '{bad json',
          metadata: '{bad json',
          createdAt: new Date(),
          document: {
            id: 'doc-1',
            title: 'Broken Document',
            category: 'Air Quality',
          },
        },
      ])

      const result = await service.retrieveRelevantChunks('air quality')

      expect(result.chunks).toHaveLength(0)
      expect(result.scores).toHaveLength(0)
    })
  })
})
