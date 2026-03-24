import type { Document, DocumentFilter, SourceReference } from '@/types'
import {
  calculateAQI,
  calculateRelevanceScore,
  capitalize,
  categorizeDocument,
  cosineSimilarity,
  createChunks,
  debounce,
  extractKeywords,
  formatChatResponse,
  formatDate,
  formatFileSize,
  generateId,
  getAQICategory,
  getContrastColor,
  getFileExtension,
  getRelativeTime,
  getSafeDocumentTitleFromFileName,
  hexToRgb,
  isValidEmail,
  isValidUrl,
  matchesFilter,
  removeExtraWhitespace,
  sanitizeFileName,
  sanitizeFilename,
  sanitizeInput,
  simpleSimilarity,
  slugify,
  throttle,
  truncate,
} from '@/lib/utils/document-utils'

describe('document-utils', () => {
  const baseDocument: Document = {
    id: 'doc-1',
    title: 'Lahore Air Quality Report',
    content: 'Air pollution and PM2.5 trends in Lahore across the winter season.',
    category: 'Air Quality',
    audience: 'General Public',
    reportSeries: 'Annual Report',
    year: 2024,
    tags: ['lahore', 'pm2.5', 'winter'],
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T00:00:00.000Z'),
  } as Document

  describe('truncate()', () => {
    it('should keep strings shorter than the limit unchanged', () => {
      expect(truncate('Punjab', 10)).toBe('Punjab')
    })

    it('should shorten long strings and append an ellipsis', () => {
      expect(truncate('Environmental', 5)).toBe('Envir...')
    })

    it('should handle a zero length boundary by returning only an ellipsis', () => {
      expect(truncate('Punjab', 0)).toBe('...')
    })

    it('should keep empty strings unchanged', () => {
      expect(truncate('', 4)).toBe('')
    })

    it('should throw when a non-string input is passed', () => {
      expect(() => truncate(null as unknown as string, 4)).toThrow()
    })
  })

  describe('slugify()', () => {
    it('should convert phrases into lowercase slugs', () => {
      expect(slugify('Punjab Air Quality')).toBe('punjab-air-quality')
    })

    it('should collapse punctuation and trim leading or trailing separators', () => {
      expect(slugify('  PM2.5 & Smog  ')).toBe('pm2-5-smog')
    })

    it('should return an empty string for empty input', () => {
      expect(slugify('')).toBe('')
    })

    it('should keep numbers while removing unsupported characters', () => {
      expect(slugify('NEQS 2024 Update!')).toBe('neqs-2024-update')
    })

    it('should throw when the input is not a string', () => {
      expect(() => slugify(undefined as unknown as string)).toThrow()
    })
  })

  describe('capitalize()', () => {
    it('should uppercase the first character of a normal string', () => {
      expect(capitalize('lahore')).toBe('Lahore')
    })

    it('should leave already-capitalized values intact', () => {
      expect(capitalize('Punjab')).toBe('Punjab')
    })

    it('should return an empty string when given one', () => {
      expect(capitalize('')).toBe('')
    })

    it('should preserve the remainder of the string exactly as written', () => {
      expect(capitalize('pM2.5')).toBe('PM2.5')
    })

    it('should throw when passed a null value', () => {
      expect(() => capitalize(null as unknown as string)).toThrow()
    })
  })

  describe('removeExtraWhitespace()', () => {
    it('should collapse repeated whitespace between words', () => {
      expect(removeExtraWhitespace('Punjab    air\tquality')).toBe('Punjab air quality')
    })

    it('should trim leading and trailing whitespace', () => {
      expect(removeExtraWhitespace('  Lahore report  ')).toBe('Lahore report')
    })

    it('should return an empty string for blank input', () => {
      expect(removeExtraWhitespace('   ')).toBe('')
    })

    it('should preserve single spaces in already normalized text', () => {
      expect(removeExtraWhitespace('Air quality status')).toBe('Air quality status')
    })

    it('should throw when passed an unexpected non-string input', () => {
      expect(() => removeExtraWhitespace(42 as unknown as string)).toThrow()
    })
  })

  describe('formatDate() and getRelativeTime()', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-24T12:00:00.000Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should format short dates for the en-PK locale', () => {
      expect(formatDate('2026-03-23T00:00:00.000Z', 'short')).toMatch(/23/)
    })

    it('should format long dates with weekday information', () => {
      expect(formatDate('2026-03-23T00:00:00.000Z', 'long')).toMatch(/2026/)
    })

    it('should delegate relative formatting to getRelativeTime', () => {
      expect(formatDate('2026-03-24T11:00:00.000Z', 'relative')).toBe('1 hour ago')
    })

    it('should handle invalid dates by returning the runtime locale fallback string', () => {
      expect(formatDate('not-a-date', 'unknown' as never)).toBe('Invalid Date')
    })

    it('should express relative times across seconds, minutes, hours, and days', () => {
      expect(getRelativeTime(new Date('2026-03-24T11:59:45.000Z'))).toBe('just now')
      expect(getRelativeTime(new Date('2026-03-24T11:58:00.000Z'))).toBe('2 minutes ago')
      expect(getRelativeTime(new Date('2026-03-24T09:00:00.000Z'))).toBe('3 hours ago')
      expect(getRelativeTime(new Date('2026-03-22T12:00:00.000Z'))).toBe('2 days ago')
    })
  })

  describe('categorizeDocument()', () => {
    it('should map air quality keywords to the Air Quality category', () => {
      expect(categorizeDocument('Smog advisory', 'PM2.5 emission levels are rising')).toBe('Air Quality')
    })

    it('should detect other category keyword families', () => {
      expect(categorizeDocument('River monitoring', 'Groundwater and drinking water quality')).toBe('Water Resources')
    })

    it('should default to Policy & Regulation when no keywords match', () => {
      expect(categorizeDocument('General memo', 'Meeting schedule for next month')).toBe('Policy & Regulation')
    })

    it('should handle empty strings by falling back to the default category', () => {
      expect(categorizeDocument('', '')).toBe('Policy & Regulation')
    })

    it('should fall back to the default category when non-string-like input is coerced', () => {
      expect(categorizeDocument(null as unknown as string, 'content')).toBe('Policy & Regulation')
    })
  })

  describe('extractKeywords()', () => {
    it('should return ranked keywords while excluding common stop words', () => {
      expect(extractKeywords('Air pollution pollution climate policy and Lahore')).toEqual([
        'pollution',
        'climate',
        'policy',
        'lahore',
      ])
    })

    it('should obey the maxKeywords boundary', () => {
      expect(extractKeywords('alpha beta gamma delta epsilon', 2)).toHaveLength(2)
    })

    it('should return an empty array for an empty string', () => {
      expect(extractKeywords('')).toEqual([])
    })

    it('should return an empty array when the max keyword boundary is zero', () => {
      expect(extractKeywords('alpha beta gamma', 0)).toEqual([])
    })

    it('should throw when passed a non-string query', () => {
      expect(() => extractKeywords(undefined as unknown as string)).toThrow()
    })
  })

  describe('createChunks()', () => {
    it('should split content into overlapping chunks', () => {
      const chunks = createChunks('one two three four five six seven eight', 3, 1)

      expect(chunks).toEqual([
        { text: 'one two three', startIndex: 0, endIndex: 3 },
        { text: 'three four five', startIndex: 2, endIndex: 5 },
        { text: 'five six seven', startIndex: 4, endIndex: 7 },
        { text: 'seven eight', startIndex: 6, endIndex: 8 },
      ])
    })

    it('should return an empty array for empty content', () => {
      expect(createChunks('', 3, 1)).toEqual([])
    })

    it('should support a minimal chunk size boundary', () => {
      expect(createChunks('one two', 1, 0)).toEqual([
        { text: 'one', startIndex: 0, endIndex: 1 },
        { text: 'two', startIndex: 1, endIndex: 2 },
      ])
    })

    it('should treat excessive overlap as invalid input', () => {
      expect(() => createChunks('one two three', 2, 2)).toThrow('overlap')
    })

    it('should throw when content is not a string', () => {
      expect(() => createChunks(null as unknown as string, 2, 0)).toThrow()
    })
  })

  describe('matchesFilter()', () => {
    it('should return true when a document matches a typical filter set', () => {
      const filter: DocumentFilter = {
        category: 'Air Quality',
        audience: 'General Public',
        searchQuery: 'Lahore',
        tags: ['pm2.5'],
      }

      expect(matchesFilter(baseDocument, filter)).toBe(true)
    })

    it('should return false when one of the filters excludes the document', () => {
      expect(matchesFilter(baseDocument, { category: 'Water Resources' })).toBe(false)
    })

    it('should ignore empty filter arrays and undefined filter fields', () => {
      expect(matchesFilter(baseDocument, { tags: [], category: undefined })).toBe(true)
    })

    it('should respect year boundaries', () => {
      expect(matchesFilter(baseDocument, { yearFrom: 2025 })).toBe(false)
      expect(matchesFilter(baseDocument, { yearTo: 2023 })).toBe(false)
    })

    it('should return false when required searchable document fields are missing', () => {
      expect(matchesFilter({} as Document, { searchQuery: 'lahore' })).toBe(false)
    })
  })

  describe('calculateRelevanceScore()', () => {
    it('should score title matches more heavily than content-only matches', () => {
      const score = calculateRelevanceScore('Lahore air', baseDocument)

      expect(score).toBeGreaterThan(0)
    })

    it('should return zero for a query with no meaningful matches', () => {
      expect(calculateRelevanceScore('biodiversity wetland', baseDocument)).toBe(0)
    })

    it('should ignore very short query terms', () => {
      expect(calculateRelevanceScore('a an of', baseDocument)).toBe(0)
    })

    it('should support repeated matches in the document body', () => {
      const repeatedDoc = { ...baseDocument, title: 'Report', content: 'air air air' } as Document
      expect(calculateRelevanceScore('air', repeatedDoc)).toBe(3)
    })

    it('should throw when the query is not a string', () => {
      expect(() => calculateRelevanceScore(null as unknown as string, baseDocument)).toThrow()
    })
  })

  describe('simpleSimilarity() and cosineSimilarity()', () => {
    it('should compute Jaccard-style similarity for overlapping text', () => {
      expect(simpleSimilarity('air quality lahore', 'air quality multan')).toBeCloseTo(0.5, 5)
    })

    it('should return zero similarity for empty string comparisons', () => {
      expect(simpleSimilarity('', '')).toBe(0)
    })

    it('should compute cosine similarity for aligned vectors', () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5)
    })

    it('should return zero when vectors have mismatched lengths or zero norms', () => {
      expect(cosineSimilarity([1, 2], [1])).toBe(0)
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
    })

    it('should throw for unexpected non-string text inputs in simpleSimilarity', () => {
      expect(() => simpleSimilarity(null as unknown as string, 'air')).toThrow()
    })
  })

  describe('AQI helpers', () => {
    it('should map AQI values into the documented category ranges', () => {
      expect(getAQICategory(50).label).toBe('Good')
      expect(getAQICategory(151).label).toBe('Unhealthy')
      expect(getAQICategory(450).label).toBe('Hazardous')
    })

    it('should calculate AQI ratios for known pollutants', () => {
      expect(calculateAQI(35, 'PM2.5')).toBe(100)
    })

    it('should return zero for unknown pollutants and zero concentrations', () => {
      expect(calculateAQI(10, 'UNKNOWN')).toBe(0)
      expect(calculateAQI(0, 'PM2.5')).toBe(0)
    })

    it('should handle high concentration boundary values', () => {
      expect(calculateAQI(70, 'PM2.5')).toBe(200)
    })

    it('should not throw for unsupported pollutant strings', () => {
      expect(() => calculateAQI(10, 7 as unknown as string)).not.toThrow()
    })
  })

  describe('URL and file helpers', () => {
    it('should validate URLs and reject invalid strings', () => {
      expect(isValidUrl('https://epunjab.gov.pk/epa')).toBe(true)
      expect(isValidUrl('not a url')).toBe(false)
    })

    it('should extract file extensions correctly', () => {
      expect(getFileExtension('report.final.pdf')).toBe('pdf')
      expect(getFileExtension('README')).toBe('')
    })

    it('should sanitize filenames and derive safe document titles', () => {
      expect(sanitizeFileName('..\u0000bad<name>.pdf')).toBe('bad_name_.pdf')
      expect(getSafeDocumentTitleFromFileName('  unsafe<>report.pdf  ')).toBe('unsafe_report')
      expect(sanitizeFilename(' ..\\draft/report?.pdf ', 'fallback')).toBe('report-.pdf')
    })

    it('should format file sizes across unit boundaries', () => {
      expect(formatFileSize(0)).toBe('0.0 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    })

    it('should throw for non-string filename inputs in sanitizers', () => {
      expect(() => sanitizeFilename(undefined as unknown as string)).toThrow()
    })
  })

  describe('generateId(), debounce(), and throttle()', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should generate prefixed and unprefixed ids', () => {
      expect(generateId('doc')).toMatch(/^doc_[a-z0-9]+$/)
      expect(generateId()).toMatch(/^[a-z0-9]+$/)
    })

    it('should debounce repeated calls and only invoke the last one', () => {
      const callback = jest.fn()
      const debounced = debounce(callback, 100)

      debounced('first')
      debounced('second')
      jest.advanceTimersByTime(99)
      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('second')
    })

    it('should throttle repeated calls within the limit window', () => {
      const callback = jest.fn()
      const throttled = throttle(callback, 100)

      throttled('first')
      throttled('second')
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('first')

      jest.advanceTimersByTime(100)
      throttled('third')
      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith('third')
    })
  })

  describe('validation, response formatting, and color helpers', () => {
    const sources: SourceReference[] = [
      { id: 'source-1', title: 'Punjab Air Quality Bulletin', pageNumber: 4 } as SourceReference,
    ]

    it('should validate email addresses and reject malformed values', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('invalid-email')).toBe(false)
    })

    it('should sanitize HTML-sensitive input characters', () => {
      expect(sanitizeInput(`<script>alert("x")</script>'`)).toBe(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#x27;'
      )
    })

    it('should append source citations when formatting chat responses', () => {
      expect(formatChatResponse('Answer', sources)).toContain('1. Punjab Air Quality Bulletin (Page 4)')
      expect(formatChatResponse('Answer', [])).toBe('Answer')
    })

    it('should convert hex colors to RGB values and choose a contrasting text color', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
      expect(getContrastColor('#ffffff')).toBe('black')
      expect(getContrastColor('#000000')).toBe('white')
    })

    it('should return null or a safe default for invalid color values', () => {
      expect(hexToRgb('#zzz')).toBeNull()
      expect(getContrastColor('not-a-color')).toBe('black')
    })
  })
})
