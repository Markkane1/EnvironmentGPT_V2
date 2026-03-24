import {
  calculateRelevanceScore,
  cn,
  createChunks,
  debounce,
  extractKeywords,
  formatDate,
  formatFileSize,
  generateId,
  getRelativeTime,
  matchesFilter,
  truncateText,
} from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api-errors'
import type { Document, DocumentFilter } from '@/types'

const baseDocument: Document = {
  id: 'doc-1',
  title: 'Punjab Air Quality Annual Review',
  content: 'Vehicular emissions and crop burning drive particulate pollution across Punjab.',
  category: 'Air Quality',
  reportSeries: 'Annual Review',
  year: 2024,
  audience: 'Policy Maker',
  tags: ['air quality', 'policy'],
  isActive: true,
  language: 'en',
  createdAt: new Date('2026-03-20T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
}

describe('frontend utility helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-24T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('should merge truthy class names with later Tailwind classes winning', () => {
    expect(cn('px-2', false, 'px-4', 'text-sm')).toBe('px-4 text-sm')
  })

  it('should format dates in short, long, and relative modes', () => {
    expect(formatDate('2026-03-24T00:00:00.000Z', 'short')).toContain('2026')
    expect(formatDate('2026-03-24T00:00:00.000Z', 'long')).toContain('2026')
    expect(formatDate('2026-03-24T11:59:00.000Z', 'relative')).toBe('1 minute ago')
  })

  it('should return human-readable relative times across supported boundaries', () => {
    expect(getRelativeTime(new Date('2026-03-24T11:59:45.000Z'))).toBe('just now')
    expect(getRelativeTime(new Date('2026-03-24T11:00:00.000Z'))).toBe('1 hour ago')
    expect(getRelativeTime(new Date('2026-03-22T12:00:00.000Z'))).toBe('2 days ago')
    expect(getRelativeTime(new Date('2026-03-10T12:00:00.000Z'))).toContain('2026')
  })

  it('should return true only when a document matches every populated filter', () => {
    const matchingFilter: DocumentFilter = {
      category: 'Air Quality',
      reportSeries: 'Annual Review',
      yearFrom: 2023,
      yearTo: 2025,
      audience: 'Policy Maker',
      tags: ['policy'],
    }

    expect(matchesFilter(baseDocument, matchingFilter)).toBe(true)
    expect(matchesFilter(baseDocument, { category: 'Water Resources' })).toBe(false)
    expect(matchesFilter(baseDocument, { yearFrom: 2025 })).toBe(false)
    expect(matchesFilter(baseDocument, { tags: ['missing'] })).toBe(false)
  })

  it('should score documents higher for title, content, tag, and category matches', () => {
    const score = calculateRelevanceScore('Punjab policy pollution', baseDocument)
    expect(score).toBeGreaterThan(0)
    expect(calculateRelevanceScore('an of to', baseDocument)).toBe(0)
  })

  it('should create overlapping text chunks and skip blank trailing chunks', () => {
    const chunks = createChunks(
      'First paragraph with context.\n\nSecond paragraph with more detail.\n\nThird paragraph closes.',
      { chunkSize: 45, overlap: 10 }
    )

    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toMatchObject({ startIndex: 0 })
    expect(chunks[1].text).toContain('Second paragraph')
    expect(createChunks('   \n\n  ')).toEqual([])
  })

  it('should extract keywords by frequency while ignoring short stop words', () => {
    expect(
      extractKeywords('Punjab pollution pollution control control policy reform air quality', 3)
    ).toEqual(['pollution', 'control', 'punjab'])
  })

  it('should generate a stable unique id from timestamp and random suffix', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789)

    expect(generateId()).toBe('1700000000000-4fzzzxjyl')
  })

  it('should truncate only when text exceeds the requested maximum length', () => {
    expect(truncateText('short text', 20)).toBe('short text')
    expect(truncateText('This sentence is too long', 10)).toBe('This sente...')
  })

  it('should debounce rapid invocations and invoke only the latest call', () => {
    const callback = jest.fn()
    const debounced = debounce(callback, 200)

    debounced('first')
    debounced('second')
    jest.advanceTimersByTime(199)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('second')
  })

  it('should format file sizes from bytes through megabytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB')
  })
})

describe('getApiErrorMessage', () => {
  it('should return a non-empty string error directly', () => {
    expect(getApiErrorMessage('Route failed', 'fallback')).toBe('Route failed')
  })

  it('should return message from an error-like object before details', () => {
    expect(
      getApiErrorMessage({ message: 'Primary message', details: [{ message: 'Detail message' }] }, 'fallback')
    ).toBe('Primary message')
  })

  it('should fall back to the first detail message when top-level message is absent', () => {
    expect(
      getApiErrorMessage({ details: [{ message: 'Detail message' }] }, 'fallback')
    ).toBe('Detail message')
  })

  it('should return the fallback for empty, null, or malformed values', () => {
    expect(getApiErrorMessage('', 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({ details: [{ message: '   ' }] }, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({ message: 42 }, 'fallback')).toBe('fallback')
  })
})
