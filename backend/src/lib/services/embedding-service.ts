// =====================================================
// EPA Punjab EnvironmentGPT - Embedding Service
// Phase 2: Vector Embedding Generation & Management
// Internal compatibility layer for ingestion/vector operations
// =====================================================

import { db } from '@/lib/db'
import { llmProviderRegistry } from './llm-provider-registry'
import type { ChunkMetadata, RetrievalResult } from '@/types'
import { RAG_CONFIG } from '@/lib/constants'

// ==================== Embedding Service Class ====================

export class EmbeddingService {
  private cache: Map<string, number[]> = new Map()

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(text)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      // Try the primary provider's /v1/embeddings endpoint
      const providers = await llmProviderRegistry.getProviderChain()
      const provider = providers[0]
      if (!provider) throw new Error('No provider available')

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (provider.apiKeyEnvVar) {
        const apiKey = process.env[provider.apiKeyEnvVar]
        if (apiKey) {
          if (provider.providerType === 'azure') {
            headers['api-key'] = apiKey
          } else {
            headers.Authorization = `Bearer ${apiKey}`
          }
        }
      }

      const response = await fetch(`${provider.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: provider.modelId, input: text })
      })

      if (response.ok) {
        const data = await response.json()
        const embedding = data.data[0].embedding as number[]
        this.cache.set(cacheKey, embedding)
        return embedding
      }
    } catch {
      console.warn('[EmbeddingService] Provider embedding failed, using semantic hash fallback')
    }

    // Fallback to deterministic pseudo-embedding
    const embedding = await this.generatePseudoEmbedding(text)
    this.cache.set(cacheKey, embedding)
    return embedding
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text)
      embeddings.push(embedding)
    }
    
    return embeddings
  }

  /**
   * Store embedding for a document chunk
   */
  async storeChunkEmbedding(chunkId: string, documentId: string, embedding: number[]): Promise<void> {
    try {
      // Update the chunk with embedding
      await db.documentChunk.update({
        where: { id: chunkId },
        data: {
          embedding: JSON.stringify(embedding)
        }
      })
    } catch (error) {
      console.error('Failed to store embedding:', error)
      throw error
    }
  }

  /**
   * Process document and generate embeddings for all chunks
   */
  async processDocumentEmbeddings(documentId: string): Promise<{
    chunksProcessed: number
    totalTokens: number
  }> {
    try {
      // Get all chunks for the document
      const chunks = await db.documentChunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' }
      })

      let totalTokens = 0
      
      for (const chunk of chunks) {
        // Generate embedding for chunk content
        const embedding = await this.generateEmbedding(chunk.content)
        
        // Store embedding
        await this.storeChunkEmbedding(chunk.id, documentId, embedding)
        
        // Estimate token count (rough: 4 chars per token)
        totalTokens += Math.ceil(chunk.content.length / 4)
      }

      return {
        chunksProcessed: chunks.length,
        totalTokens
      }
    } catch (error) {
      console.error('Failed to process document embeddings:', error)
      throw error
    }
  }

  /**
   * Retrieve relevant chunks for a query
   */
  async retrieveRelevantChunks(
    query: string, 
    topK: number = RAG_CONFIG.defaultTopK,
    threshold: number = RAG_CONFIG.similarityThreshold
  ): Promise<RetrievalResult> {
    const startTime = Date.now()
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query)
      
      // Get all chunks with embeddings
      const chunks = await db.documentChunk.findMany({
        where: {
          embedding: { not: null }
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              category: true
            }
          }
        }
      })

      // Calculate similarity scores
      const scoredChunks = chunks
        .map(chunk => {
          const chunkEmbedding = this.parseJson<number[]>(chunk.embedding)
          if (!chunkEmbedding) return null
          
          const score = this.cosineSimilarity(queryEmbedding, chunkEmbedding)
          const metadata = this.parseJson<Partial<ChunkMetadata>>(chunk.metadata)
          return {
            chunk: {
              id: chunk.id,
              documentId: chunk.documentId,
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              metadata: {
                startPosition: metadata?.startPosition ?? 0,
                endPosition: metadata?.endPosition ?? chunk.content.length,
                wordCount: metadata?.wordCount ?? chunk.content.split(/\s+/).length,
                pageNumber: metadata?.pageNumber,
                section: metadata?.section,
              },
              createdAt: chunk.createdAt
            },
            score
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      const retrievalTime = Date.now() - startTime
      const totalTokens = scoredChunks.reduce((sum, item) => 
        sum + Math.ceil(item.chunk.content.length / 4), 0
      )

      return {
        chunks: scoredChunks.map(s => s.chunk),
        scores: scoredChunks.map(s => s.score),
        totalTokens,
        retrievalTime
      }
    } catch (error) {
      console.error('Failed to retrieve chunks:', error)
      return {
        chunks: [],
        scores: [],
        totalTokens: 0,
        retrievalTime: Date.now() - startTime
      }
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }
    
    if (norm1 === 0 || norm2 === 0) return 0
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  private parseJson<T>(value?: string | null): T | null {
    if (!value) return null

    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  /**
   * Generate a deterministic pseudo-embedding
   * This is a placeholder for actual embedding generation
   */
  private async generatePseudoEmbedding(text: string): Promise<number[]> {
    const dimension = 384
    const embedding: number[] = new Array(dimension).fill(0)
    
    // Use text characteristics to generate pseudo-embedding
    const words = text.toLowerCase().split(/\s+/)
    // Generate embedding based on word frequencies and positions
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      let hash = 0
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(j)
        hash = hash & hash
      }
      
      const position = Math.abs(hash) % dimension
      embedding[position] += 1 / (i + 1) // Position-weighted
    }
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm
      }
    }
    
    return embedding
  }

  /**
   * Generate cache key for text
   */
  private getCacheKey(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i)
      hash = hash & hash
    }
    return `emb_${hash}`
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService()
