// =====================================================
// EPA Punjab EnvironmentGPT - Advanced Embedding Service
// Phase 4: Production-Ready Vector Embedding System
// =====================================================

import { db } from '@/lib/db'
import { llmProviderRegistry } from './llm-provider-registry'
import type { ChunkMetadata, RetrievalResult } from '@/types'
import { RAG_CONFIG } from '@/lib/constants'

// ==================== Types ====================

export interface EmbeddingOptions {
  model?: string
  batchSize?: number
  useCache?: boolean
}

export interface EmbeddingResult {
  embedding: number[]
  tokens: number
  cached: boolean
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  totalTokens: number
  cachedCount: number
  processingTime: number
}

export interface HybridSearchResult {
  chunkId: string
  documentId: string
  content: string
  score: number
  vectorScore: number
  keywordScore: number
  metadata: {
    title: string
    category?: string
    chunkIndex: number
  }
}

// ==================== Advanced Embedding Service ====================

export class AdvancedEmbeddingService {
  private embeddingCache: Map<string, { embedding: number[]; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
  private readonly MAX_CACHE_SIZE = 10000
  private dimension: number

  constructor(dimension: number = RAG_CONFIG.embeddingDimension) {
    this.dimension = dimension
  }

  // ==================== Core Embedding Methods ====================

  /**
   * Generate embedding for a single text with caching
   */
  async embedText(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const { useCache = true } = options
    const cacheKey = this.generateCacheKey(text)

    // Check cache
    if (useCache) {
      const cached = this.getCachedEmbedding(cacheKey)
      if (cached) {
        return {
          embedding: cached,
          tokens: this.estimateTokens(text),
          cached: true
        }
      }
    }

    // Generate new embedding
    const embedding = await this.generateEmbedding(text)
    const tokens = this.estimateTokens(text)

    // Cache the result
    if (useCache) {
      this.setCachedEmbedding(cacheKey, embedding)
    }

    return {
      embedding,
      tokens,
      cached: false
    }
  }

  /**
   * Generate embeddings for multiple texts with batch processing
   */
  async embedBatch(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<BatchEmbeddingResult> {
    const startTime = Date.now()
    const { batchSize = 10, useCache = true } = options

    const embeddings: number[][] = []
    let totalTokens = 0
    let cachedCount = 0

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      for (const text of batch) {
        const result = await this.embedText(text, { useCache })
        embeddings.push(result.embedding)
        totalTokens += result.tokens
        if (result.cached) cachedCount++
      }
    }

    return {
      embeddings,
      totalTokens,
      cachedCount,
      processingTime: Date.now() - startTime
    }
  }

  /**
   * Generate embedding via the provider's /v1/embeddings endpoint,
   * falling back to deterministic semantic hashing if unavailable.
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
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
        return data.data[0].embedding as number[]
      }
    } catch {
      console.warn('[AdvancedEmbeddingService] Provider embedding failed, using semantic hash fallback')
    }

    return this.generateSemanticEmbedding(text)
  }

  /**
   * Generate semantic embedding using text features
   */
  private generateSemanticEmbedding(text: string): number[] {
    const embedding = new Array(this.dimension).fill(0)
    const normalizedText = text.toLowerCase().trim()
    const addFeature = (index: number, value: number): void => {
      if (index >= 0 && index < embedding.length) {
        embedding[index] += value
      }
    }
    
    // Extract features
    const words = normalizedText.split(/\s+/).filter(w => w.length > 0)
    const sentences = normalizedText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    // 1. Word-based features (positions 0-127)
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const hash = this.stringHash(word)
      
      // Multiple positions for each word
      const pos1 = Math.abs(hash) % 128
      const pos2 = Math.abs(hash >> 8) % 128
      const pos3 = Math.abs(hash >> 16) % 128
      
      addFeature(pos1, 1)
      addFeature(pos2, 0.5)
      addFeature(pos3, 0.25)
    }
    
    // 2. N-gram features (positions 128-255)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + '_' + words[i + 1]
      const hash = this.stringHash(bigram)
      const pos = 128 + (Math.abs(hash) % 128)
      addFeature(pos, 1)
    }
    
    // 3. Character-level features (positions 256-319)
    const chars = normalizedText.replace(/\s/g, '')
    for (let i = 0; i < chars.length; i++) {
      const charCode = chars.charCodeAt(i)
      const pos = 256 + (charCode % 64)
      addFeature(pos, 0.1)
    }
    
    // 4. Structural features (positions 320-383)
    addFeature(320, words.length / 100) // Word count normalized
    addFeature(321, sentences.length / 10) // Sentence count normalized
    addFeature(322, chars.length / 500) // Character count normalized
    addFeature(323, words.length > 0 ? chars.length / words.length : 0) // Avg word length
    
    // Detect numbers
    const numberCount = (text.match(/\d+/g) || []).length
    addFeature(324, numberCount / 10)
    
    // Detect questions
    const questionCount = (text.match(/\?/g) || []).length
    addFeature(325, questionCount)
    
