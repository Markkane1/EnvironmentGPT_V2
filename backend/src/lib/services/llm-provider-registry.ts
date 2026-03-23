// =====================================================
// EPA Punjab EnvironmentGPT - LLM Provider Registry
// Dynamic provider management with health-aware fallback routing
// =====================================================

import { db } from '@/lib/db'

// ==================== Types ====================

export type ProviderRole = 'primary' | 'fallback_1' | 'fallback_2' | 'available' | 'disabled'
export type ProviderType = 'openai_compat' | 'ollama'
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
  timeoutSeconds: number
  maxTokens: number
  temperature: number
  notes?: string | null
  healthStatus: HealthStatus
  lastHealthCheck?: Date | null
  requestCount: number
  errorCount: number
  avgLatencyMs?: number | null
  addedBy?: string | null
  createdAt: Date
}

export interface ProviderAvailability {
  id: string
  name: string
  modelId: string
  role: ProviderRole
  baseUrl: string
  isActive: boolean
  providerType: ProviderType
  hasApiKey: boolean
}

export interface ProviderHealthCheck {
  healthy: boolean
  latencyMs: number | null
  error?: string
}

export interface ProviderTestResult {
  success: boolean
  latencyMs: number
  error: string | null
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

interface StoredProviderRecord {
  id: string
  name: string
  displayName: string
  providerType: string
  baseUrl: string
  apiKeyEnvVar: string | null
  modelId: string
  defaultParams: string | null
  role: string
  priority: number
  isActive: boolean
  timeoutSeconds: number
  maxTokens: number
  temperature: number
  notes: string | null
  healthStatus: string
  lastHealthCheck: Date | null
  requestCount: number
  errorCount: number
  avgLatencyMs: number | null
  addedBy: string | null
  createdAt: Date
}

const FALLBACK_ROLES: ProviderRole[] = ['primary', 'fallback_1', 'fallback_2']
const UNIQUE_CHAIN_ROLES = new Set<ProviderRole>(['primary', 'fallback_1', 'fallback_2'])
const ROLE_ORDER: ProviderRole[] = ['primary', 'fallback_1', 'fallback_2', 'available', 'disabled']

export function normalizeProviderBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
}

function getRoleOrder(role: string): number {
  const index = ROLE_ORDER.indexOf(role as ProviderRole)
  return index === -1 ? ROLE_ORDER.length : index
}

// ==================== LLM Provider Registry Service ====================

class LLMProviderRegistryService {
  private providers: Map<string, LLMProviderConfig> = new Map()
  private lastRefresh: Date | null = null
  private refreshIntervalMs = 60000

  private mapProvider(provider: StoredProviderRecord): LLMProviderConfig {
    return {
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
      providerType: provider.providerType as ProviderType,
      baseUrl: normalizeProviderBaseUrl(provider.baseUrl),
      apiKeyEnvVar: provider.apiKeyEnvVar,
      modelId: provider.modelId,
      defaultParams: this.parseJson(provider.defaultParams || '{}'),
      role: provider.role as ProviderRole,
      priority: provider.priority,
      isActive: provider.isActive,
      timeoutSeconds: provider.timeoutSeconds,
      maxTokens: provider.maxTokens,
      temperature: provider.temperature,
      notes: provider.notes,
      healthStatus: provider.healthStatus as HealthStatus,
      lastHealthCheck: provider.lastHealthCheck,
      requestCount: provider.requestCount,
      errorCount: provider.errorCount,
      avgLatencyMs: provider.avgLatencyMs,
      addedBy: provider.addedBy,
      createdAt: provider.createdAt,
    }
  }

  private invalidateCache(): void {
    this.providers.clear()
    this.lastRefresh = null
  }

  private getApiKey(provider: LLMProviderConfig): string | undefined {
    if (!provider.apiKeyEnvVar) return undefined
    return process.env[provider.apiKeyEnvVar]
  }

  private buildHeaders(provider: LLMProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const apiKey = this.getApiKey(provider)
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    return headers
  }

  private buildRequestBody(
    provider: LLMProviderConfig,
    request: ChatCompletionRequest
  ): Record<string, unknown> {
    return {
      ...provider.defaultParams,
      ...request,
      model: request.model || provider.modelId,
      temperature: request.temperature ?? provider.temperature,
      max_tokens: request.max_tokens ?? provider.maxTokens,
      messages: request.messages,
    }
  }

  private getCompletionsUrl(provider: LLMProviderConfig): string {
    return `${normalizeProviderBaseUrl(provider.baseUrl)}/v1/chat/completions`
  }

