// =====================================================
// EPA Punjab EnvironmentGPT - Data Connector Service
// Live data enrichment for RAG context
// Supports: AQI, Weather, Water Quality, Custom APIs
// =====================================================

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ==================== Types ====================

export type ConnectorType = 'aqi' | 'weather' | 'water_quality' | 'custom_api' | 'database'
export type AuthMethod = 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2'
export type InjectionMethod = 'system_context' | 'user_context' | 'post_retrieval'
export type FetchStatus = 'success' | 'error' | 'timeout'

export interface DataConnectorConfig {
  id: string
  name: string
  displayName: string
  connectorType: ConnectorType
  endpointUrl: string
  apiKeyEnvVar?: string | null
  authMethod: AuthMethod
  authHeader?: string | null
  requestMethod: 'GET' | 'POST'
  requestBodyTemplate?: string | null
  responseMapping?: string | null
  injectAs: InjectionMethod
  injectionTemplate?: string | null
  isActive: boolean
  refreshIntervalSec: number
  cacheEnabled: boolean
  cacheTtlSec: number
  lastFetchedAt?: Date | null
  lastFetchStatus?: FetchStatus | null
  lastFetchError?: string | null
  requestCount: number
  errorCount: number
  topicMappings: ConnectorTopicMapping[]
}

export interface ConnectorTopicMapping {
  id: string
  connectorId: string
  topic: string
  priority: number
  isActive: boolean
  conditions: Record<string, unknown>
}

export interface ConnectorData {
  connectorName: string
  connectorType: ConnectorType
  data: Record<string, unknown>
  fetchedAt: Date
  cached: boolean
  contextInjection: {
    method: InjectionMethod
    template: string
  }
}

export interface EnrichedContext {
  systemContext: string
  userContext: string
  postRetrievalContext: string
  connectorsUsed: string[]
  liveDataCitations: Array<{
    source: string
    type: ConnectorType
    timestamp: Date
  }>
}

type ConnectorRecord = Prisma.DataConnectorGetPayload<{
  include: { topicMappings: true }
}>

type ConnectorTopicMappingRecord = ConnectorRecord['topicMappings'][number]

// ==================== Data Connector Service ====================

class DataConnectorService {
  private connectors: Map<string, DataConnectorConfig> = new Map()
  private cache: Map<string, { data: unknown; expiresAt: Date }> = new Map()
  private lastRefresh: Date | null = null
  private refreshIntervalMs = 60000 // Refresh cache every minute

  /**
   * Load all active connectors from database
   */
  async loadConnectors(): Promise<DataConnectorConfig[]> {
    const connectors = await db.dataConnector.findMany({
      where: { isActive: true },
      include: {
        topicMappings: true
      },
      orderBy: { name: 'asc' }
    })

    this.connectors.clear()
    const configs: DataConnectorConfig[] = []

    for (const connector of connectors) {
      const config: DataConnectorConfig = {
        id: connector.id,
        name: connector.name,
        displayName: connector.displayName,
        connectorType: connector.connectorType as ConnectorType,
        endpointUrl: connector.endpointUrl,
        apiKeyEnvVar: connector.apiKeyEnvVar,
        authMethod: connector.authMethod as AuthMethod,
        authHeader: connector.authHeader,
        requestMethod: connector.requestMethod as 'GET' | 'POST',
        requestBodyTemplate: connector.requestBodyTemplate,
        responseMapping: connector.responseMapping,
        injectAs: connector.injectAs as InjectionMethod,
        injectionTemplate: connector.injectionTemplate,
        isActive: connector.isActive,
        refreshIntervalSec: connector.refreshIntervalSec,
        cacheEnabled: connector.cacheEnabled,
        cacheTtlSec: connector.cacheTtlSec,
        lastFetchedAt: connector.lastFetchedAt,
        lastFetchStatus: connector.lastFetchStatus as FetchStatus | undefined,
        lastFetchError: connector.lastFetchError,
        requestCount: connector.requestCount,
        errorCount: connector.errorCount,
        topicMappings: connector.topicMappings.map(tm => ({
          id: tm.id,
          connectorId: tm.connectorId,
          topic: tm.topic,
          priority: tm.priority,
          isActive: tm.isActive,
          conditions: this.parseJson(tm.conditions || '{}')
        }))
      }

      this.connectors.set(connector.id, config)
      configs.push(config)
    }

    this.lastRefresh = new Date()
    return configs
  }