    // Detect keywords relevant to environment
    const envKeywords = ['air', 'water', 'pollution', 'environment', 'climate', 'quality', 
                         'emission', 'waste', 'health', 'pakistan', 'punjab', 'epa', 
                         'regulation', 'standard', 'monitor', 'assessment']
    for (const keyword of envKeywords) {
      if (normalizedText.includes(keyword)) {
        const pos = 326 + envKeywords.indexOf(keyword)
        addFeature(pos, 1)
      }
    }
    
    // Normalize the embedding
    this.normalizeVector(embedding)
    
    return embedding
  }

  // ==================== Vector Operations ====================

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

  /**
   * Calculate euclidean distance between two vectors
   */
  euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return Infinity
    
    let sum = 0
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2)
    }
    
    return Math.sqrt(sum)
  }

  /**
   * Normalize a vector in place
   */
  normalizeVector(vec: number[]): void {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0))
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm
      }
    }
  }

  private parseJson<T>(value?: string | null): T | null {
    if (!value) return null

    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  // ==================== Retrieval Methods ====================

  /**
   * Retrieve relevant chunks with hybrid scoring
   */
  async retrieveRelevantChunks(
    query: string,
    topK: number = RAG_CONFIG.defaultTopK,
    threshold: number = RAG_CONFIG.similarityThreshold,
    options: {
      category?: string
      documentIds?: string[]
      useHybrid?: boolean
    } = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now()
    
    try {
      // Generate query embedding
      const { embedding: queryEmbedding } = await this.embedText(query)
      
      // Get all chunks with embeddings
      const whereClause: Record<string, unknown> = {
        embedding: { not: null }
      }
      
      // Apply document filter if specified
      if (options.documentIds && options.documentIds.length > 0) {
        whereClause.documentId = { in: options.documentIds }
      }

      const chunks = await db.documentChunk.findMany({
        where: whereClause,
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
          
          // Apply category filter
          if (options.category && chunk.document.category !== options.category) {
            return null
          }
          
          const vectorScore = this.cosineSimilarity(queryEmbedding, chunkEmbedding)
          
          // Calculate keyword score for hybrid search
          let keywordScore = 0
          if (options.useHybrid !== false) {
            keywordScore = this.calculateKeywordScore(query, chunk.content)
          }
          
          // Combine scores (70% vector, 30% keyword by default)
          const combinedScore = options.useHybrid !== false
            ? (vectorScore * 0.7) + (keywordScore * 0.3)
            : vectorScore
          
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
            score: combinedScore,
            vectorScore,
            keywordScore
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      const retrievalTime = Date.now() - startTime
      const totalTokens = scoredChunks.reduce((sum, item) => 
        sum + this.estimateTokens(item.chunk.content), 0
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
   * Calculate keyword matching score
   */
  private calculateKeywordScore(query: string, content: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const contentLower = content.toLowerCase()
    
    if (queryTerms.length === 0) return 0
    
    let matches = 0
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi')
      const termMatches = contentLower.match(regex)
      if (termMatches) {
        matches += termMatches.length
      }
    }
    
    // Normalize score (0-1)
    return Math.min(matches / (queryTerms.length * 2), 1)
  }

  // ==================== Document Processing ====================

  /**
   * Process and store embeddings for document chunks
   */
  async processDocumentEmbeddings(
    documentId: string,
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<{
    chunksProcessed: number
    totalTokens: number
    processingTime: number
  }> {
    const startTime = Date.now()
    
    try {
      // Get all chunks for the document
      const chunks = await db.documentChunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' }
      })

      let totalTokens = 0
      const total = chunks.length

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        // Generate embedding for chunk content
        const result = await this.embedText(chunk.content)
        
        // Store embedding
        await db.documentChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(result.embedding) }
        })
        
        totalTokens += result.tokens
        
        // Report progress
        if (onProgress) {
          onProgress({ current: i + 1, total })
        }
      }

      return {
        chunksProcessed: chunks.length,
        totalTokens,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Failed to process document embeddings:', error)
      throw error
    }
  }

  // ==================== Cache Management ====================

  private generateCacheKey(text: string): string {
    return this.stringHash(text).toString(36)
  }

  private getCachedEmbedding(key: string): number[] | null {
    const cached = this.embeddingCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.embedding
    }
    return null
  }

  private setCachedEmbedding(key: string, embedding: number[]): void {
    // Evict old entries if cache is full
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.embeddingCache.keys().next().value
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey)
      }
    }
    
    this.embeddingCache.set(key, {
      embedding,
      timestamp: Date.now()
    })
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.embeddingCache.size,
      maxSize: this.MAX_CACHE_SIZE
    }
  }

  // ==================== Utility Methods ====================

  private stringHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Get embedding dimension
   */
  getDimension(): number {
    return this.dimension
  }
}

// Export singleton instance
export const advancedEmbeddingService = new AdvancedEmbeddingService()
