// =====================================================
// EPA Punjab EnvironmentGPT - LLM Provider Registry
// Dynamic LLM provider management with automatic fallback
// Supports: OpenAI, DeepSeek, Ollama, vLLM, Azure (all OpenAI-compatible)
// =====================================================

import { db } from '@/lib/db'

// ==================== Types ====================

export type ProviderRole = 'primary' | 'fallback_1' | 'fallback_2' | 'available'
export type ProviderType = 'openai_compat' | 'ollama' | 'azure'
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown'

export interface LLMProviderConfig {
  id: string
  name: string
  displayName: string
  providerType: ProviderType
  baseUrl: string
  apiKeyEnvVar?: string | null
  modelId: string
  defaultParams: Record<string, unknown>
  role: ProviderRole
  priority: number
  isActive: boolean
  healthStatus: HealthStatus
  lastHealthCheck?: Date | null
  requestCount: number
  errorCount: number
  avgLatencyMs?: number | null
}

export interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  model?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
  stop?: string | string[]
  [key: string]: unknown
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface LLMRequestResult {
  success: boolean
  response?: ChatCompletionResponse
  providerUsed?: string
  modelUsed?: string
  latencyMs: number
  fallbackChain?: string[]
  error?: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
}

// ==================== LLM Provider Registry Service ====================

class LLMProviderRegistryService {
  private providers: Map<string, LLMProviderConfig> = new Map()
  private lastRefresh: Date | null = null
  private refreshIntervalMs = 60000 // Refresh cache every minute

  /**
   * Get all active providers from database
   */
  async loadProviders(): Promise<LLMProviderConfig[]> {
    const providers = await db.lLMProvider.findMany({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { priority: 'asc' }]
    })

    this.providers.clear()
    const configs: LLMProviderConfig[] = []

    for (const provider of providers) {
      const config: LLMProviderConfig = {
        id: provider.id,
        name: provider.name,
        displayName: provider.displayName,
        providerType: provider.providerType as ProviderType,
        baseUrl: provider.baseUrl,
        apiKeyEnvVar: provider.apiKeyEnvVar,
        modelId: provider.modelId,
        defaultParams: this.parseJson(provider.defaultParams || '{}'),
        role: provider.role as ProviderRole,
        priority: provider.priority,
        isActive: provider.isActive,
        healthStatus: provider.healthStatus as HealthStatus,
        lastHealthCheck: provider.lastHealthCheck,
        requestCount: provider.requestCount,
        errorCount: provider.errorCount,
        avgLatencyMs: provider.avgLatencyMs
      }

      this.providers.set(provider.id, config)
      configs.push(config)
    }

