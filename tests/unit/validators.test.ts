import { z } from 'zod'
import {
  ValidationError,
  audienceSchema,
  chatMessageSchema,
  createDocumentSchema,
  createSessionSchema,
  createValidationErrorResponse,
  cuidSchema,
  dateRangeSchema,
  documentCategorySchema,
  documentFilterSchema,
  feedbackSchema,
  fileUploadSchema,
  formatZodError,
  idSchema,
  paginationSchema,
  searchSchema,
  sessionQuerySchema,
  updateDocumentSchema,
  validateOrThrow,
} from '@/lib/validators'

function createTestFile(name: string, type: string, contents: string = 'sample') {
  return new File([contents], name, { type })
}

describe('validators', () => {
  describe('chatMessageSchema', () => {
    it('should parse a valid chat payload and trim the message', () => {
      const result = chatMessageSchema.parse({
        message: '  What is the AQI in Lahore?  ',
        audience: 'General Public',
        stream: true,
      })

      expect(result.message).toBe('What is the AQI in Lahore?')
      expect(result.stream).toBe(true)
    })

    it('should reject HTML-like markup in chat messages', () => {
      expect(chatMessageSchema.safeParse({ message: '<script>alert(1)</script>' }).success).toBe(false)
    })

    it('should reject empty or too-short chat messages', () => {
      expect(chatMessageSchema.safeParse({ message: '' }).success).toBe(false)
      expect(chatMessageSchema.safeParse({ message: 'hi' }).success).toBe(false)
    })

    it('should reject invalid filter field types and oversized arrays', () => {
      expect(chatMessageSchema.safeParse({
        message: 'Valid question about air quality',
        documentIds: new Array(11).fill('doc'),
      }).success).toBe(false)
      expect(chatMessageSchema.safeParse({
        message: 'Valid question about air quality',
        filters: { yearFrom: '2024' },
      }).success).toBe(false)
    })
  })

  describe('documentCategorySchema and audienceSchema', () => {
    it('should accept valid enum values', () => {
      expect(documentCategorySchema.parse('Air Quality')).toBe('Air Quality')
      expect(audienceSchema.parse('Technical')).toBe('Technical')
    })

    it('should reject invalid enum values', () => {
      expect(documentCategorySchema.safeParse('Politics').success).toBe(false)
      expect(audienceSchema.safeParse('Everyone').success).toBe(false)
    })
  })

  describe('createDocumentSchema and updateDocumentSchema', () => {
    const validDocument = {
      title: 'Punjab Smog Assessment',
      content: 'A'.repeat(120),
      category: 'Air Quality',
      audience: 'General Public',
      tags: ['smog', 'lahore'],
      year: 2024,
      sourceUrl: 'https://epunjab.gov.pk/report',
    } as const

    it('should parse a valid document payload and apply defaults', () => {
      const result = createDocumentSchema.parse(validDocument)

      expect(result.language).toBe('en')
      expect(result.tags).toEqual(['smog', 'lahore'])
    })

    it('should reject HTML-like markup and too-short content', () => {
      expect(createDocumentSchema.safeParse({
        ...validDocument,
        title: '<b>Unsafe</b>',
      }).success).toBe(false)

      expect(createDocumentSchema.safeParse({
        ...validDocument,
        content: 'short text',
      }).success).toBe(false)
    })

    it('should reject out-of-range year and oversized file size values', () => {
      expect(createDocumentSchema.safeParse({
        ...validDocument,
        year: 1800,
      }).success).toBe(false)

      expect(createDocumentSchema.safeParse({
        ...validDocument,
        fileSize: 60 * 1024 * 1024,
      }).success).toBe(false)
    })

    it('should allow partial updates but still reject invalid field types', () => {
      expect(updateDocumentSchema.parse({ title: 'Updated title' })).toEqual({
        title: 'Updated title',
        audience: 'General Public',
        tags: [],
        language: 'en',
      })
      expect(updateDocumentSchema.safeParse({ year: '2024' }).success).toBe(false)
    })
  })

  describe('documentFilterSchema', () => {
    it('should parse a valid filter payload with defaults', () => {
      const result = documentFilterSchema.parse({
        category: 'Air Quality',
        searchQuery: 'lahore',
      })

      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
      expect(result.sortBy).toBe('date')
      expect(result.sortOrder).toBe('desc')
    })

    it('should reject invalid pagination or year boundaries', () => {
      expect(documentFilterSchema.safeParse({ page: 0 }).success).toBe(false)
      expect(documentFilterSchema.safeParse({ yearFrom: 1800 }).success).toBe(false)
      expect(documentFilterSchema.safeParse({ pageSize: 101 }).success).toBe(false)
    })
  })

  describe('feedbackSchema', () => {
    it('should parse valid feedback', () => {
      expect(feedbackSchema.parse({ messageId: 'msg-1', rating: 5, comment: 'Helpful answer' })).toEqual({
        messageId: 'msg-1',
        rating: 5,
        comment: 'Helpful answer',
      })
    })

    it('should reject ratings outside the allowed range', () => {
      expect(feedbackSchema.safeParse({ messageId: 'msg-1', rating: 0 }).success).toBe(false)
      expect(feedbackSchema.safeParse({ messageId: 'msg-1', rating: 6 }).success).toBe(false)
    })

    it('should reject HTML-like markup and wrong field types', () => {
      expect(feedbackSchema.safeParse({ messageId: 'msg-1', rating: 3, comment: '<p>unsafe</p>' }).success).toBe(false)
      expect(feedbackSchema.safeParse({ messageId: 123, rating: 3 }).success).toBe(false)
    })
  })

  describe('createSessionSchema and sessionQuerySchema', () => {
    it('should parse valid session creation and query payloads', () => {
      expect(createSessionSchema.parse({ title: ' Session 1 ', documentId: 'doc-1' })).toEqual({
        title: 'Session 1',
        documentId: 'doc-1',
      })
      expect(sessionQuerySchema.parse({})).toEqual({
        page: 1,
        pageSize: 10,
        sortBy: 'date',
        sortOrder: 'desc',
      })
    })

    it('should reject invalid session titles and pagination boundaries', () => {
      expect(createSessionSchema.safeParse({ title: '<script>' }).success).toBe(false)
      expect(sessionQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false)
      expect(sessionQuerySchema.safeParse({ sortOrder: 'up' }).success).toBe(false)
    })
  })

  describe('searchSchema', () => {
    it('should parse valid search payloads with defaults', () => {
      expect(searchSchema.parse({ query: 'air quality' })).toEqual({
        query: 'air quality',
        limit: 10,
        offset: 0,
      })
    })

    it('should reject short queries, HTML-like markup, and bad numeric fields', () => {
      expect(searchSchema.safeParse({ query: 'a' }).success).toBe(false)
      expect(searchSchema.safeParse({ query: 'air<script>' }).success).toBe(false)
      expect(searchSchema.safeParse({ query: 'air quality', limit: 0 }).success).toBe(false)
      expect(searchSchema.safeParse({ query: 'air quality', offset: -1 }).success).toBe(false)
    })
  })

  describe('fileUploadSchema', () => {
    it('should accept supported files and a valid metadata payload', () => {
      const result = fileUploadSchema.parse({
        file: createTestFile('report.pdf', 'application/pdf'),
        category: 'Air Quality',
        audience: 'Technical',
        tags: ['report'],
      })

      expect(result.file.name).toBe('report.pdf')
      expect(result.audience).toBe('Technical')
    })

    it('should reject unsupported file types, oversized tags arrays, and bad field types', () => {
      expect(fileUploadSchema.safeParse({
        file: createTestFile('script.exe', 'application/octet-stream'),
        category: 'Air Quality',
      }).success).toBe(false)

      expect(fileUploadSchema.safeParse({
        file: createTestFile('report.pdf', 'application/pdf'),
        category: 'Air Quality',
        tags: new Array(11).fill('x'),
      }).success).toBe(false)

      expect(fileUploadSchema.safeParse({
        file: 'not-a-file',
        category: 'Air Quality',
      }).success).toBe(false)
    })
  })

  describe('paginationSchema, idSchema, cuidSchema, and dateRangeSchema', () => {
    it('should parse valid pagination, ids, and date ranges', () => {
      expect(paginationSchema.parse({})).toEqual({
        page: 1,
        pageSize: 10,
        sortOrder: 'desc',
      })
      expect(idSchema.parse('doc-1')).toBe('doc-1')
      expect(cuidSchema.parse('c123456789012345678901234')).toBe('c123456789012345678901234')

      const dateRange = dateRangeSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      })

      expect(dateRange.startDate).toBeInstanceOf(Date)
      expect(dateRange.endDate).toBeInstanceOf(Date)
    })

    it('should reject invalid pagination fields, blank ids, malformed cuids, and reversed dates', () => {
      expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
      expect(idSchema.safeParse('').success).toBe(false)
      expect(cuidSchema.safeParse('not-a-cuid').success).toBe(false)
      expect(dateRangeSchema.safeParse({
        startDate: '2025-01-01',
        endDate: '2024-01-01',
      }).success).toBe(false)
    })
  })

  describe('validator helpers', () => {
    const sampleSchema = z.object({
      name: z.string().min(2),
      count: z.number().int().min(1),
    })

    it('should return parsed values from validateOrThrow on valid input', () => {
      expect(validateOrThrow(sampleSchema, { name: 'AQ', count: 2 })).toEqual({
        name: 'AQ',
        count: 2,
      })
    })

    it('should throw ValidationError and format issues for invalid input', () => {
      expect(() => validateOrThrow(sampleSchema, { name: 'A', count: 0 })).toThrow(ValidationError)

      const error = sampleSchema.safeParse({ name: 'A', count: 0 }).error!
      expect(formatZodError(error)).toEqual([
        { path: 'name', message: expect.any(String) },
        { path: 'count', message: expect.any(String) },
      ])
    })

    it('should build API-friendly validation responses', () => {
      const error = sampleSchema.safeParse({ name: 'A', count: 0 }).error!
      const response = createValidationErrorResponse(error)

      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [
            { path: 'name', message: expect.any(String) },
            { path: 'count', message: expect.any(String) },
          ],
        },
      })
    })

    it('should expose ValidationError.toApiResponse for thrown validation failures', () => {
      const zodError = sampleSchema.safeParse({ name: 'A', count: 0 }).error!
      const error = new ValidationError(zodError.issues)

      expect(error.name).toBe('ValidationError')
      expect(error.toApiResponse()).toEqual(createValidationErrorResponse(zodError))
    })
  })
})
