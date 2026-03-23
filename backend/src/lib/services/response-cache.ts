// =====================================================
// EPA Punjab EnvironmentGPT - Response Cache Service
// Phase 4: Intelligent Response Caching Layer
// =====================================================

import { ChatResponse } from '@/types'

// ==================== Types ====================

export interface CacheEntry {
  key: string
  response: ChatResponse
  timestamp: number
  hitCount: number
  lastAccessed: number
  ttl: number
  metadata: {
    query: string
    audience: string
    category?: string
    documentCount: number
  }
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  oldestEntry: number
  newestEntry: number
  memoryUsage: number // Approximate bytes
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  enabled?: boolean
}

// ==================== Default Configuration ====================

const DEFAULT_TTL = 1000 * 60 * 60 // 1 hour
const DEFAULT_MAX_SIZE = 1000
const CLEANUP_INTERVAL = 1000 * 60 * 5 // 5 minutes

// ==================== Response Cache Service ====================

export class ResponseCacheService {
  private cache: Map<string, CacheEntry> = new Map()
  private hits: number = 0
  private misses: number = 0
  private maxSize: number
  private defaultTTL: number
  private enabled: boolean
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
    this.defaultTTL = options.ttl ?? DEFAULT_TTL
    this.enabled = options.enabled ?? true

    if (this.enabled) {
      this.startCleanupTimer()
    }
  }

  // ==================== Core Cache Operations ====================

  /**
   * Generate cache key from query parameters
   */
  generateKey(params: {
    query: string
    audience?: string
    category?: string
    documentIds?: string[]
  }): string {
    const normalizedQuery = params.query.toLowerCase().trim()
    const audience = params.audience || 'General Public'
    const category = params.category || ''
    const docIds = params.documentIds ? [...params.documentIds].sort().join(',') : ''
    
    // Create a simple hash
    const combined = `${normalizedQuery}:${audience}:${category}:${docIds}`
    return this.simpleHash(combined)
  }

  /**
   * Get cached response
   */
  get(key: string): ChatResponse | null {
    if (!this.enabled) return null

    const entry = this.cache.get(key)
    
    if (!entry) {
      this.misses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    // Update access stats
    entry.hitCount++
    entry.lastAccessed = Date.now()
    this.hits++

    // Return a copy to prevent mutation
    return this.cloneResponse(entry.response)
  }

  /**
   * Set cache entry
   */
  set(
    key: string,
    response: ChatResponse,
    metadata: CacheEntry['metadata'],
    ttl?: number
  ): void {
    if (!this.enabled) return

    // Evict entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key,
      response: this.cloneResponse(response), // Store a copy
      timestamp: Date.now(),
      hitCount: 0,
      lastAccessed: Date.now(),
      ttl: ttl ?? this.defaultTTL,
      metadata
    }

    this.cache.set(key, entry)
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    if (!this.enabled) return false

    const entry = this.cache.get(key)
    if (!entry) return false

    // Check expiration
    return Date.now() - entry.timestamp <= entry.ttl
  }

  /**
   * Delete entry by key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  // ==================== Advanced Operations ====================

  /**
   * Get or compute response
   */
  async getOrCompute(
    key: string,
    computeFn: () => Promise<ChatResponse>,
    metadata: CacheEntry['metadata'],
    ttl?: number
  ): Promise<{ response: ChatResponse; cached: boolean }> {
    const cached = this.get(key)
    
    if (cached) {
      return { response: cached, cached: true }
    }

    const response = await computeFn()
    this.set(key, response, metadata, ttl)
    
    return { response, cached: false }
  }

  /**
   * Invalidate entries matching pattern
   */
  invalidatePattern(pattern: {
    query?: string
    audience?: string
    category?: string
  }): number {
    let count = 0
    
    for (const [key, entry] of this.cache.entries()) {
      let matches = true
      
      if (pattern.query && !entry.metadata.query.toLowerCase().includes(pattern.query.toLowerCase())) {
        matches = false
      }
      if (pattern.audience && entry.metadata.audience !== pattern.audience) {
        matches = false
      }
      if (pattern.category && entry.metadata.category !== pattern.category) {
        matches = false
      }
      
      if (matches) {
        this.cache.delete(key)
        count++
      }
    }
    
    return count
  }

  /**
   * Invalidate all entries older than specified age
   */
  invalidateOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs
    let count = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        this.cache.delete(key)
        count++
      }
    }
    
    return count
  }

  /**
   * Get most popular queries
   */
  getPopularQueries(limit: number = 10): Array<{
    query: string
    hitCount: number
    audience: string
  }> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit)
      .map(entry => ({
        query: entry.metadata.query,
        hitCount: entry.hitCount,
        audience: entry.metadata.audience
      }))
  }

  // ==================== Cache Management ====================

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, CLEANUP_INTERVAL)

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let count = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        count++
      }
    }
    
    return count
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  // ==================== Statistics ====================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let oldestTimestamp = Infinity
    let newestTimestamp = 0
    let totalResponseSize = 0
    
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp
      }
      
      // Estimate response size
      totalResponseSize += JSON.stringify(entry.response).length
    }
    
    const totalRequests = this.hits + this.misses
    
    return {
      totalEntries: this.cache.size,
      totalHits: this.hits,
      totalMisses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      oldestEntry: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
      newestEntry: newestTimestamp,
      memoryUsage: totalResponseSize
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.clear()
      this.stopCleanupTimer()
    } else if (!this.cleanupTimer) {
      this.startCleanupTimer()
    }
  }

  // ==================== Utility Methods ====================

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `cache_${Math.abs(hash).toString(36)}`
  }

  private cloneResponse(response: ChatResponse): ChatResponse {
    if (typeof structuredClone === 'function') {
      return structuredClone(response)
    }

    return JSON.parse(JSON.stringify(response))
  }
}

// Export singleton instance
export const responseCacheService = new ResponseCacheService()