    this.lastRefresh = new Date()
    return configs
  }

  /**
   * Get providers, refreshing cache if needed
   */
  async getProviders(): Promise<LLMProviderConfig[]> {
    const shouldRefresh = !this.lastRefresh ||
      (Date.now() - this.lastRefresh.getTime()) > this.refreshIntervalMs

    if (shouldRefresh) {
      return this.loadProviders()
    }

    return Array.from(this.providers.values())
  }

  /**
   * Get provider chain for fallback routing
   * Returns: [primary, fallback_1, fallback_2, ...available]
   */
  async getProviderChain(): Promise<LLMProviderConfig[]> {
    const providers = await this.getProviders()

    const chain: LLMProviderConfig[] = []
    const roles: ProviderRole[] = ['primary', 'fallback_1', 'fallback_2']

    // Add providers in role order
    for (const role of roles) {
      const provider = providers.find(p => p.role === role && p.healthStatus !== 'unhealthy')
      if (provider) {
        chain.push(provider)
      }
    }

    // Add remaining available providers as final fallbacks
    const available = providers
      .filter(p => !roles.includes(p.role) && p.healthStatus !== 'unhealthy')
      .sort((a, b) => a.priority - b.priority)

    chain.push(...available)

    return chain
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<LLMProviderConfig | null> {
    await this.getProviders() // Ensure cache is loaded
    return this.providers.get(id) || null
  }

  /**
   * Get provider by name
   */
  async getProviderByName(name: string): Promise<LLMProviderConfig | null> {
    const providers = await this.getProviders()
    return providers.find(p => p.name.toLowerCase() === name.toLowerCase()) || null
  }

  /**
   * Get API key from environment variable
   */
  private getApiKey(provider: LLMProviderConfig): string | undefined {
    if (!provider.apiKeyEnvVar) return undefined
    return process.env[provider.apiKeyEnvVar]
  }

  /**
   * Build headers for API request
   */
  private buildHeaders(provider: LLMProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    const apiKey = this.getApiKey(provider)

    if (apiKey) {
      if (provider.providerType === 'azure') {
        headers['api-key'] = apiKey
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }
    }

    return headers
  }

  /**
   * Build request body for chat completion
   */
  private buildRequestBody(
    provider: LLMProviderConfig,
    request: ChatCompletionRequest
  ): Record<string, unknown> {
    const defaultParams = provider.defaultParams || {}

    const body: Record<string, unknown> = {
      model: request.model || provider.modelId,
      messages: request.messages,
      ...defaultParams,
      ...request
    }

    // Ensure model is set correctly
    body.model = request.model || provider.modelId

    return body
  }

  /**
   * Make chat completion request to a specific provider
   */
  private async makeRequest(
    provider: LLMProviderConfig,
    request: ChatCompletionRequest
  ): Promise<{ response: ChatCompletionResponse; latencyMs: number }> {
    const startTime = Date.now()

    const url = provider.providerType === 'ollama'
      ? `${provider.baseUrl}/chat/completions`
      : `${provider.baseUrl}/chat/completions`

    const headers = this.buildHeaders(provider)
    const body = this.buildRequestBody(provider, request)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Provider ${provider.name} error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as ChatCompletionResponse

    return { response: data, latencyMs }
  }

  /**
   * Execute chat completion with automatic fallback
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<LLMRequestResult> {
    const providerChain = await this.getProviderChain()

    if (providerChain.length === 0) {
      return {
        success: false,
        latencyMs: 0,
        error: 'No active LLM providers configured'
      }
    }

    const fallbackChain: string[] = []
    let lastError: string | undefined

    for (const provider of providerChain) {
      fallbackChain.push(provider.name)

      try {
        const { response, latencyMs } = await this.makeRequest(provider, request)

        // Update provider stats
        await this.updateProviderStats(provider.id, true, latencyMs)

        return {
          success: true,
          response,
          providerUsed: provider.name,
          modelUsed: response.model,
          latencyMs,
          fallbackChain: fallbackChain.length > 1 ? fallbackChain : undefined,
          tokens: response.usage ? {
            prompt: response.usage.prompt_tokens,
            completion: response.usage.completion_tokens,
            total: response.usage.total_tokens
          } : undefined
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'

        // Update provider error stats
        await this.updateProviderStats(provider.id, false, 0)

        // Log the error and try next provider
        console.warn(`[LLM Registry] Provider ${provider.name} failed:`, lastError)

        // Continue to next provider in chain
        continue
      }
    }

    // All providers failed
    return {
      success: false,
      latencyMs: 0,
      error: `All providers failed. Last error: ${lastError}`,
      fallbackChain
    }
  }

  /**
   * Simple chat completion - returns just the response text
   */
  async chat(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<{ content: string; providerUsed: string; latencyMs: number }> {
    const result = await this.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens
    })

    if (!result.success || !result.response) {
      throw new Error(result.error || 'Chat completion failed')
    }

    return {
      content: result.response.choices[0]?.message?.content || '',
      providerUsed: result.providerUsed || 'unknown',
      latencyMs: result.latencyMs
    }
  }

  /**
   * Update provider statistics
   */
  private async updateProviderStats(
    providerId: string,
    success: boolean,
    latencyMs: number
  ): Promise<void> {
    try {
      const provider = await db.lLMProvider.findUnique({
        where: { id: providerId },
        select: { requestCount: true, errorCount: true, avgLatencyMs: true }
      })

      if (!provider) return

      const newRequestCount = provider.requestCount + 1
      const newErrorCount = success ? provider.errorCount : provider.errorCount + 1

      // Calculate rolling average latency
      const newAvgLatency = success
        ? ((provider.avgLatencyMs || 0) * provider.requestCount + latencyMs) / newRequestCount
        : provider.avgLatencyMs

      await db.lLMProvider.update({
        where: { id: providerId },
        data: {
          requestCount: newRequestCount,
          errorCount: newErrorCount,
          avgLatencyMs: newAvgLatency,
          healthStatus: success ? 'healthy' : 'unhealthy',
          lastHealthCheck: new Date()
        }
      })
    } catch (error) {
      console.error('[LLM Registry] Failed to update stats:', error)
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheckAll(): Promise<Record<string, HealthStatus>> {
    const providers = await this.getProviders()
    const results: Record<string, HealthStatus> = {}

    for (const provider of providers) {
      try {
        // Simple health check - send minimal request
        await this.makeRequest(provider, {
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        })

        results[provider.name] = 'healthy'

        await db.lLMProvider.update({
          where: { id: provider.id },
          data: {
            healthStatus: 'healthy',
            lastHealthCheck: new Date()
          }
        })
      } catch {
        results[provider.name] = 'unhealthy'

        await db.lLMProvider.update({
          where: { id: provider.id },
          data: {
            healthStatus: 'unhealthy',
            lastHealthCheck: new Date()
          }
        })
      }
    }

    return results
  }

  /**
   * Add new provider
   */
  async addProvider(config: {
    name: string
    displayName: string
    providerType?: ProviderType
    baseUrl: string
    apiKeyEnvVar?: string
    modelId: string
    defaultParams?: Record<string, unknown>
    role?: ProviderRole
    priority?: number
  }): Promise<LLMProviderConfig> {
    const provider = await db.lLMProvider.create({
      data: {
        name: config.name,
        displayName: config.displayName,
        providerType: config.providerType || 'openai_compat',
        baseUrl: config.baseUrl,
        apiKeyEnvVar: config.apiKeyEnvVar,
        modelId: config.modelId,
        defaultParams: JSON.stringify(config.defaultParams || {}),
        role: config.role || 'available',
        priority: config.priority || 100,
        isActive: true,
        healthStatus: 'unknown'
      }
    })

    // Invalidate cache
    this.lastRefresh = null

    return {
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
      providerType: provider.providerType as ProviderType,
      baseUrl: provider.baseUrl,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      modelId: provider.modelId,
      defaultParams: this.parseJson(provider.defaultParams || '{}'),
      role: provider.role as ProviderRole,
      priority: provider.priority,
      isActive: provider.isActive,
      healthStatus: provider.healthStatus as HealthStatus,
      lastHealthCheck: provider.lastHealthCheck,
      requestCount: provider.requestCount,
      errorCount: provider.errorCount,
      avgLatencyMs: provider.avgLatencyMs
    }
  }

  /**
   * Update provider
   */
  async updateProvider(
    id: string,
    updates: Partial<{
      displayName: string
      baseUrl: string
      apiKeyEnvVar: string
      modelId: string
      defaultParams: Record<string, unknown>
      role: ProviderRole
      priority: number
      isActive: boolean
    }>
  ): Promise<LLMProviderConfig | null> {
    const data: Record<string, unknown> = {}

    if (updates.displayName !== undefined) data.displayName = updates.displayName
    if (updates.baseUrl !== undefined) data.baseUrl = updates.baseUrl
    if (updates.apiKeyEnvVar !== undefined) data.apiKeyEnvVar = updates.apiKeyEnvVar
    if (updates.modelId !== undefined) data.modelId = updates.modelId
    if (updates.defaultParams !== undefined) data.defaultParams = JSON.stringify(updates.defaultParams)
    if (updates.role !== undefined) data.role = updates.role
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.isActive !== undefined) data.isActive = updates.isActive

    const provider = await db.lLMProvider.update({
      where: { id },
      data
    })

    // Invalidate cache
    this.lastRefresh = null

    return this.getProviderById(id)
  }

  /**
   * Delete provider
   */
  async deleteProvider(id: string): Promise<boolean> {
    try {
      await db.lLMProvider.delete({ where: { id } })
      this.providers.delete(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Set provider role (primary/fallback)
   */
  async setProviderRole(id: string, role: ProviderRole): Promise<boolean> {
    try {
      // If setting as primary, remove primary role from current primary
      if (role === 'primary') {
        await db.lLMProvider.updateMany({
          where: { role: 'primary' },
          data: { role: 'available' }
        })
      }

      await db.lLMProvider.update({
        where: { id },
        data: { role }
      })

      // Invalidate cache
      this.lastRefresh = null

      return true
    } catch {
      return false
    }
  }

  /**
   * Get provider statistics
   */
  async getStats(): Promise<{
    totalProviders: number
    activeProviders: number
    healthyProviders: number
    primaryProvider: string | null
    totalRequests: number
    totalErrors: number
  }> {
    const providers = await this.getProviders()

    const primary = providers.find(p => p.role === 'primary')

    return {
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.isActive).length,
      healthyProviders: providers.filter(p => p.healthStatus === 'healthy').length,
      primaryProvider: primary?.name || null,
      totalRequests: providers.reduce((sum, p) => sum + p.requestCount, 0),
      totalErrors: providers.reduce((sum, p) => sum + p.errorCount, 0)
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
export const llmProviderRegistry = new LLMProviderRegistryService()
