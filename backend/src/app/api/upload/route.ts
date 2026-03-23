// =====================================================
// EPA Punjab EnvironmentGPT - Document Upload API
// Phase 2: File Upload and Processing Endpoint
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { createDocumentSchema, createValidationErrorResponse, ValidationError } from '@/lib/validators'
import { authenticateToken } from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { DocumentCategory, AudienceType } from '@/types'
import { getSupportedDocumentError, isSupportedDocumentFile } from '@/lib/utils/document-upload'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { sanitizeFilename } from '@/lib/utils/document-utils'
import { SYSTEM_LIMITS } from '@/lib/constants'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { z } from 'zod'

const uploadMetadataSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(1000000).optional(),
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
  ]),
  audience: z.enum(['General Public', 'Technical', 'Policy Maker']).optional(),
  author: z.string().trim().min(1).max(255).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
}).strict()

function canAccessDocument(ownerId: string | null | undefined, userId: string, role: string) {
  return role === 'admin' || ownerId === userId
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

// ==================== API Handlers ====================

async function handlePost(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const formData = await request.formData()
    
    // Get form fields
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null) || undefined
    const content = (formData.get('content') as string | null) || ''
    const category = formData.get('category') as DocumentCategory
    const audience = (formData.get('audience') as AudienceType) || 'General Public'
    const author = (formData.get('author') as string) || undefined
    const year = formData.get('year') ? parseInt(formData.get('year') as string) : undefined
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

    let documentTitle = title
    let documentContent = content
    let uploadedFileType: string | undefined
    let uploadedFileSize: number | undefined

    const metadataResult = uploadMetadataSchema.safeParse({
      title,
      content: content || undefined,
      category,
      audience,
      author,
      year: Number.isNaN(year) ? undefined : year,
      tags: tagsResult.tags,
    })

    if (!metadataResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(metadataResult.error),
        { status: 400 }
      )
    }

    // Handle file upload
    if (file) {
      const sanitizedFilename = sanitizeFilename(file.name)

      // Validate file size (50MB max)
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

      // Extract text from file
      const extracted = await extractTextFromDocumentFile(file)
      documentContent = extracted.content
      uploadedFileType = extracted.fileType
      uploadedFileSize = extracted.fileSize
      documentTitle = documentTitle || sanitizedFilename.replace(/\.[^/.]+$/, '')

      // Validate content was extracted
      if (!documentContent || documentContent.length < 100) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [{ path: 'content', message: 'Could not extract sufficient content from file' }],
            },
          },
          { status: 400 }
        )
      }
    }

    // Validate we have content
    if (!documentContent || documentContent.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: [{ path: 'content', message: 'Content must be at least 100 characters' }],
          },
        },
        { status: 400 }
      )
    }

    const documentResult = createDocumentSchema.safeParse({
      title: documentTitle || 'Untitled Document',
      content: documentContent,
      category: metadataResult.data.category,
      audience: metadataResult.data.audience,
      author: metadataResult.data.author,
      year: metadataResult.data.year,
      tags: tagsResult.tags,
      source: file ? sanitizeFilename(file.name) : 'Manual Entry',
      fileType: uploadedFileType,
      fileSize: uploadedFileSize,
    })

    if (!documentResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(documentResult.error),
        { status: 400 }
      )
    }

    // Process document through the real ingestion pipeline
    const document = await documentIngestionService.ingestDocument({
      ...documentResult.data,
      ownerId: user.userId
    })

    return NextResponse.json({
      success: true,
      document,
      message: 'Document uploaded and processed successfully',
      timestamp: new Date()
    }, { status: 201 })

  } catch (error) {
    console.error('Upload API error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toApiResponse(), { status: 400 })
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

// Get upload status
export async function GET(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('documentId')
  
  if (!documentId) {
    return NextResponse.json(
      { success: false, error: 'Document ID is required' },
      { status: 400 }
    )
  }
  
  // In a real implementation, check processing status from a queue/cache
  // For now, return the document status
  const { db } = await import('@/lib/db')
  
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      _count: {
        select: { chunks: true }
      }
    }
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
  
  return NextResponse.json({
    success: true,
    status: {
      id: document.id,
      title: document.title,
      isActive: document.isActive,
      chunkCount: document._count.chunks,
      createdAt: document.createdAt
    },
    timestamp: new Date()
  })
}


export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'upload')
