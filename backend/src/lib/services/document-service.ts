// =====================================================
// EPA Punjab EnvironmentGPT - Document Service
// Phase 1: Document Management Business Logic
// =====================================================

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { 
  Document, 
  DocumentCategory,
  DocumentFilter, 
  SearchResult 
} from '@/types'
import type { CreateDocumentInput, UpdateDocumentInput } from '@/lib/validators'
import { 
  calculateRelevanceScore, 
  createChunks,
} from '@/lib/utils'

type DocumentRecordWithChunks = Prisma.DocumentGetPayload<{
  include: { chunks: true }
}>

type DocumentRecord = Prisma.DocumentGetPayload<Record<string, never>>
type DocumentRecordLike = DocumentRecord | DocumentRecordWithChunks
type DocumentChunkRecord = DocumentRecordWithChunks['chunks'][number]
type DocumentWhereInput = {
  isActive: boolean
  ownerId?: string
  category?: DocumentCategory
  reportSeries?: string
  audience?: Document['audience']
  year?: {
    gte?: number
    lte?: number
  }
}

// ==================== Document Service Class ====================

export class DocumentService {
  /**
   * Create a new document
   */
  async createDocument(input: CreateDocumentInput & { ownerId?: string }): Promise<Document> {
    const document = await db.document.create({
      data: {
        ownerId: input.ownerId,
        title: input.title,
        content: input.content,
        source: input.source,
        fileType: input.fileType,
        fileSize: input.fileSize,
        category: input.category,
        reportSeries: input.reportSeries,
        year: input.year,
        audience: input.audience,
        author: input.author,
        tags: JSON.stringify(input.tags || []),
        isActive: true,
      }
    })

    // Create chunks for RAG
    await this.createDocumentChunks(document.id, input.content)

    return this.mapToDocument(document)
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<Document | null> {
    const document = await db.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' }
        }
      }
    })

    if (!document) return null

    return this.mapToDocument(document)
  }

  /**
   * Update document
   */
  async updateDocument(id: string, input: UpdateDocumentInput): Promise<Document | null> {
    try {
      const existingDoc = await db.document.findUnique({ where: { id } })
      if (!existingDoc) return null

      const updateData: Record<string, unknown> = {}
      
      if (input.title) updateData.title = input.title
      if (input.content) {
        updateData.content = input.content
        // Recreate chunks if content changed
        await this.deleteDocumentChunks(id)
        await this.createDocumentChunks(id, input.content)
      }
      if (input.category) updateData.category = input.category
      if (input.reportSeries !== undefined) updateData.reportSeries = input.reportSeries
      if (input.year !== undefined) updateData.year = input.year
      if (input.audience) updateData.audience = input.audience
      if (input.author !== undefined) updateData.author = input.author
      if (input.tags) updateData.tags = JSON.stringify(input.tags)

      const document = await db.document.update({
        where: { id },
        data: updateData
      })

      return this.mapToDocument(document)
    } catch (error) {
      console.error('Error updating document:', error)
      return null
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      await db.document.delete({
        where: { id }
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * List documents with filters
   */
  async listDocuments(
    filter?: DocumentFilter,
    page: number = 1,
    pageSize: number = 10,
    ownerId?: string
  ): Promise<SearchResult> {
    const where: DocumentWhereInput = { isActive: true }

    if (ownerId) {
      where.ownerId = ownerId
    }
    
    if (filter?.category) {
      where.category = filter.category
    }
    if (filter?.reportSeries) {
      where.reportSeries = filter.reportSeries
    }
    if (filter?.audience) {
      where.audience = filter.audience
    }
    if (filter?.yearFrom || filter?.yearTo) {
      where.year = {}
      if (filter?.yearFrom) where.year.gte = filter.yearFrom
      if (filter?.yearTo) where.year.lte = filter.yearTo
    }

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      db.document.count({ where })
    ])

    // Filter by tags if specified
    let filteredDocs = documents
    if (filter?.tags && filter.tags.length > 0) {
      filteredDocs = documents.filter(doc => {
        const docTags: string[] = doc.tags ? JSON.parse(doc.tags) : []
        return filter.tags!.some(tag => docTags.includes(tag))
      })
    }

    // Filter by search query if specified
    if (filter?.searchQuery) {
      filteredDocs = filteredDocs.filter(doc => {
        const searchLower = filter.searchQuery!.toLowerCase()
        return (
          doc.title.toLowerCase().includes(searchLower) ||
          doc.content.toLowerCase().includes(searchLower)
        )
      })
    }

    return {
      documents: filteredDocs.map(d => this.mapToDocument(d)),
      total,
      page,
      pageSize,
      hasMore: total > page * pageSize
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(
    query: string,
    filter?: DocumentFilter,
    limit: number = 10,
    ownerId?: string
  ): Promise<SearchResult> {
    // Get base list
    const baseResult = await this.listDocuments(filter, 1, 100, ownerId)
    
    // Score and sort by relevance
    const scored = baseResult.documents
      .map(doc => ({
        doc,
        score: calculateRelevanceScore(query, doc)
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return {
      documents: scored.map(s => s.doc),
      total: scored.length,
      page: 1,
      pageSize: limit,
      hasMore: false
    }
  }

  /**
   * Get document categories
   */
  async getCategories(): Promise<string[]> {
    const documents = await db.document.findMany({
      where: { isActive: true },
      select: { category: true }
    })
    
    const categories = new Set(
      documents
        .map(d => d.category)
        .filter((c): c is string => c !== null)
    )
    
    return Array.from(categories).sort()
  }

  /**
   * Get report series
   */
  async getReportSeries(): Promise<string[]> {
    const documents = await db.document.findMany({
      where: { isActive: true },
      select: { reportSeries: true }
    })
    
    const series = new Set(
      documents
        .map(d => d.reportSeries)
        .filter((s): s is string => s !== null)
    )
    
    return Array.from(series).sort()
  }

  /**
   * Get all unique tags
   */
  async getTags(): Promise<string[]> {
    const documents = await db.document.findMany({
      where: { isActive: true },
      select: { tags: true }
    })
    
    const allTags = new Set<string>()
    for (const doc of documents) {
      if (doc.tags) {
        const tags: string[] = JSON.parse(doc.tags)
        tags.forEach(tag => allTags.add(tag))
      }
    }
    
    return Array.from(allTags).sort()
  }

  /**
   * Get document statistics
   */
  async getStatistics(): Promise<{
    total: number
    byCategory: Record<string, number>
    byYear: Record<number, number>
  }> {
    const documents = await db.document.findMany({
      where: { isActive: true },
      select: { category: true, year: true }
    })

    const byCategory: Record<string, number> = {}
    const byYear: Record<number, number> = {}

    for (const doc of documents) {
      if (doc.category) {
        byCategory[doc.category] = (byCategory[doc.category] || 0) + 1
      }
      if (doc.year) {
        byYear[doc.year] = (byYear[doc.year] || 0) + 1
      }
    }

    return {
      total: documents.length,
      byCategory,
      byYear
    }
  }

  // ==================== Private Methods ====================

  private mapToDocument(doc: DocumentRecordLike): Document {
    const parsedChunks = 'chunks' in doc
      ? doc.chunks?.map((c: DocumentChunkRecord) => ({
          id: c.id,
          documentId: c.documentId,
          content: c.content,
          chunkIndex: c.chunkIndex,
          metadata: c.metadata
            ? JSON.parse(c.metadata)
            : { startPosition: 0, endPosition: c.content.length, wordCount: c.content.split(/\s+/).length },
          createdAt: c.createdAt
        }))
      : undefined

    return {
      id: doc.id,
      ownerId: 'ownerId' in doc ? (doc.ownerId || undefined) : undefined,
      title: doc.title,
      content: doc.content,
      summary: doc.summary || undefined,
      source: doc.source || undefined,
      sourceUrl: doc.sourceUrl || undefined,
      category: (doc.category || 'Policy & Regulation') as Document['category'],
      reportSeries: doc.reportSeries || undefined,
      year: doc.year || undefined,
      audience: doc.audience as Document['audience'],
      author: doc.author || undefined,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      isActive: doc.isActive,
      fileType: doc.fileType || undefined,
      fileSize: doc.fileSize || undefined,
      language: doc.language,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunks: parsedChunks
    }
  }

  private async createDocumentChunks(documentId: string, content: string): Promise<void> {
    const chunks = createChunks(content)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      await db.documentChunk.create({
        data: {
          documentId,
          content: chunk.text,
          chunkIndex: i,
          metadata: JSON.stringify({
            startPosition: chunk.startIndex,
            endPosition: chunk.endIndex,
            wordCount: chunk.text.split(/\s+/).length
          })
        }
      })
    }
  }

  private async deleteDocumentChunks(documentId: string): Promise<void> {
    await db.documentChunk.deleteMany({
      where: { documentId }
    })
  }
}

// Export singleton instance
export const documentService = new DocumentService()