  private getHealthUrls(provider: LLMProviderConfig): string[] {
    const baseUrl = normalizeProviderBaseUrl(provider.baseUrl)
    return [`${baseUrl}/health`, `${baseUrl}/v1/models`]
  }

  private async syncRoleExclusivity(role: ProviderRole, excludeId?: string): Promise<void> {
    if (!UNIQUE_CHAIN_ROLES.has(role)) {
      return
    }

    await db.lLMProvider.updateMany({
      where: {
        role,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { role: 'available' },
    })
  }

  async loadProviders(): Promise<LLMProviderConfig[]> {
    const providers = await db.lLMProvider.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'asc' }],
    })

    const mapped = providers
      .map(provider => this.mapProvider(provider as StoredProviderRecord))
      .sort((left, right) => {
        const roleDelta = getRoleOrder(left.role) - getRoleOrder(right.role)
        if (roleDelta !== 0) return roleDelta
        return left.priority - right.priority
      })

    this.providers.clear()
    for (const provider of mapped) {
      this.providers.set(provider.id, provider)
    }

    this.lastRefresh = new Date()
    return mapped
  }

  async getProviders(): Promise<LLMProviderConfig[]> {
    const shouldRefresh = !this.lastRefresh
      || (Date.now() - this.lastRefresh.getTime()) > this.refreshIntervalMs

    if (shouldRefresh) {
      return this.loadProviders()
    }

    return Array.from(this.providers.values())
  }

  async getAllProviders(): Promise<LLMProviderConfig[]> {
    const providers = await db.lLMProvider.findMany({
      orderBy: [{ createdAt: 'asc' }],
    })

    return providers
      .map(provider => this.mapProvider(provider as StoredProviderRecord))
      .sort((left, right) => {
        const roleDelta = getRoleOrder(left.role) - getRoleOrder(right.role)
        if (roleDelta !== 0) return roleDelta
        return left.priority - right.priority
      })
  }

  async availableProviders(): Promise<ProviderAvailability[]> {
    const providers = await this.getProviders()

    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      modelId: provider.modelId,
      role: provider.role,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive,
      providerType: provider.providerType,
      hasApiKey: typeof provider.apiKeyEnvVar === 'string' && !!process.env[provider.apiKeyEnvVar],
    }))
  }

  async getProviderChain(): Promise<LLMProviderConfig[]> {
    const providers = await this.getProviders()

    return FALLBACK_ROLES
      .map(role => providers.find(provider => provider.role === role && provider.isActive))
      .filter((provider): provider is LLMProviderConfig => Boolean(provider))
  }

  async getProviderById(id: string): Promise<LLMProviderConfig | null> {
    const provider = await db.lLMProvider.findUnique({
      where: { id },
    })

    return provider ? this.mapProvider(provider as StoredProviderRecord) : null
  }

  async getProviderByRole(role: ProviderRole): Promise<LLMProviderConfig | null> {
    const provider = await db.lLMProvider.findFirst({
      where: {
        role,
        isActive: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    })

    return provider ? this.mapProvider(provider as StoredProviderRecord) : null
  }

  private async pingProvider(provider: LLMProviderConfig): Promise<ProviderHealthCheck> {
    const headers = this.buildHeaders(provider)
    const timeoutMs = Math.max(1000, Math.min(provider.timeoutSeconds, 30) * 1000)
    let lastError = 'Provider health check failed'

    for (const url of this.getHealthUrls(provider)) {
      const startedAt = Date.now()

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        })

        const latencyMs = Date.now() - startedAt
        if (response.ok) {
          return { healthy: true, latencyMs }
        }

        if (url.endsWith('/health') && (response.status === 404 || response.status === 405)) {
          lastError = `Health endpoint unavailable (${response.status})`
          continue
        }

        const errorText = (await response.text()).trim()
        lastError = errorText
          ? `Health check failed with ${response.status}: ${errorText}`
          : `Health check failed with ${response.status}`
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown health check error'
      }
    }

    return {
      healthy: false,
      latencyMs: null,
      error: lastError,
    }
  }

  private async setProviderHealth(
    providerId: string,
    health: ProviderHealthCheck
  ): Promise<void> {
    try {
      await db.lLMProvider.update({
        where: { id: providerId },
        data: {
          healthStatus: health.healthy ? 'healthy' : 'unhealthy',
          lastHealthCheck: new Date(),
          avgLatencyMs: health.healthy && health.latencyMs !== null ? health.latencyMs : undefined,
        },
      })
    } catch (error) {
      console.error('[LLM Registry] Failed to update health state:', error)
    }
  }

  private async makeRequest(
    provider: LLMProviderConfig,
    request: ChatCompletionRequest
  ): Promise<{ response: ChatCompletionResponse; latencyMs: number }> {
    const startTime = Date.now()
    const response = await fetch(this.getCompletionsUrl(provider), {
      method: 'POST',
      headers: this.buildHeaders(provider),
      body: JSON.stringify(this.buildRequestBody(provider, request)),
      signal: AbortSignal.timeout(Math.max(1000, provider.timeoutSeconds * 1000)),
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Provider ${provider.name} error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as ChatCompletionResponse
    return { response: data, latencyMs }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<LLMRequestResult> {
    const providerChain = await this.getProviderChain()

    if (providerChain.length === 0) {
      return {
        success: false,
        latencyMs: 0,
        error: 'No active LLM providers configured',
      }
    }

    const fallbackChain: string[] = []
    let lastError: string | undefined

    for (const provider of providerChain) {
      fallbackChain.push(provider.name)

      const health = await this.pingProvider(provider)
      await this.setProviderHealth(provider.id, health)

      if (!health.healthy) {
        lastError = health.error
        continue
      }

      try {
        const { response, latencyMs } = await this.makeRequest(provider, request)
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
            total: response.usage.total_tokens,
          } : undefined,
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        await this.updateProviderStats(provider.id, false, 0)
        console.warn(`[LLM Registry] Provider ${provider.name} failed:`, lastError)
      }
    }

    return {
      success: false,
      latencyMs: 0,
      error: `All providers failed. Last error: ${lastError}`,
      fallbackChain,
    }
  }

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
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    })

    if (!result.success || !result.response) {
      throw new Error(result.error || 'Chat completion failed')
    }

    return {
      content: result.response.choices[0]?.message?.content || '',
      providerUsed: result.providerUsed || 'unknown',
      latencyMs: result.latencyMs,
    }
  }

  private async updateProviderStats(
    providerId: string,
    success: boolean,
    latencyMs: number
  ): Promise<void> {
    try {
      const provider = await db.lLMProvider.findUnique({
        where: { id: providerId },
        select: { requestCount: true, errorCount: true, avgLatencyMs: true },
      })

      if (!provider) return

      const newRequestCount = provider.requestCount + 1
      const newErrorCount = success ? provider.errorCount : provider.errorCount + 1
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
          lastHealthCheck: new Date(),
        },
      })
    } catch (error) {
      console.error('[LLM Registry] Failed to update stats:', error)
    }
  }

  async healthCheckAll(): Promise<Record<string, ProviderHealthCheck>> {
    const providers = await this.getProviders()
    const results: Record<string, ProviderHealthCheck> = {}

    for (const provider of providers) {
      const health = await this.pingProvider(provider)
      results[provider.name] = health
      await this.setProviderHealth(provider.id, health)
    }

    return results
  }

  async testProvider(id: string, message = 'Reply with the single word OK.'): Promise<ProviderTestResult> {
    const provider = await this.getProviderById(id)

    if (!provider) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Provider not found',
      }
    }

    const health = await this.pingProvider(provider)
    await this.setProviderHealth(provider.id, health)

    if (!health.healthy) {
      return {
        success: false,
        latencyMs: health.latencyMs || 0,
        error: health.error || 'Provider health check failed',
      }
    }

    try {
      const { latencyMs } = await this.makeRequest(provider, {
        messages: [{ role: 'user', content: message }],
        max_tokens: Math.min(provider.maxTokens, 32),
        temperature: 0,
      })

      return {
        success: true,
        latencyMs,
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Provider test failed',
      }
    }
  }

  async addProvider(config: {
    name: string
    displayName?: string
    providerType?: ProviderType
    baseUrl: string
    apiKeyEnvVar?: string | null
    modelId: string
    defaultParams?: Record<string, unknown>
    role?: ProviderRole
    priority?: number
    isActive?: boolean
    timeoutSeconds?: number
    maxTokens?: number
    temperature?: number
    notes?: string | null
    addedBy?: string | null
  }): Promise<LLMProviderConfig> {
    const role = config.role || 'available'
    await this.syncRoleExclusivity(role)

    const provider = await db.lLMProvider.create({
      data: {
        name: config.name,
        displayName: config.displayName || config.name,
        providerType: config.providerType || 'openai_compat',
        baseUrl: normalizeProviderBaseUrl(config.baseUrl),
        apiKeyEnvVar: config.apiKeyEnvVar || null,
        modelId: config.modelId,
        defaultParams: JSON.stringify(config.defaultParams || {}),
        role,
        priority: config.priority ?? (FALLBACK_ROLES.indexOf(role) + 1 || 100),
        isActive: config.isActive ?? true,
        timeoutSeconds: config.timeoutSeconds ?? 120,
        maxTokens: config.maxTokens ?? 1024,
        temperature: config.temperature ?? 0.1,
        notes: config.notes || null,
        addedBy: config.addedBy || null,
        healthStatus: 'unknown',
      },
    })

    this.invalidateCache()
    return this.mapProvider(provider as StoredProviderRecord)
  }

  async updateProvider(
    id: string,
    updates: Partial<{
      name: string
      displayName: string
      providerType: ProviderType
      baseUrl: string
      apiKeyEnvVar: string | null
      modelId: string
      defaultParams: Record<string, unknown>
      role: ProviderRole
      priority: number
      isActive: boolean
      timeoutSeconds: number
      maxTokens: number
      temperature: number
      notes: string | null
      addedBy: string | null
    }>
  ): Promise<LLMProviderConfig | null> {
    if (updates.role) {
      await this.syncRoleExclusivity(updates.role, id)
    }

    const data: Record<string, unknown> = {}

    if (updates.name !== undefined) data.name = updates.name
    if (updates.displayName !== undefined) data.displayName = updates.displayName
    if (updates.providerType !== undefined) data.providerType = updates.providerType
    if (updates.baseUrl !== undefined) data.baseUrl = normalizeProviderBaseUrl(updates.baseUrl)
    if (updates.apiKeyEnvVar !== undefined) data.apiKeyEnvVar = updates.apiKeyEnvVar || null
    if (updates.modelId !== undefined) data.modelId = updates.modelId
    if (updates.defaultParams !== undefined) data.defaultParams = JSON.stringify(updates.defaultParams)
    if (updates.role !== undefined) data.role = updates.role
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.isActive !== undefined) data.isActive = updates.isActive
    if (updates.timeoutSeconds !== undefined) data.timeoutSeconds = updates.timeoutSeconds
    if (updates.maxTokens !== undefined) data.maxTokens = updates.maxTokens
    if (updates.temperature !== undefined) data.temperature = updates.temperature
    if (updates.notes !== undefined) data.notes = updates.notes || null
    if (updates.addedBy !== undefined) data.addedBy = updates.addedBy || null

    try {
      const provider = await db.lLMProvider.update({
        where: { id },
        data,
      })

      this.invalidateCache()
      return this.mapProvider(provider as StoredProviderRecord)
    } catch {
      return null
    }
  }

  async deleteProvider(id: string): Promise<{ success: boolean; reason?: 'not_found' | 'primary_delete_blocked' }> {
    const provider = await db.lLMProvider.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    })

    if (!provider) {
      return { success: false, reason: 'not_found' }
    }

    if (provider.role === 'primary') {
      const otherPrimary = await db.lLMProvider.findFirst({
        where: {
          id: { not: id },
          role: 'primary',
          isActive: true,
        },
        select: { id: true },
      })

      if (!otherPrimary) {
        return { success: false, reason: 'primary_delete_blocked' }
      }
    }

    await db.lLMProvider.update({
      where: { id },
      data: {
        isActive: false,
        role: 'disabled',
      },
    })

    this.invalidateCache()
    return { success: true }
  }

  async setProviderRole(id: string, role: ProviderRole): Promise<boolean> {
    const provider = await this.updateProvider(id, { role })
    return Boolean(provider)
  }

  async getStats(): Promise<{
    totalProviders: number
    activeProviders: number
    healthyProviders: number
    primaryProvider: string | null
    totalRequests: number
    totalErrors: number
  }> {
    const providers = await this.getAllProviders()
    const primary = providers.find(provider => provider.role === 'primary' && provider.isActive)

    return {
      totalProviders: providers.length,
      activeProviders: providers.filter(provider => provider.isActive).length,
      healthyProviders: providers.filter(provider => provider.isActive && provider.healthStatus === 'healthy').length,
      primaryProvider: primary?.name || null,
      totalRequests: providers.reduce((sum, provider) => sum + provider.requestCount, 0),
      totalErrors: providers.reduce((sum, provider) => sum + provider.errorCount, 0),
    }
  }

  private parseJson(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json)
    } catch {
      return {}
    }
  }
}

export const llmProviderRegistry = new LLMProviderRegistryService()
