// =====================================================
// EPA Punjab EnvironmentGPT - Input Validators
// Phase 1: Request Validation Schemas
// =====================================================

import { z } from 'zod'
import { SYSTEM_LIMITS } from '@/lib/constants'
import { getSupportedDocumentError, isSupportedDocumentFile } from '@/lib/utils/document-upload'

// ==================== Chat Validators ====================

export const chatMessageSchema = z.object({
  message: z.string()
    .min(SYSTEM_LIMITS.minQueryLength, `Message must be at least ${SYSTEM_LIMITS.minQueryLength} characters`)
    .max(SYSTEM_LIMITS.maxQueryLength, `Message must be less than ${SYSTEM_LIMITS.maxQueryLength} characters`)
    .transform(str => str.trim()),
  
  sessionId: z.string().optional(),
  
  documentIds: z.array(z.string()).max(10).optional(),
  
  audience: z.enum(['General Public', 'Technical', 'Policy Maker']).optional().default('General Public'),
  
  filters: z.object({
    category: z.string().optional(),
    reportSeries: z.string().optional(),
    yearFrom: z.number().int().min(1990).max(2100).optional(),
    yearTo: z.number().int().min(1990).max(2100).optional(),
    audience: z.enum(['General Public', 'Technical', 'Policy Maker']).optional(),
    tags: z.array(z.string()).optional(),
    searchQuery: z.string().max(500).optional(),
  }).optional(),
  
  stream: z.boolean().optional().default(false),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>

// ==================== Document Validators ====================

export const documentCategorySchema = z.enum([
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

export const audienceSchema = z.enum(['General Public', 'Technical', 'Policy Maker'])

export const createDocumentSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(500, 'Title must be less than 500 characters'),
  
  content: z.string()
    .min(100, 'Content must be at least 100 characters'),
  
  source: z.string().max(500).optional(),
  
  sourceUrl: z.string().url().optional().or(z.literal('')),
  
  category: documentCategorySchema,
  
  reportSeries: z.string().max(200).optional(),
  
  year: z.number().int().min(1900).max(2100).optional(),
  
  audience: audienceSchema.default('General Public'),
  
  author: z.string().max(200).optional(),
  
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  
  language: z.string().length(2).optional().default('en'),

  fileType: z.string().max(200).optional(),

  fileSize: z.number().int().min(0).optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const updateDocumentSchema = createDocumentSchema.partial()

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

export const documentFilterSchema = z.object({
  category: documentCategorySchema.optional(),
  reportSeries: z.string().optional(),
  yearFrom: z.number().int().min(1990).max(2100).optional(),
  yearTo: z.number().int().min(1990).max(2100).optional(),
  audience: audienceSchema.optional(),
  tags: z.array(z.string()).optional(),
  searchQuery: z.string().max(500).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(10),
  sortBy: z.enum(['relevance', 'date', 'title']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type DocumentFilterInput = z.infer<typeof documentFilterSchema>

// ==================== Feedback Validators ====================

export const feedbackSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  rating: z.number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: z.string().max(1000).optional(),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>

// ==================== Session Validators ====================

export const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
  documentId: z.string().optional(),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>

export const sessionQuerySchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(50).optional().default(10),
  sortBy: z.enum(['date', 'title', 'messages']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type SessionQueryInput = z.infer<typeof sessionQuerySchema>

// ==================== Search Validators ====================

export const searchSchema = z.object({
  query: z.string()
    .min(2, 'Search query must be at least 2 characters')
    .max(200, 'Search query must be less than 200 characters'),
  
  filters: documentFilterSchema.optional(),
  
  limit: z.number().int().min(1).max(50).optional().default(10),
  
  offset: z.number().int().min(0).optional().default(0),
})

export type SearchInput = z.infer<typeof searchSchema>

// ==================== File Upload Validators ====================

export const fileUploadSchema = z.object({
  file: z.custom<File>((file) => {
    if (!file) return false
    if (file.size > SYSTEM_LIMITS.maxFileSize) return false
    if (!isSupportedDocumentFile(file)) return false
    return true
  }, {
    message: getSupportedDocumentError(SYSTEM_LIMITS.maxFileSize)
  }),
  
  category: documentCategorySchema,
  
  audience: audienceSchema.default('General Public'),
  
  tags: z.array(z.string().max(50)).max(10).optional(),
})

export type FileUploadInput = z.infer<typeof fileUploadSchema>

// ==================== Pagination Validators ====================

export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// ==================== ID Validators ====================

export const idSchema = z.string().min(1, 'ID is required')

export const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid CUID format')

// ==================== Date Range Validators ====================

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(data => data.startDate <= data.endDate, {
  message: 'Start date must be before or equal to end date',
})

export type DateRangeInput = z.infer<typeof dateRangeSchema>

// ==================== API Response Helpers ====================

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(result.error.issues)
  }
  return result.data
}

export class ValidationError extends Error {
  constructor(public errors: z.ZodIssue[]) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
  
  toApiResponse() {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: this.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      },
    }
  }
}
