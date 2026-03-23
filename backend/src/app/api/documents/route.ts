// =====================================================
// EPA Punjab EnvironmentGPT - Documents API Route
// Phase 1: Document Management Endpoints
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { documentService } from '@/lib/services/document-service'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import type { AudienceType, DocumentCategory, DocumentFilter } from '@/types'
import {
  createDocumentSchema,
  validateOrThrow,
  ValidationError
} from '@/lib/validators'
import { getRouteAuthContext } from '@/lib/route-middleware'

function isDocumentAccessible(ownerId: string | undefined, userId: string, role: string): boolean {
  return role === 'admin' || ownerId === userId
}

const AUDIENCE_TYPES: ReadonlySet<AudienceType> = new Set([
  'General Public',
  'Technical',
  'Policy Maker',
])

const DOCUMENT_CATEGORIES: ReadonlySet<DocumentCategory> = new Set([
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
])

function parseAudience(value: string | null): AudienceType | undefined {
  if (!value || !AUDIENCE_TYPES.has(value as AudienceType)) {
    return undefined
  }

  return value as AudienceType
}

function parseCategory(value: string | null): DocumentCategory | undefined {
  if (!value || !DOCUMENT_CATEGORIES.has(value as DocumentCategory)) {
    return undefined
  }

  return value as DocumentCategory
}

// Get documents list with filters
export async function GET(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const document = await documentService.getDocument(id)

      if (!document) {
        return NextResponse.json(
          { success: false, error: 'Document not found' },
          { status: 404 }
        )
      }

      if (!isDocumentAccessible(document.ownerId, user.userId, user.role)) {
        return NextResponse.json(
          { success: false, error: 'You do not have access to this document' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        success: true,
        document,
        timestamp: new Date()
      })
    }
    
    // Build filter from query params
    const filter: DocumentFilter & { page: number; pageSize: number } = {
      category: parseCategory(searchParams.get('category')),
      reportSeries: searchParams.get('reportSeries') || undefined,
      yearFrom: searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom')!) : undefined,
      yearTo: searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo')!) : undefined,
      audience: parseAudience(searchParams.get('audience')),
      searchQuery: searchParams.get('q') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '10'),
    }
    
    // Check if it's a search query
    const query = searchParams.get('query')
    
    let result
    if (query) {
      // Search documents
      result = await documentService.searchDocuments(
        query,
        filter,
        parseInt(searchParams.get('limit') || '10'),
        user.role === 'admin' ? undefined : user.userId
      )
    } else {
      // List documents
      result = await documentService.listDocuments(
        filter,
        filter.page,
        filter.pageSize,
        user.role === 'admin' ? undefined : user.userId
      )
    }
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve documents' },
      { status: 500 }
    )
  }
}

// Create new document
export async function POST(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
  if (authError || !user) return authError

  try {
    const body = await request.json()
    
    // Validate input
    const validatedInput = validateOrThrow(createDocumentSchema, body)
    
    // Create document
    const document = await documentService.createDocument({
      ...validatedInput,
      ownerId: user.userId
    })
    
    return NextResponse.json({
      success: true,
      document,
      timestamp: new Date()
    }, { status: 201 })
    
  } catch (error) {
    console.error('Create document error:', error)
    
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toApiResponse(), { status: 400 })
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create document' },
      { status: 500 }
    )
  }
}

// Legacy single-document lookup route
export async function PATCH(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    const document = await documentService.getDocument(id)
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!isDocumentAccessible(document.ownerId, user.userId, user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this document' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      success: true,
      document,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve document' },
      { status: 500 }
    )
  }
}

// Delete document
export async function DELETE(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    const document = await documentService.getDocument(id)

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!isDocumentAccessible(document.ownerId, user.userId, user.role)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this document' },
        { status: 403 }
      )
    }

    const deleted = await documentService.deleteDocument(id)
    
    return NextResponse.json({
      success: deleted,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
