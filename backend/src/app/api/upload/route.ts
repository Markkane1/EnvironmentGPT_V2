// =====================================================
// EPA Punjab EnvironmentGPT - Document Upload API
// Phase 2: File Upload and Processing Endpoint
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { documentIngestionService } from '@/lib/services/document-ingestion-service'
import { createDocumentSchema, validateOrThrow, ValidationError } from '@/lib/validators'
import { DocumentCategory, AudienceType } from '@/types'
import { getSupportedDocumentError, isSupportedDocumentFile } from '@/lib/utils/document-upload'
import { extractTextFromDocumentFile } from '@/lib/utils/document-extraction'
import { SYSTEM_LIMITS } from '@/lib/constants'

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Get form fields
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const category = formData.get('category') as DocumentCategory
    const audience = (formData.get('audience') as AudienceType) || 'General Public'
    const author = (formData.get('author') as string) || undefined
    const year = formData.get('year') ? parseInt(formData.get('year') as string) : undefined
    const tagsResult = parseTagsField(formData.get('tags'))

    if (tagsResult.error) {
      return NextResponse.json(
        { success: false, error: tagsResult.error },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category is required' },
        { status: 400 }
      )
    }

    let documentTitle = title
    let documentContent = content
    let uploadedFileType: string | undefined
    let uploadedFileSize: number | undefined

    // Handle file upload
    if (file) {
      // Validate file size (50MB max)
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

      // Extract text from file
      const extracted = await extractTextFromDocumentFile(file)
      documentContent = extracted.content
      uploadedFileType = extracted.fileType
      uploadedFileSize = extracted.fileSize
      documentTitle = documentTitle || file.name.replace(/\.[^/.]+$/, '')

      // Validate content was extracted
      if (!documentContent || documentContent.length < 100) {
        return NextResponse.json(
          { success: false, error: 'Could not extract sufficient content from file' },
          { status: 400 }
        )
      }
    }

    // Validate we have content
    if (!documentContent || documentContent.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Content must be at least 100 characters' },
        { status: 400 }
      )
    }

    const validatedInput = validateOrThrow(createDocumentSchema, {
      title: documentTitle || 'Untitled Document',
      content: documentContent,
      category,
      audience,
      author,
      year,
      tags: tagsResult.tags,
      source: file?.name || 'Manual Entry',
      fileType: uploadedFileType,
      fileSize: uploadedFileSize,
    })

    // Process document through the real ingestion pipeline
    const document = await documentIngestionService.ingestDocument(validatedInput)

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
