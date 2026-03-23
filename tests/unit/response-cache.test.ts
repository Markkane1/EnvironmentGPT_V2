// =====================================================
// EPA Punjab EnvironmentGPT - Response Cache Tests
// Phase 8: Unit Tests for response-cache.ts
// =====================================================

import { ResponseCacheService } from '@/lib/services/response-cache'
import { ChatResponse } from '@/types'

// ==================== Response Cache Tests ====================

describe('ResponseCacheService', () => {
  let cache: ResponseCacheService
  let mockResponse: ChatResponse

  beforeEach(() => {
    cache = new ResponseCacheService({ maxSize: 10, ttl: 1000 }) // 1 second TTL for testing
    mockResponse = {
      success: true,
      response: 'Test response',
      sources: [],
      timestamp: new Date(),
    }
  })

  afterEach(() => {
    cache.clear()
    cache.stopCleanupTimer()
  })

  describe('generateKey()', () => {
    it('should generate consistent keys for same parameters', () => {
      const key1 = cache.generateKey({
        query: 'air quality',
        audience: 'General Public',
        category: 'Air Quality'
      })
      const key2 = cache.generateKey({
        query: 'air quality',
        audience: 'General Public',
        category: 'Air Quality'
      })
      
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different queries', () => {
      const key1 = cache.generateKey({ query: 'air quality' })
      const key2 = cache.generateKey({ query: 'water quality' })
      
      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different audiences', () => {
      const key1 = cache.generateKey({ query: 'test', audience: 'General Public' })
      const key2 = cache.generateKey({ query: 'test', audience: 'Technical' })
      
      expect(key1).not.toBe(key2)
    })

    it('should normalize query case', () => {
      const key1 = cache.generateKey({ query: 'Air Quality' })
      const key2 = cache.generateKey({ query: 'AIR QUALITY' })
      const key3 = cache.generateKey({ query: 'air quality' })
      
      expect(key1).toBe(key2)
      expect(key2).toBe(key3)
    })

    it('should not mutate the caller documentIds array', () => {
      const documentIds = ['doc-2', 'doc-1']

      cache.generateKey({
        query: 'test',
        documentIds,
      })

      expect(documentIds).toEqual(['doc-2', 'doc-1'])
    })
  })

  describe('set() and get()', () => {
    it('should store and retrieve cached response', () => {
      const key = cache.generateKey({ query: 'test query' })
      
      cache.set(key, mockResponse, {
        query: 'test query',
        audience: 'General Public',
        documentCount: 2
      })
      
      const retrieved = cache.get(key)
      
      expect(retrieved).not.toBeNull()
      expect(retrieved?.response).toBe(mockResponse.response)
    })

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent-key')
      
      expect(result).toBeNull()
    })

    it('should return null for expired entries', async () => {
      const shortCache = new ResponseCacheService({ ttl: 100 }) // 100ms TTL
      const key = shortCache.generateKey({ query: 'test' })
      
      shortCache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      const result = shortCache.get(key)
      
      expect(result).toBeNull()
    })

    it('should update hit count on retrieval', () => {
      const key = cache.generateKey({ query: 'test' })
      
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      cache.get(key)
      cache.get(key)
      cache.get(key)
      
      const stats = cache.getStats()
      expect(stats.totalHits).toBe(3)
    })

    it('should preserve date objects when cloning cached responses', () => {
      const key = cache.generateKey({ query: 'date preservation' })
      cache.set(key, mockResponse, { query: 'date preservation', audience: 'General Public', documentCount: 0 })

      const retrieved = cache.get(key)

      expect(typeof retrieved?.timestamp?.getTime).toBe('function')
    })
  })

  describe('has()', () => {
    it('should return true for cached key', () => {
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      expect(cache.has(key)).toBe(true)
    })

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false)
    })
  })

  describe('delete()', () => {
    it('should remove cached entry', () => {
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      cache.delete(key)
      
      expect(cache.has(key)).toBe(false)
    })
  })

  describe('clear()', () => {
    it('should clear all entries', () => {
      cache.set('key1', mockResponse, { query: 'test1', audience: 'General Public', documentCount: 0 })
      cache.set('key2', mockResponse, { query: 'test2', audience: 'General Public', documentCount: 0 })
      
      cache.clear()
      
      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      const smallCache = new ResponseCacheService({ maxSize: 3 })
      
      smallCache.set('key1', mockResponse, { query: 'test1', audience: 'General Public', documentCount: 0 })
      smallCache.set('key2', mockResponse, { query: 'test2', audience: 'General Public', documentCount: 0 })
      smallCache.set('key3', mockResponse, { query: 'test3', audience: 'General Public', documentCount: 0 })
      smallCache.set('key4', mockResponse, { query: 'test4', audience: 'General Public', documentCount: 0 })
      
      expect(smallCache.has('key1')).toBe(false) // Should be evicted
      expect(smallCache.has('key4')).toBe(true)  // Should be present
    })
  })

  describe('invalidatePattern()', () => {
    beforeEach(() => {
      cache.set('key1', mockResponse, { query: 'air quality', audience: 'General Public', documentCount: 0 })
      cache.set('key2', mockResponse, { query: 'water quality', audience: 'Technical', documentCount: 0 })
      cache.set('key3', mockResponse, { query: 'air pollution', audience: 'General Public', documentCount: 0 })
    })

    it('should invalidate entries matching query pattern', () => {
      const count = cache.invalidatePattern({ query: 'air' })
      
      expect(count).toBe(2) // key1 and key3
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key3')).toBe(false)
      expect(cache.has('key2')).toBe(true)
    })

    it('should invalidate entries matching audience pattern', () => {
      const count = cache.invalidatePattern({ audience: 'Technical' })
      
      expect(count).toBe(1)
      expect(cache.has('key2')).toBe(false)
    })
  })

  describe('getPopularQueries()', () => {
    it('should return most accessed queries', () => {
      const key1 = cache.generateKey({ query: 'popular query' })
      const key2 = cache.generateKey({ query: 'less popular' })
      
      cache.set(key1, mockResponse, { query: 'popular query', audience: 'General Public', documentCount: 0 })
      cache.set(key2, mockResponse, { query: 'less popular', audience: 'General Public', documentCount: 0 })
      
      // Access popular query multiple times
      cache.get(key1)
      cache.get(key1)
      cache.get(key1)
      cache.get(key2)
      
      const popular = cache.getPopularQueries(10)
      
      expect(popular.length).toBe(2)
      expect(popular[0].query).toBe('popular query')
      expect(popular[0].hitCount).toBe(3)
    })
  })

  describe('getStats()', () => {
    it('should return cache statistics', () => {
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      cache.get(key)
      cache.get('non-existent')
      
      const stats = cache.getStats()
      
      expect(stats.totalEntries).toBe(1)
      expect(stats.totalHits).toBe(1)
      expect(stats.totalMisses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })
  })

  describe('enable/disable', () => {
    it('should disable caching', () => {
      cache.setEnabled(false)
      
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      expect(cache.get(key)).toBeNull()
      expect(cache.isEnabled()).toBe(false)
    })

    it('should clear cache when disabled', () => {
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      cache.setEnabled(false)
      
      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(0)
    })
  })

  describe('getOrCompute()', () => {
    it('should return cached value if exists', async () => {
      const key = cache.generateKey({ query: 'test' })
      cache.set(key, mockResponse, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      const computeFn = jest.fn().mockResolvedValue({ success: true, response: 'new', timestamp: new Date() })
      const result = await cache.getOrCompute(key, computeFn, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      expect(result.cached).toBe(true)
      expect(computeFn).not.toHaveBeenCalled()
    })

    it('should compute and cache value if not exists', async () => {
      const key = cache.generateKey({ query: 'test' })
      const newResponse: ChatResponse = { success: true, response: 'computed', timestamp: new Date() }
      const computeFn = jest.fn().mockResolvedValue(newResponse)
      
      const result = await cache.getOrCompute(key, computeFn, { query: 'test', audience: 'General Public', documentCount: 0 })
      
      expect(result.cached).toBe(false)
      expect(result.response.response).toBe('computed')
      expect(computeFn).toHaveBeenCalled()
      expect(cache.has(key)).toBe(true)
    })
  })
})