  /**
   * Get connectors, refreshing cache if needed
   */
  async getConnectors(): Promise<DataConnectorConfig[]> {
    const shouldRefresh = !this.lastRefresh ||
      (Date.now() - this.lastRefresh.getTime()) > this.refreshIntervalMs

    if (shouldRefresh) {
      return this.loadConnectors()
    }

    return Array.from(this.connectors.values())
  }

  /**
   * Get connectors for a specific topic
   */
  async getConnectorsForTopic(topic: string): Promise<DataConnectorConfig[]> {
    const connectors = await this.getConnectors()

    return connectors.filter(connector =>
      connector.topicMappings.some(tm =>
        tm.isActive && (tm.topic === topic || tm.topic === 'all')
      )
    ).sort((a, b) => {
      const aMapping = a.topicMappings.find(tm => tm.topic === topic || tm.topic === 'all')
      const bMapping = b.topicMappings.find(tm => tm.topic === topic || tm.topic === 'all')
      return (aMapping?.priority || 100) - (bMapping?.priority || 100)
    })
  }

  /**
   * Get API key from environment variable
   */
  private getApiKey(connector: DataConnectorConfig): string | undefined {
    if (!connector.apiKeyEnvVar) return undefined
    return process.env[connector.apiKeyEnvVar]
  }

