import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Document, DocumentFilter } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting utilities
export function formatDate(date: Date | string, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date)
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-PK', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      })
    case 'long':
      return d.toLocaleDateString('en-PK', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    case 'relative':
      return getRelativeTime(d)
    default:
      return d.toLocaleDateString()
  }
}

export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return formatDate(date)
}

// ==================== Document Utilities ====================

/**
 * Check if a document matches a filter
 */
export function matchesFilter(doc: Document, filter: DocumentFilter): boolean {
  if (filter.category && doc.category !== filter.category) return false
  if (filter.reportSeries && doc.reportSeries !== filter.reportSeries) return false
  if (filter.audience && doc.audience !== filter.audience) return false
  if (filter.yearFrom && (doc.year ?? 0) < filter.yearFrom) return false
  if (filter.yearTo && (doc.year ?? Infinity) > filter.yearTo) return false
  if (filter.tags && filter.tags.length > 0) {
    const hasTag = filter.tags.some(tag => doc.tags.includes(tag))
    if (!hasTag) return false
  }
  return true
}

/**
 * Calculate relevance score for a document based on query
 */
export function calculateRelevanceScore(query: string, doc: Document): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  if (queryTerms.length === 0) return 0

  const titleLower = doc.title.toLowerCase()
  const contentLower = doc.content.toLowerCase()
  const tagsLower = doc.tags.map(t => t.toLowerCase())

  let score = 0

  for (const term of queryTerms) {
    // Title matches are worth more
    if (titleLower.includes(term)) {
      score += 10
      // Exact title match bonus
      if (titleLower === term) score += 20
    }

    // Content matches
    const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length
    score += Math.min(contentMatches, 5) // Cap at 5 to avoid over-weighting

    // Tag matches
    if (tagsLower.some(tag => tag.includes(term))) {
      score += 5
    }

    // Category match
    if (doc.category?.toLowerCase().includes(term)) {
      score += 3
    }
  }

  return score
}

/**
 * Chunk text into smaller pieces for RAG
 */
export function createChunks(
  text: string,
  options: {
    chunkSize?: number
    overlap?: number
  } = {}
): Array<{ text: string; startIndex: number; endIndex: number }> {
  const { chunkSize = 500, overlap = 50 } = options
  const chunks: Array<{ text: string; startIndex: number; endIndex: number }> = []

  // Split by paragraphs first, then by size
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  let startIndex = 0

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length
      })
      // Start new chunk with overlap from previous
      const overlapText = currentChunk.slice(-overlap)
      startIndex = startIndex + currentChunk.length - overlapText.length
      currentChunk = overlapText + paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      startIndex,
      endIndex: startIndex + currentChunk.length
    })
  }

  return chunks
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'as', 'if', 'then', 'than',
    'so', 'such', 'no', 'not', 'only', 'own', 'same', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some'
  ])

  // Extract words and count frequency
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  const frequency: Record<string, number> = {}
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1
  }

  // Sort by frequency and return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
