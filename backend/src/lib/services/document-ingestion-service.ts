// =====================================================
// EPA Punjab EnvironmentGPT - Document Ingestion Service
// Phase 2: Document Processing & Chunking Pipeline
// =====================================================

import { db } from '@/lib/db'
import { embeddingService } from './embedding-service'
import { RAG_CONFIG } from '@/lib/constants'
import type { Document, DocumentChunk } from '@/types'
import type { CreateDocumentInput } from '@/lib/validators'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'

// ==================== Document Ingestion Service ====================

export class DocumentIngestionService {
  /**
   * Ingest a document from text content
   */
  async ingestDocument(input: CreateDocumentInput & { content: string }): Promise<Document> {
    try {
      // Create the document
      const document = await db.document.create({
        data: {
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

      // Create chunks
      await this.createChunks(document.id, input.content)

      // Generate embeddings for chunks
      await embeddingService.processDocumentEmbeddings(document.id)

      return {
        id: document.id,
        title: document.title,
        content: document.content,
        category: document.category || undefined,
        reportSeries: document.reportSeries || undefined,
        year: document.year || undefined,
        audience: document.audience,
        author: document.author || undefined,
        tags: input.tags || [],
        fileType: document.fileType || undefined,
        fileSize: document.fileSize || undefined,
        language: document.language,
        isActive: document.isActive,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }
    } catch (error) {
      console.error('Failed to ingest document:', error)
      throw error
    }
  }

  /**
   * Process uploaded file and extract content
   */
  async processFile(file: File): Promise<{ content: string; metadata: Record<string, unknown> }> {
    const extracted = await extractTextFromDocumentFile(file)

    return {
      content: extracted.content,
      metadata: {
        fileName: file.name,
        fileSize: extracted.fileSize,
        fileType: extracted.fileType,
        extension: extracted.extension,
      },
    }
  }

  /**
   * Create chunks from document content
   */
  private async createChunks(documentId: string, content: string): Promise<void> {
    const chunks = this.splitIntoChunks(
      content, 
      RAG_CONFIG.defaultChunkSize,
      RAG_CONFIG.chunkOverlap
    )

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      await db.documentChunk.create({
        data: {
          documentId,
          content: chunk.text,
          chunkIndex: i,
          metadata: JSON.stringify({
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            wordCount: chunk.wordCount,
          })
        }
      })
    }
  }

  /**
   * Split text into chunks with overlap
   */
  private splitIntoChunks(
    text: string, 
    chunkSize: number = 512, 
    overlap: number = 50
  ): Array<{ text: string; startIndex: number; endIndex: number; wordCount: number }> {
    const words = text.split(/\s+/)
    const chunks: Array<{ text: string; startIndex: number; endIndex: number; wordCount: number }> = []
    
    let startIndex = 0
    while (startIndex < words.length) {
      const endIndex = Math.min(startIndex + chunkSize, words.length)
      const chunkWords = words.slice(startIndex, endIndex)
      const chunkText = chunkWords.join(' ')
      
      chunks.push({
        text: chunkText,
        startIndex,
        endIndex,
        wordCount: chunkWords.length
      })
      
      if (endIndex >= words.length) break
      startIndex = endIndex - overlap
    }
    
    return chunks
  }

  /**
   * Reindex a document (regenerate chunks and embeddings)
   */
  async reindexDocument(documentId: string): Promise<void> {
    try {
      // Get the document
      const document = await db.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        throw new Error('Document not found')
      }

      // Delete existing chunks
      await db.documentChunk.deleteMany({
        where: { documentId }
      })

      // Create new chunks
      await this.createChunks(documentId, document.content)

      // Generate embeddings
      await embeddingService.processDocumentEmbeddings(documentId)
    } catch (error) {
      console.error('Failed to reindex document:', error)
      throw error
    }
  }

  /**
   * Get ingestion status for a document
   */
  async getIngestionStatus(documentId: string): Promise<{
    documentExists: boolean
    totalChunks: number
    chunksWithEmbeddings: number
    isComplete: boolean
  }> {
    try {
      const document = await db.document.findUnique({
        where: { id: documentId },
        include: {
          chunks: true
        }
      })

      if (!document) {
        return {
          documentExists: false,
          totalChunks: 0,
          chunksWithEmbeddings: 0,
          isComplete: false
        }
      }

      const totalChunks = document.chunks.length
      const chunksWithEmbeddings = document.chunks.filter(c => c.embedding).length

      return {
        documentExists: true,
        totalChunks,
        chunksWithEmbeddings,
        isComplete: totalChunks > 0 && chunksWithEmbeddings === totalChunks
      }
    } catch (error) {
      console.error('Failed to get ingestion status:', error)
      throw error
    }
  }

  /**
   * Batch ingest multiple documents
   */
  async batchIngest(
    documents: Array<CreateDocumentInput & { content: string }>
  ): Promise<{ succeeded: string[]; failed: Array<{ title: string; error: string }> }> {
    const succeeded: string[] = []
    const failed: Array<{ title: string; error: string }> = []

    for (const doc of documents) {
      try {
        const result = await this.ingestDocument(doc)
        succeeded.push(result.id)
      } catch (error) {
        failed.push({
          title: doc.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return { succeeded, failed }
  }
}

// Export singleton instance
export const documentIngestionService = new DocumentIngestionService()