  /**
   * Build headers for API request
   */
  private buildHeaders(connector: DataConnectorConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const apiKey = this.getApiKey(connector)

    if (apiKey) {
      switch (connector.authMethod) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${apiKey}`
          break
        case 'api_key':
          if (connector.authHeader) {
            headers[connector.authHeader] = apiKey
          } else {
            headers['X-API-Key'] = apiKey
          }
          break
        case 'basic':
          headers['Authorization'] = `Basic ${apiKey}`
          break
      }
    }

    return headers
  }

  /**
   * Extract data from response using mapping
   */
  private extractData(response: unknown, mapping?: string | null): Record<string, unknown> {
    if (!mapping) {
      return response as Record<string, unknown>
    }

    try {
      // Simple JSONPath-like extraction
      const paths = mapping.split('.')
      let data: unknown = response

      for (const path of paths) {
        if (data && typeof data === 'object') {
          data = (data as Record<string, unknown>)[path]
        } else if (Array.isArray(data)) {
          const index = parseInt(path)
          if (!isNaN(index)) {
            data = data[index]
          }
        }
      }

      return data as Record<string, unknown>
    } catch {
      return response as Record<string, unknown>
    }
  }

  /**
   * Get cache key for connector
   */
  private getCacheKey(connectorId: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : 'default'
    return `${connectorId}:${paramString}`
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(connectorId: string, cacheKey: string): boolean {
    const connector = this.connectors.get(connectorId)
    if (!connector?.cacheEnabled) return false

    const cached = this.cache.get(cacheKey)
    if (!cached) return false

    return cached.expiresAt > new Date()
  }

  /**
   * Get cached data
   */
  private getCachedData(cacheKey: string): unknown | null {
    const cached = this.cache.get(cacheKey)
    return cached?.data || null
  }

  /**
   * Set cache data
   */
  private setCachedData(connectorId: string, cacheKey: string, data: unknown): void {
    const connector = this.connectors.get(connectorId)
    if (!connector?.cacheEnabled) return

    this.cache.set(cacheKey, {
      data,
      expiresAt: new Date(Date.now() + connector.cacheTtlSec * 1000)
    })

    // Also save to database
    this.saveToDatabaseCache(connectorId, cacheKey, data, connector.cacheTtlSec)
  }

  /**
   * Save to database cache
   */
  private async saveToDatabaseCache(
    connectorId: string,
    cacheKey: string,
    data: unknown,
    ttlSec: number
  ): Promise<void> {
    try {
      await db.connectorCache.upsert({
        where: {
          connectorId_cacheKey: { connectorId, cacheKey }
        },
        create: {
          connectorId,
          cacheKey,
          data: JSON.stringify(data),
          expiresAt: new Date(Date.now() + ttlSec * 1000)
        },
        update: {
          data: JSON.stringify(data),
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + ttlSec * 1000)
        }
      })
    } catch (error) {
      console.error('[DataConnector] Failed to save cache:', error)
    }
  }

  /**
   * Load from database cache
   */
  private async loadFromDatabaseCache(
    connectorId: string,
    cacheKey: string
  ): Promise<unknown | null> {
    try {
      const cached = await db.connectorCache.findFirst({
        where: {
          connectorId,
          cacheKey,
          expiresAt: { gt: new Date() }
        }
      })

      if (cached) {
        return JSON.parse(cached.data)
      }
    } catch (error) {
      console.error('[DataConnector] Failed to load cache:', error)
    }

    return null
  }

  /**
   * Fetch data from connector endpoint
   */
  async fetchData(
    connector: DataConnectorConfig,
    params?: Record<string, unknown>
  ): Promise<{ data: Record<string, unknown>; cached: boolean }> {
    const cacheKey = this.getCacheKey(connector.id, params)

    // Check memory cache first
    if (this.isCacheValid(connector.id, cacheKey)) {
      const cachedData = this.getCachedData(cacheKey)
      if (cachedData) {
        return { data: cachedData as Record<string, unknown>, cached: true }
      }
    }

    // Check database cache
    const dbCached = await this.loadFromDatabaseCache(connector.id, cacheKey)
    if (dbCached) {
      return { data: dbCached as Record<string, unknown>, cached: true }
    }

    // Fetch fresh data
    try {
      const headers = this.buildHeaders(connector)

      let response: Response

      if (connector.requestMethod === 'POST') {
        const body = connector.requestBodyTemplate
          ? this.interpolateTemplate(connector.requestBodyTemplate, params || {})
          : JSON.stringify(params || {})

        response = await fetch(connector.endpointUrl, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })
      } else {
        // GET with query params
        const url = new URL(connector.endpointUrl)
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
          })
        }

        response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000)
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData = await response.json()
      const extractedData = this.extractData(responseData, connector.responseMapping)

      // Update connector stats
      await this.updateConnectorStats(connector.id, true)

      // Cache the data
      this.setCachedData(connector.id, cacheKey, extractedData)

      return { data: extractedData, cached: false }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Update connector stats
      await this.updateConnectorStats(connector.id, false, errorMessage)

      throw error
    }
  }

  /**
   * Interpolate template with parameters
   */
  private interpolateTemplate(
    template: string,
    params: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(params[key] || '')
    })
  }

  /**
   * Build context injection template
   */
  private buildInjectionTemplate(
    connector: DataConnectorConfig,
    data: Record<string, unknown>
  ): string {
    if (connector.injectionTemplate) {
      return this.interpolateTemplate(connector.injectionTemplate, data)
    }

    // Default templates based on connector type
    switch (connector.connectorType) {
      case 'aqi':
        return this.formatAQIContext(data)
      case 'weather':
        return this.formatWeatherContext(data)
      case 'water_quality':
        return this.formatWaterQualityContext(data)
      default:
        return JSON.stringify(data, null, 2)
    }
  }

  /**
   * Format AQI data for context
   */
  private formatAQIContext(data: Record<string, unknown>): string {
    const aqi = data.aqi || data.AQI || 'N/A'
    const city = data.city || data.location || 'Punjab'
    const pollutant = data.dominant_pollutant || data.pollutant || 'PM2.5'
    const category = data.category || this.getAQICategory(Number(aqi))

    return `
## Current Air Quality Data (${city})
- **AQI Level**: ${aqi}
- **Category**: ${category}
- **Dominant Pollutant**: ${pollutant}
- **Timestamp**: ${new Date().toISOString()}

This is real-time air quality data. Use this information to provide current context in your response.
`.trim()
  }

  /**
   * Format weather data for context
   */
  private formatWeatherContext(data: Record<string, unknown>): string {
    const temp = data.temperature || data.temp || 'N/A'
    const humidity = data.humidity || 'N/A'
    const conditions = data.conditions || data.weather || 'Unknown'
    const location = data.location || data.city || 'Punjab'

    return `
## Current Weather Data (${location})
- **Temperature**: ${temp}Â°C
- **Humidity**: ${humidity}%
- **Conditions**: ${conditions}
- **Timestamp**: ${new Date().toISOString()}
`.trim()
  }

  /**
   * Format water quality data for context
   */
  private formatWaterQualityContext(data: Record<string, unknown>): string {
    const ph = data.ph || data.pH || 'N/A'
    const tds = data.tds || data.TDS || 'N/A'
    const turbidity = data.turbidity || 'N/A'
    const source = data.source || data.river || 'Water Source'

    return `
## Current Water Quality Data (${source})
- **pH Level**: ${ph}
- **TDS**: ${tds} mg/L
- **Turbidity**: ${turbidity} NTU
- **Timestamp**: ${new Date().toISOString()}

Compare with NEQS standards: pH 6.5-8.5, TDS <1000 mg/L, Turbidity <5 NTU
`.trim()
  }

  /**
   * Get AQI category from value
   */
  private getAQICategory(aqi: number): string {
    if (aqi <= 50) return 'Good'
    if (aqi <= 100) return 'Moderate'
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
    if (aqi <= 200) return 'Unhealthy'
    if (aqi <= 300) return 'Very Unhealthy'
    return 'Hazardous'
  }

  /**
   * Enrich context with live data from connectors
   */
  async enrichContext(
    topic: string,
    queryContext?: {
      location?: string
      date?: string
      [key: string]: unknown
    }
  ): Promise<EnrichedContext> {
    const result: EnrichedContext = {
      systemContext: '',
      userContext: '',
      postRetrievalContext: '',
      connectorsUsed: [],
      liveDataCitations: []
    }

    const connectors = await this.getConnectorsForTopic(topic)
    const params: Record<string, unknown> = {}

    if (queryContext?.location) params.location = queryContext.location
    if (queryContext?.date) params.date = queryContext.date

    const enrichments = await Promise.all(connectors.map(async (connector, index) => {
      try {
        const { data } = await this.fetchData(connector, params)

        return {
          index,
          connector,
          contextTemplate: this.buildInjectionTemplate(connector, data)
        }
      } catch (error) {
        console.warn(`[DataConnector] Failed to fetch from ${connector.name}:`, error)
        return null
      }
    }))

    for (const enrichment of enrichments
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.index - right.index)) {
      switch (enrichment.connector.injectAs) {
        case 'system_context':
          result.systemContext += `\n\n${enrichment.contextTemplate}`
          break
        case 'user_context':
          result.userContext += `\n\n${enrichment.contextTemplate}`
          break
        case 'post_retrieval':
          result.postRetrievalContext += `\n\n${enrichment.contextTemplate}`
          break
      }

      result.connectorsUsed.push(enrichment.connector.name)
      result.liveDataCitations.push({
        source: enrichment.connector.displayName,
        type: enrichment.connector.connectorType,
        timestamp: new Date()
      })
    }

    return result
  }

  /**
   * Update connector statistics
   */
  private async updateConnectorStats(
    connectorId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.dataConnector.update({
        where: { id: connectorId },
        data: {
          requestCount: { increment: 1 },
          errorCount: success ? undefined : { increment: 1 },
          lastFetchedAt: new Date(),
          lastFetchStatus: success ? 'success' : 'error',
          lastFetchError: success ? null : errorMessage || null
        }
      })
    } catch (error) {
      console.error('[DataConnector] Failed to update stats:', error)
    }
  }

  /**
   * Add new connector
   */
  async addConnector(config: {
    name: string
    displayName: string
    connectorType: ConnectorType
    endpointUrl: string
    apiKeyEnvVar?: string
    authMethod?: AuthMethod
    authHeader?: string
    requestMethod?: 'GET' | 'POST'
    requestBodyTemplate?: string
    responseMapping?: string
    injectAs?: InjectionMethod
    injectionTemplate?: string
    refreshIntervalSec?: number
    cacheEnabled?: boolean
    cacheTtlSec?: number
    topics?: Array<{ topic: string; priority?: number }>
  }): Promise<DataConnectorConfig> {
    const connector = await db.dataConnector.create({
      data: {
        name: config.name,
        displayName: config.displayName,
        connectorType: config.connectorType,
        endpointUrl: config.endpointUrl,
        apiKeyEnvVar: config.apiKeyEnvVar,
        authMethod: config.authMethod || 'none',
        authHeader: config.authHeader,
        requestMethod: config.requestMethod || 'GET',
        requestBodyTemplate: config.requestBodyTemplate,
        responseMapping: config.responseMapping,
        injectAs: config.injectAs || 'system_context',
        injectionTemplate: config.injectionTemplate,
        isActive: true,
        refreshIntervalSec: config.refreshIntervalSec || 300,
        cacheEnabled: config.cacheEnabled ?? true,
        cacheTtlSec: config.cacheTtlSec || 300,
        topicMappings: config.topics ? {
          create: config.topics.map(t => ({
            topic: t.topic,
            priority: t.priority || 100,
            isActive: true
          }))
        } : undefined
      },
      include: { topicMappings: true }
    })

    // Invalidate cache
    this.lastRefresh = null

    return this.mapToConfig(connector)
  }

  /**
   * Update connector
   */
  async updateConnector(
    id: string,
    updates: Partial<{
      displayName: string
      endpointUrl: string
      apiKeyEnvVar: string
      authMethod: AuthMethod
      authHeader: string
      requestMethod: 'GET' | 'POST'
      requestBodyTemplate: string
      responseMapping: string
      injectAs: InjectionMethod
      injectionTemplate: string
      refreshIntervalSec: number
      cacheEnabled: boolean
      cacheTtlSec: number
      isActive: boolean
    }>
  ): Promise<DataConnectorConfig | null> {
    const connector = await db.dataConnector.update({
      where: { id },
      data: updates,
      include: { topicMappings: true }
    })

    // Invalidate cache
    this.lastRefresh = null

    return this.mapToConfig(connector)
  }

  /**
   * Delete connector
   */
  async deleteConnector(id: string): Promise<boolean> {
    try {
      await db.dataConnector.delete({ where: { id } })
      this.connectors.delete(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Add topic mapping to connector
   */
  async addTopicMapping(
    connectorId: string,
    topic: string,
    priority?: number
  ): Promise<boolean> {
    try {
      await db.connectorTopicMapping.create({
        data: {
          connectorId,
          topic,
          priority: priority || 100,
          isActive: true
        }
      })

      this.lastRefresh = null
      return true
    } catch {
      return false
    }
  }

  /**
   * Remove topic mapping
   */
  async removeTopicMapping(mappingId: string): Promise<boolean> {
    try {
      await db.connectorTopicMapping.delete({ where: { id: mappingId } })
      this.lastRefresh = null
      return true
    } catch {
      return false
    }
  }

  /**
   * Test connector
   */
  async testConnector(id: string): Promise<{
    success: boolean
    data?: Record<string, unknown>
    error?: string
    latencyMs: number
  }> {
    const connectors = await this.getConnectors()
    const connector = connectors.find((item) => item.id === id)

    if (!connector) {
      return { success: false, error: 'Connector not found', latencyMs: 0 }
    }

    const startTime = Date.now()

    try {
      const { data } = await this.fetchData(connector)

      return {
        success: true,
        data,
        latencyMs: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime
      }
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.cache.clear()

    try {
      await db.connectorCache.deleteMany()
    } catch (error) {
      console.error('[DataConnector] Failed to clear cache:', error)
    }
  }

  /**
   * Get connector statistics
   */
  async getStats(): Promise<{
    totalConnectors: number
    activeConnectors: number
    connectorsByType: Record<ConnectorType, number>
    totalRequests: number
    totalErrors: number
  }> {
    const connectors = await this.getConnectors()

    const connectorsByType: Record<ConnectorType, number> = {
      aqi: 0,
      weather: 0,
      water_quality: 0,
      custom_api: 0,
      database: 0
    }

    for (const connector of connectors) {
      connectorsByType[connector.connectorType]++
    }

    return {
      totalConnectors: connectors.length,
      activeConnectors: connectors.filter(c => c.isActive).length,
      connectorsByType,
      totalRequests: connectors.reduce((sum, c) => sum + c.requestCount, 0),
      totalErrors: connectors.reduce((sum, c) => sum + c.errorCount, 0)
    }
  }

  /**
   * Map database record to config
   */
  private mapToConfig(connector: ConnectorRecord): DataConnectorConfig {
    return {
      id: connector.id,
      name: connector.name,
      displayName: connector.displayName,
      connectorType: connector.connectorType as ConnectorType,
      endpointUrl: connector.endpointUrl,
      apiKeyEnvVar: connector.apiKeyEnvVar,
      authMethod: connector.authMethod as AuthMethod,
      authHeader: connector.authHeader,
      requestMethod: connector.requestMethod as 'GET' | 'POST',
      requestBodyTemplate: connector.requestBodyTemplate,
      responseMapping: connector.responseMapping,
      injectAs: connector.injectAs as InjectionMethod,
      injectionTemplate: connector.injectionTemplate,
      isActive: connector.isActive,
      refreshIntervalSec: connector.refreshIntervalSec,
      cacheEnabled: connector.cacheEnabled,
      cacheTtlSec: connector.cacheTtlSec,
      lastFetchedAt: connector.lastFetchedAt,
      lastFetchStatus: connector.lastFetchStatus as FetchStatus | undefined,
      lastFetchError: connector.lastFetchError,
      requestCount: connector.requestCount,
      errorCount: connector.errorCount,
      topicMappings: connector.topicMappings?.map((tm: ConnectorTopicMappingRecord) => ({
        id: tm.id,
        connectorId: tm.connectorId,
        topic: tm.topic,
        priority: tm.priority,
        isActive: tm.isActive,
        conditions: this.parseJson(tm.conditions || '{}')
      })) || []
    }
  }

  /**
   * Parse JSON safely
   */
  private parseJson(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json)
    } catch {
      return {}
    }
  }
}

// Export singleton instance
export const dataConnectorService = new DataConnectorService()

