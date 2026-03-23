// =====================================================
// EPA Punjab EnvironmentGPT - LLM Provider Registry Tests
// Phase 8: Unit Tests for llm-provider-registry.ts
// =====================================================

jest.mock('@/lib/db', () => ({
  db: {
    lLMProvider: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'

describe('LLMProviderRegistryService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    ;(llmProviderRegistry as any).providers.clear()
    ;(llmProviderRegistry as any).lastRefresh = null
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  const providers = [
    {
      id: 'provider-1',
      name: 'OpenAI',
      displayName: 'OpenAI',
      providerType: 'openai_compat',
      baseUrl: 'https://api.openai.example/v1',
      apiKeyEnvVar: null,
      modelId: 'gpt-4o',
      defaultParams: '{}',
      role: 'primary',
      priority: 10,
      isActive: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date(),
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    },
    {
      id: 'provider-2',
      name: 'Ollama',
      displayName: 'Ollama',
      providerType: 'ollama',
      baseUrl: 'http://ollama.local/v1',
      apiKeyEnvVar: null,
      modelId: 'llama3.1',
      defaultParams: '{}',
      role: 'fallback_1',
      priority: 20,
      isActive: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date(),
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    },
    {
      id: 'provider-3',
      name: 'Available',
      displayName: 'Available',
      providerType: 'openai_compat',
      baseUrl: 'https://available.example/v1',
      apiKeyEnvVar: null,
      modelId: 'model-x',
      defaultParams: '{}',
      role: 'available',
      priority: 5,
      isActive: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date(),
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    },
  ]

  it('orders providers by role and priority', async () => {
    ;(db.lLMProvider.findMany as jest.Mock).mockResolvedValue(providers)

    const chain = await llmProviderRegistry.getProviderChain()

    expect(chain.map(provider => provider.name)).toEqual(['OpenAI', 'Ollama', 'Available'])
  })

  it('falls back to the next provider when the primary request fails', async () => {
    ;(db.lLMProvider.findMany as jest.Mock).mockResolvedValue(providers.slice(0, 2))
    ;(db.lLMProvider.findUnique as jest.Mock).mockResolvedValue({
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    })
    ;(db.lLMProvider.update as jest.Mock).mockResolvedValue({})

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('upstream error', { status: 500 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          id: 'chatcmpl-1',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'llama3.1',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Fallback answer' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))

    const result = await llmProviderRegistry.chatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.success).toBe(true)
    expect(result.providerUsed).toBe('Ollama')
    expect(result.fallbackChain).toEqual(['OpenAI', 'Ollama'])
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
