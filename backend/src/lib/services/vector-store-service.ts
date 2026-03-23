// =====================================================
// EPA Punjab EnvironmentGPT - Vector Store Service
// Phase 2: In-Memory Vector Database with Persistence
// =====================================================

import { db } from '@/lib/db'
import { embeddingService } from './embedding-service'
import { DocumentChunk, SourceReference } from '@/types'

// ==================== Types ====================

export interface VectorDocument {
  id: string
  documentId: string
  chunkId: string
  content: string
  embedding: number[]
  metadata: {
    title: string
    category?: string
    pageNumber?: number
    chunkIndex: number
  }
}

export interface SearchResult {
  chunkId: string
  documentId: string
  content: string
  score: number
  metadata: VectorDocument['metadata']
}

export interface IndexStats {
  totalDocuments: number
  totalChunks: number
  indexSize: number
  lastUpdated: Date
}

// ==================== Vector Store Service ====================

export class VectorStoreService {
  private index: Map<string, VectorDocument> = new Map()
  private documentIndex: Map<string, Set<string>> = new Map() // documentId -> chunkIds
  private isLoaded: boolean = false
  private readonly SIMILARITY_THRESHOLD = 0.5

  /**
   * Load all embeddings from database into memory
   */
  async loadIndex(): Promise<void> {
    if (this.isLoaded) return

    try {
      const chunks = await db.documentChunk.findMany({
        where: {
          embedding: { not: null }
        },
        include: {
          document: {
            select: {
              title: true,
              category: true
            }
          }
        }
      })

      for (const chunk of chunks) {
        if (chunk.embedding) {
          try {
            const embedding = JSON.parse(chunk.embedding)
            const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {}

            const vectorDoc: VectorDocument = {
              id: chunk.id,
              documentId: chunk.documentId,
              chunkId: chunk.id,
              content: chunk.content,
              embedding,
              metadata: {
                title: chunk.document.title,
                category: chunk.document.category || undefined,
                pageNumber: metadata.pageNumber,
                chunkIndex: chunk.chunkIndex
              }
            }

            this.index.set(chunk.id, vectorDoc)

            // Update document index
            if (!this.documentIndex.has(chunk.documentId)) {
              this.documentIndex.set(chunk.documentId, new Set())
            }
            this.documentIndex.get(chunk.documentId)!.add(chunk.id)
          } catch (parseError) {
            console.error(`Failed to parse embedding for chunk ${chunk.id}:`, parseError)
          }
        }
      }

      this.isLoaded = true
      console.log(`Loaded ${this.index.size} chunks into vector index`)
    } catch (error) {
      console.error('Failed to load vector index:', error)
    }
  }

  /**
   * Add a document chunk to the index
   */
  async addChunk(
    documentId: string,
    chunkId: string,
    content: string,
    embedding: number[],
    metadata: VectorDocument['metadata']
  ): Promise<void> {
    const vectorDoc: VectorDocument = {
      id: chunkId,
      documentId,
      chunkId,
      content,
      embedding,
      metadata
    }

    this.index.set(chunkId, vectorDoc)

    // Update document index
    if (!this.documentIndex.has(documentId)) {
      this.documentIndex.set(documentId, new Set())
    }
    this.documentIndex.get(documentId)!.add(chunkId)

    // Persist to database
    await db.documentChunk.update({
      where: { id: chunkId },
      data: { embedding: JSON.stringify(embedding) }
    })
  }

  /**
   * Add multiple chunks at once
   */
  async addChunks(chunks: VectorDocument[]): Promise<void> {
    for (const chunk of chunks) {
      this.index.set(chunk.id, chunk)

      if (!this.documentIndex.has(chunk.documentId)) {
        this.documentIndex.set(chunk.documentId, new Set())
      }
      this.documentIndex.get(chunk.documentId)!.add(chunk.id)
    }

    // Batch update database
    for (const chunk of chunks) {
      await db.documentChunk.update({
        where: { id: chunk.id },
        data: { embedding: JSON.stringify(chunk.embedding) }
      })
    }
  }

  /**
   * Remove all chunks for a document
   */
  async removeDocument(documentId: string): Promise<void> {
    const chunkIds = this.documentIndex.get(documentId)
    if (chunkIds) {
      for (const chunkId of chunkIds) {
        this.index.delete(chunkId)
      }
      this.documentIndex.delete(documentId)
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async search(
    query: string,
    options: {
      topK?: number
      documentIds?: string[]
      category?: string
      threshold?: number
    } = {}
  ): Promise<SearchResult[]> {
    await this.loadIndex()

    const { topK = 5, documentIds, category, threshold = this.SIMILARITY_THRESHOLD } = options

    // Generate query embedding
    const { embedding: queryEmbedding } = await embeddingService.embedText(query)

    // Get candidates from index
    const candidates: VectorDocument[] = []
    
    for (const doc of this.index.values()) {
      // Filter by document IDs if specified
      if (documentIds && !documentIds.includes(doc.documentId)) continue
      
      // Filter by category if specified
      if (category && doc.metadata.category !== category) continue
      
      candidates.push(doc)
    }

    // Calculate similarities
    const results: SearchResult[] = candidates
      .map(doc => ({
        chunkId: doc.chunkId,
        documentId: doc.documentId,
        content: doc.content,
        score: embeddingService.cosineSimilarity(queryEmbedding, doc.embedding),
        metadata: doc.metadata
      }))
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return results
  }

  /**
   * Hybrid search combining vector similarity with keyword matching
   */
  async hybridSearch(
    query: string,
    options: {
      topK?: number
      documentIds?: string[]
      category?: string
      keywordWeight?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, documentIds, category, keywordWeight = 0.3 } = options

    // Get vector search results
    const vectorResults = await this.search(query, { topK: topK * 2, documentIds, category })

    // Calculate keyword scores
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    
    const resultsWithKeyword = vectorResults.map(result => {
      const content = result.content.toLowerCase()
      let keywordScore = 0
      
      for (const term of queryTerms) {
        const matches = content.match(new RegExp(term, 'g'))
        if (matches) {
          keywordScore += matches.length
        }
      }

      // Normalize keyword score (0-1)
      const normalizedKeywordScore = Math.min(keywordScore / (queryTerms.length * 3), 1)
      
      // Combine scores
      const combinedScore = (result.score * (1 - keywordWeight)) + (normalizedKeywordScore * keywordWeight)

      return {
        ...result,
        score: combinedScore
      }
    })

    // Re-sort by combined score
    return resultsWithKeyword
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    let totalSize = 0
    for (const doc of this.index.values()) {
      totalSize += doc.embedding.length * 8 // 8 bytes per float64
    }

    return {
      totalDocuments: this.documentIndex.size,
      totalChunks: this.index.size,
      indexSize: totalSize,
      lastUpdated: new Date()
    }
  }

  /**
   * Clear the index
   */
  clearIndex(): void {
    this.index.clear()
    this.documentIndex.clear()
    this.isLoaded = false
  }

  /**
   * Convert search results to source references
   */
  resultsToSources(results: SearchResult[]): SourceReference[] {
    return results.map(result => ({
      id: result.chunkId,
      documentId: result.documentId,
      title: result.metadata.title,
      category: result.metadata.category,
      relevanceScore: result.score,
      excerpt: result.content.slice(0, 200) + (result.content.length > 200 ? '...' : ''),
      pageNumber: result.metadata.pageNumber
    }))
  }
}

// Export singleton instance
export const vectorStoreService = new VectorStoreService()
