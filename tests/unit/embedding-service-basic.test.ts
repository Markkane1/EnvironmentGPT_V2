// =====================================================
// EPA Punjab EnvironmentGPT - Basic Embedding Service Tests
// Phase 8: Unit Tests for embedding-service.ts
// =====================================================

jest.mock('z-ai-web-dev-sdk', () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    documentChunk: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

import { db } from '@/lib/db'
import { EmbeddingService } from '@/lib/services/embedding-service'

describe('EmbeddingService', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService()
    jest.clearAllMocks()
  })

  it('generates deterministic embeddings and reuses the cache', async () => {
    const first = await service.generateEmbedding('Air quality in Lahore')
    const second = await service.generateEmbedding('Air quality in Lahore')

    expect(first).toHaveLength(384)
    expect(second).toEqual(first)
  })

  it('skips malformed chunk embeddings during retrieval', async () => {
    ;(db.documentChunk.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Broken chunk',
        chunkIndex: 0,
        embedding: '{bad json',
        metadata: '{bad json',
        createdAt: new Date(),
      },
    ])

    const result = await service.retrieveRelevantChunks('air quality')

    expect(result.chunks).toHaveLength(0)
    expect(result.scores).toHaveLength(0)
  })
})
