// =====================================================
// EPA Punjab EnvironmentGPT - Document Ingestion API
// Phase 2: File Upload and Document Processing
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { createDocumentSchema, validateOrThrow, ValidationError } from '@/lib/validators'
import type { CreateDocumentInput } from '@/lib/validators'
import { embeddingService } from '@/lib/services/embedding-service'
import { getSupportedDocumentError, isSupportedDocumentFile } from '@/lib/utils/document-upload'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { SYSTEM_LIMITS } from '@/lib/constants'

// ==================== Helper Functions ====================

function splitIntoChunks(
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

function parseTagsField(rawTags: FormDataEntryValue | null): {
  tags: string[]
  error?: string
} {
  if (!rawTags) {
    return { tags: [] }
  }

  if (typeof rawTags !== 'string') {
    return { tags: [], error: 'Tags must be provided as a JSON array of strings' }
  }

  try {
    const parsed = JSON.parse(rawTags)

    if (!Array.isArray(parsed) || !parsed.every(tag => typeof tag === 'string')) {
      return { tags: [], error: 'Tags must be provided as a JSON array of strings' }
    }

    return { tags: parsed }
  } catch {
    return { tags: [], error: 'Tags must be provided as a JSON array of strings' }
  }
}

// Upload/ingest a document
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let validatedInput: CreateDocumentInput

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        )
      }

      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'File size exceeds 50MB limit' },
          { status: 400 }
        )
      }

      if (!isSupportedDocumentFile(file)) {
        return NextResponse.json(
          { success: false, error: getSupportedDocumentError(SYSTEM_LIMITS.maxFileSize) },
          { status: 400 }
        )
      }

      const title = formData.get('title') as string || file.name.replace(/\.[^/.]+$/, '')
      const category = formData.get('category') as string || 'Policy & Regulation'
      const audience = formData.get('audience') as string || 'General Public'
      const tagsResult = parseTagsField(formData.get('tags'))

      if (tagsResult.error) {
        return NextResponse.json(
          { success: false, error: tagsResult.error },
          { status: 400 }
        )
      }

      const extracted = await extractTextFromDocumentFile(file)

      validatedInput = validateOrThrow(createDocumentSchema, {
        title,
        content: extracted.content,
        category,
        audience,
        author: (formData.get('author') as string) || undefined,
        year: formData.get('year') ? Number(formData.get('year')) : undefined,
        tags: tagsResult.tags,
        source: file.name,
        fileType: extracted.fileType,
        fileSize: extracted.fileSize,
      })
    } else {
      // Handle JSON upload
      const body = await request.json()

      validatedInput = validateOrThrow(createDocumentSchema, body)
    }

    const chunksCreated = splitIntoChunks(validatedInput.content).length
    const document = await documentIngestionService.ingestDocument(validatedInput)
    
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        chunksCreated
      },
      message: 'Document ingested successfully',
      timestamp: new Date()
    }, { status: 201 })
    
  } catch (error) {
    console.error('Document ingestion error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toApiResponse(), { status: 400 })
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to ingest document' },
      { status: 500 }
    )
  }
}

// Get ingestion status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    
    if (documentId) {
      const document = await db.document.findUnique({
        where: { id: documentId },
        include: {
          chunks: true
        }
      })
      
      if (!document) {
        return NextResponse.json({
          success: false,
          error: 'Document not found'
        }, { status: 404 })
      }
      
      const totalChunks = document.chunks.length
      const chunksWithEmbeddings = document.chunks.filter(c => c.embedding).length
      
      return NextResponse.json({
        success: true,
        status: {
          documentExists: true,
          totalChunks,
          chunksWithEmbeddings,
          isComplete: totalChunks > 0 && chunksWithEmbeddings === totalChunks
        },
        timestamp: new Date()
      })
    }
    
    // Get all documents with status
    const documents = await db.document.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { chunks: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    
    return NextResponse.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        year: doc.year,
        audience: doc.audience,
        chunkCount: doc._count.chunks,
        createdAt: doc.createdAt
      })),
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Failed to get documents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get documents' },
      { status: 500 }
    )
  }
}

// Reindex document
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId } = body
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    // Get the document
    const document = await db.document.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }
    
    // Delete existing chunks
    await db.documentChunk.deleteMany({
      where: { documentId }
    })
    
    // Create new chunks
    const chunks = splitIntoChunks(document.content)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await embeddingService.generateEmbedding(chunk.text)
      
      await db.documentChunk.create({
        data: {
          documentId,
          content: chunk.text,
          chunkIndex: i,
          embedding: JSON.stringify(embedding),
          metadata: JSON.stringify({
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            wordCount: chunk.wordCount,
          })
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Document reindexed successfully',
      chunksCreated: chunks.length,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Failed to reindex document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reindex document' },
      { status: 500 }
    )
  }
}

// Delete document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    await db.document.delete({
      where: { id: documentId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Failed to delete document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
