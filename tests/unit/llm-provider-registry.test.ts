// =====================================================
// EPA Punjab EnvironmentGPT - LLM Provider Registry Tests
// Covers provider ordering, fallback routing, and soft delete logic
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
    },
  },
}))

import { db } from '@/lib/db'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'

describe('LLMProviderRegistryService', () => {
  const originalFetch = global.fetch
  let consoleWarnSpy: jest.SpyInstance
  const providers = [
    {
      id: 'provider-1',
      name: 'vLLM Qwen3-30B-A3B',
      displayName: 'vLLM Qwen3-30B-A3B',
      providerType: 'openai_compat',
      baseUrl: 'http://vllm:8000',
      apiKeyEnvVar: null,
      modelId: 'qwen3-30b-a3b',
      defaultParams: '{}',
      role: 'primary',
      priority: 1,
      isActive: true,
      timeoutSeconds: 120,
      maxTokens: 1024,
      temperature: 0.1,
      notes: null,
      healthStatus: 'unknown',
      lastHealthCheck: null,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
      addedBy: null,
      createdAt: new Date('2026-03-23T00:00:00Z'),
    },
    {
      id: 'provider-2',
      name: 'vLLM Mistral Small 3.1',
      displayName: 'vLLM Mistral Small 3.1',
      providerType: 'openai_compat',
      baseUrl: 'http://vllm:8000',
      apiKeyEnvVar: null,
      modelId: 'mistral-small-3.1-22b',
      defaultParams: '{}',
      role: 'fallback_1',
      priority: 2,
      isActive: true,
      timeoutSeconds: 120,
      maxTokens: 1024,
      temperature: 0.1,
      notes: null,
      healthStatus: 'unknown',
      lastHealthCheck: null,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
      addedBy: null,
      createdAt: new Date('2026-03-23T00:01:00Z'),
    },
    {
      id: 'provider-3',
      name: 'OpenAI GPT-5-nano',
      displayName: 'OpenAI GPT-5-nano',
      providerType: 'openai_compat',
      baseUrl: 'https://api.openai.com',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      modelId: 'gpt-5-nano',
      defaultParams: '{}',
      role: 'available',
      priority: 100,
      isActive: true,
      timeoutSeconds: 60,
      maxTokens: 2048,
      temperature: 0.2,
      notes: null,
      healthStatus: 'unknown',
      lastHealthCheck: null,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
      addedBy: null,
      createdAt: new Date('2026-03-23T00:02:00Z'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    ;(llmProviderRegistry as any).providers.clear()
    ;(llmProviderRegistry as any).lastRefresh = null
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleWarnSpy.mockRestore()
    delete process.env.OPENAI_API_KEY
  })

  it('orders provider chain by primary and fallback roles only', async () => {
    ;(db.lLMProvider.findMany as jest.Mock).mockResolvedValue(providers)

    const chain = await llmProviderRegistry.getProviderChain()

    expect(chain.map(provider => provider.name)).toEqual([
      'vLLM Qwen3-30B-A3B',
      'vLLM Mistral Small 3.1',
    ])
  })

  it('falls back when the primary completion request fails', async () => {
    ;(db.lLMProvider.findMany as jest.Mock).mockResolvedValue(providers.slice(0, 2))
    ;(db.lLMProvider.findUnique as jest.Mock).mockResolvedValue({
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: null,
    })
    ;(db.lLMProvider.update as jest.Mock).mockResolvedValue({})

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('upstream error', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mistral-small-3.1-22b',
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
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    const result = await llmProviderRegistry.chatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.success).toBe(true)
    expect(result.providerUsed).toBe('vLLM Mistral Small 3.1')
    expect(result.fallbackChain).toEqual([
      'vLLM Qwen3-30B-A3B',
      'vLLM Mistral Small 3.1',
    ])
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://vllm:8000/v1/chat/completions')
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual(
      expect.objectContaining({ model: 'qwen3-30b-a3b' })
    )
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual(
      expect.objectContaining({ model: 'mistral-small-3.1-22b' })
    )
  })

  it('reports active providers with hasApiKey without exposing a secret value', async () => {
    process.env.OPENAI_API_KEY = 'configured'
    ;(db.lLMProvider.findMany as jest.Mock).mockResolvedValue(providers)

    const availableProviders = await llmProviderRegistry.availableProviders()

    expect(availableProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'OpenAI GPT-5-nano',
        hasApiKey: true,
        baseUrl: 'https://api.openai.com',
      }),
    ]))
  })

  it('soft deletes a non-primary provider by deactivating it', async () => {
    ;(db.lLMProvider.findUnique as jest.Mock).mockResolvedValue({
      id: 'provider-2',
      role: 'fallback_1',
      isActive: true,
    })
    ;(db.lLMProvider.update as jest.Mock).mockResolvedValue({})

    const result = await llmProviderRegistry.deleteProvider('provider-2')

    expect(result).toEqual({ success: true })
    expect(db.lLMProvider.update).toHaveBeenCalledWith({
      where: { id: 'provider-2' },
      data: {
        isActive: false,
        role: 'disabled',
      },
    })
  })

  it('blocks deletion of the only active primary provider', async () => {
    ;(db.lLMProvider.findUnique as jest.Mock).mockResolvedValue({
      id: 'provider-1',
      role: 'primary',
      isActive: true,
    })
    ;(db.lLMProvider.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await llmProviderRegistry.deleteProvider('provider-1')

    expect(result).toEqual({ success: false, reason: 'primary_delete_blocked' })
    expect(db.lLMProvider.update).not.toHaveBeenCalled()
  })
})
