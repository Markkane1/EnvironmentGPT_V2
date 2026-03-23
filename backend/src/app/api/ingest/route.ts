// =====================================================
// EPA Punjab EnvironmentGPT - Document Ingestion API
// Phase 2: File Upload and Document Processing
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { createDocumentSchema, createValidationErrorResponse, ValidationError } from '@/lib/validators'
import type { CreateDocumentInput } from '@/lib/validators'
import { embeddingService } from '@/lib/services/embedding-service'
import { authenticateToken } from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { getSupportedDocumentError, isSupportedDocumentFile } from '@/lib/utils/document-upload'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { sanitizeFilename } from '@/lib/utils/document-utils'
import { SYSTEM_LIMITS } from '@/lib/constants'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { z } from 'zod'

const ingestMetadataSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  category: z.enum([
    'Air Quality',
    'Water Resources',
    'Biodiversity',
    'Climate Change',
    'Waste Management',
    'Policy & Regulation',
    'Environmental Impact Assessment',
    'Industrial Pollution',
    'Agricultural Environment',
    'Urban Environment',
  ]).optional(),
  audience: z.enum(['General Public', 'Technical', 'Policy Maker']).optional(),
  author: z.string().trim().min(1).max(255).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
}).strict()

const reindexDocumentSchema = z.object({
  documentId: z.string().trim().min(1).max(255),
}).strict()

function canAccessDocument(ownerId: string | null | undefined, userId: string, role: string) {
  return role === 'admin' || ownerId === userId
}

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
async function handlePost(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const contentType = request.headers.get('content-type') || ''

    let validatedInput: CreateDocumentInput

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ path: 'file', message: 'No file provided' }],
            },
          },
          { status: 400 }
        )
      }

      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ path: 'file', message: 'File size exceeds 50MB limit' }],
            },
          },
          { status: 400 }
        )
      }

      if (!isSupportedDocumentFile(file)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ path: 'file', message: getSupportedDocumentError(SYSTEM_LIMITS.maxFileSize) }],
            },
          },
          { status: 400 }
        )
      }

      const sanitizedFilename = sanitizeFilename(file.name)
      const title = formData.get('title') as string || sanitizedFilename.replace(/\.[^/.]+$/, '')
      const category = formData.get('category') as string || 'Policy & Regulation'
      const audience = formData.get('audience') as string || 'General Public'
      const tagsResult = parseTagsField(formData.get('tags'))

      if (tagsResult.error) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ path: 'tags', message: tagsResult.error }],
            },
          },
          { status: 400 }
        )
      }

      const metadataResult = ingestMetadataSchema.safeParse({
        title,
        category,
        audience,
        author: (formData.get('author') as string) || undefined,
        year: formData.get('year') ? Number(formData.get('year')) : undefined,
        tags: tagsResult.tags,
      })

      if (!metadataResult.success) {
        return NextResponse.json(
          createValidationErrorResponse(metadataResult.error),
          { status: 400 }
        )
      }

      const extracted = await extractTextFromDocumentFile(file)

      const documentResult = createDocumentSchema.safeParse({
        title: metadataResult.data.title || sanitizedFilename.replace(/\.[^/.]+$/, ''),
        content: extracted.content,
        category: metadataResult.data.category || 'Policy & Regulation',
        audience: metadataResult.data.audience || 'General Public',
        author: metadataResult.data.author,
        year: metadataResult.data.year,
        tags: metadataResult.data.tags,
        source: sanitizedFilename,
        fileType: extracted.fileType,
        fileSize: extracted.fileSize,
      })

      if (!documentResult.success) {
        return NextResponse.json(
          createValidationErrorResponse(documentResult.error),
          { status: 400 }
        )
      }

      validatedInput = documentResult.data
    } else {
      // Handle JSON upload
      const body = await request.json()
      const documentResult = createDocumentSchema.safeParse(body)

      if (!documentResult.success) {
        return NextResponse.json(
          createValidationErrorResponse(documentResult.error),
          { status: 400 }
        )
      }

      validatedInput = documentResult.data
    }

    const chunksCreated = splitIntoChunks(validatedInput.content).length
    const document = await documentIngestionService.ingestDocument({
      ...validatedInput,
      ownerId: user.userId
    })
    
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
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

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

      if (!canAccessDocument(document.ownerId, user.userId, user.role)) {
        return NextResponse.json({
          success: false,
          error: 'You do not have access to this document'
        }, { status: 403 })
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
      where: {
        isActive: true,
        ...(user.role === 'admin' ? {} : { ownerId: user.userId })
      },
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
async function handlePut(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const body = await request.json()
    const parsed = reindexDocumentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const { documentId } = parsed.data
    
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

    if (!canAccessDocument(document.ownerId, user.userId, user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this document' },
        { status: 403 }
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
async function handleDelete(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, ownerId: true }
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!canAccessDocument(document.ownerId, user.userId, user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this document' },
        { status: 403 }
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


export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'upload')
export const PUT = withRateLimit((request) => handlePut(request as NextRequest), 'upload')
export const DELETE = withRateLimit((request) => handleDelete(request as NextRequest), 'upload')
