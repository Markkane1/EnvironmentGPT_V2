// =====================================================
// EPA Punjab EnvironmentGPT - Utility Functions
// Phase 1: Core Utility Library
// =====================================================

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { 
  Document, 
  DocumentFilter, 
  SourceReference 
} from '@/types'
import { AQI_CATEGORIES, AQI_PARAMETERS } from '@/lib/constants'

// ==================== CSS Utilities ====================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== String Utilities ====================

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function removeExtraWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim()
}

// ==================== Date Utilities ====================

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

export function categorizeDocument(title: string, content: string): string {
  const text = (title + ' ' + content).toLowerCase()
  
  const categoryKeywords: Record<string, string[]> = {
    'Air Quality': ['air', 'pm2.5', 'pm10', 'smog', 'emission', 'pollution', 'aqi', 'dust'],
    'Water Resources': ['water', 'river', 'groundwater', 'drinking', 'wastewater', 'aquifer'],
    'Biodiversity': ['biodiversity', 'species', 'wildlife', 'habitat', 'ecosystem', 'conservation'],
    'Climate Change': ['climate', 'emission', 'carbon', 'greenhouse', 'temperature', 'weather'],
    'Waste Management': ['waste', 'landfill', 'recycling', 'garbage', 'solid waste', 'hazardous'],
    'Policy & Regulation': ['policy', 'regulation', 'act', 'law', 'compliance', 'standard', 'neqs'],
  }

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category
    }
  }

  return 'Policy & Regulation'
}

export function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'pakistan', 'punjab', 'epa', 'environmental', 'environment',
  ])

  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  const wordCount: Record<string, number> = {}
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1
  }

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

export function createChunks(
  content: string, 
  chunkSize: number = 512, 
  overlap: number = 50
): { text: string; startIndex: number; endIndex: number }[] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0')
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('overlap must be between 0 and chunkSize - 1')
  }

  const normalizedContent = content.trim()
  if (!normalizedContent) {
    return []
  }

  const words = normalizedContent.split(/\s+/)
  const chunks: { text: string; startIndex: number; endIndex: number }[] = []
  
  let startIndex = 0
  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length)
    const chunkWords = words.slice(startIndex, endIndex)
    
    chunks.push({
      text: chunkWords.join(' '),
      startIndex,
      endIndex
    })
    
    if (endIndex >= words.length) break
    startIndex = endIndex - overlap
  }
  
  return chunks
}

// ==================== Search & Filter Utilities ====================

export function matchesFilter(document: Document, filter: DocumentFilter): boolean {
  if (filter.category && document.category !== filter.category) return false
  if (filter.reportSeries && document.reportSeries !== filter.reportSeries) return false
  if (filter.yearFrom && document.year && document.year < filter.yearFrom) return false
  if (filter.yearTo && document.year && document.year > filter.yearTo) return false
  if (filter.audience && document.audience !== filter.audience) return false
  
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase()
    const searchableText = `${document.title} ${document.content} ${document.tags?.join(' ')}`.toLowerCase()
    if (!searchableText.includes(query)) return false
  }
  
  if (filter.tags && filter.tags.length > 0) {
    const docTags = document.tags || []
    if (!filter.tags.some(tag => docTags.includes(tag))) return false
  }
  
  return true
}

export function calculateRelevanceScore(query: string, document: Document): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  const docText = `${document.title} ${document.content}`.toLowerCase()
  
  let score = 0
  for (const term of queryTerms) {
    const regex = new RegExp(term, 'gi')
    const matches = docText.match(regex)
    if (matches) {
      // Title matches are weighted more heavily
      if (document.title.toLowerCase().includes(term)) {
        score += matches.length * 3
      } else {
        score += matches.length
      }
    }
  }
  
  return score
}

// ==================== Text Similarity ====================

export function simpleSimilarity(text1: string, text2: string): number {
  const normalizedText1 = text1.trim()
  const normalizedText2 = text2.trim()

  if (!normalizedText1 || !normalizedText2) {
    return 0
  }

  const words1 = new Set(normalizedText1.toLowerCase().split(/\s+/))
  const words2 = new Set(normalizedText2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0
  
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }
  
  if (norm1 === 0 || norm2 === 0) return 0
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

// ==================== AQI Utilities ====================

export function getAQICategory(aqi: number): typeof AQI_CATEGORIES[number] {
  for (const category of AQI_CATEGORIES) {
    if (aqi >= category.range[0] && aqi <= category.range[1]) {
      return category
    }
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
}

export function calculateAQI(concentration: number, pollutant: string): number {
  const param = AQI_PARAMETERS.find(p => p.code === pollutant)
  if (!param) return 0
  
  // Simplified AQI calculation (actual formula is more complex)
  const ratio = concentration / param.threshold
  return Math.round(ratio * 100)
}

// ==================== URL & File Utilities ====================

export function isValidUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
}

export function sanitizeFileName(filename: string, maxLength: number = 255): string {
  const basename = filename.split(/[\\/]/).pop() || 'document'
  const cleaned = basename
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const safeName = cleaned || 'document'
  return safeName.length > maxLength ? safeName.slice(0, maxLength) : safeName
}

export function getSafeDocumentTitleFromFileName(filename: string): string {
  const safeFileName = sanitizeFileName(filename)
  const title = safeFileName.replace(/\.[^/.]+$/, '').trim()
  return title || 'Uploaded Document'
}

export function sanitizeFilename(filename: string, fallback: string = 'file'): string {
  const trimmed = filename.trim()
  const baseName = trimmed.split(/[/\\]+/).pop() ?? ''
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 255)

  return cleaned || fallback
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let unitIndex = 0
  let size = bytes
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// ==================== ID Generation ====================

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`
}

// ==================== Debounce & Throttle ====================

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// ==================== Validation Utilities ====================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ==================== Response Formatting ====================

export function formatChatResponse(
  response: string,
  sources: SourceReference[]
): string {
  let formatted = response
  
  // Add source citations if available
  if (sources.length > 0) {
    formatted += '\n\n---\n**Sources:**\n'
    sources.forEach((source, index) => {
      formatted += `${index + 1}. ${source.title}`
      if (source.pageNumber) {
        formatted += ` (Page ${source.pageNumber})`
      }
      formatted += '\n'
    })
  }
  
  return formatted
}

// ==================== Color Utilities ====================

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

export function getContrastColor(hex: string): 'black' | 'white' {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'black'
  
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? 'black' : 'white'
}
