// =====================================================
// EPA Punjab EnvironmentGPT - LLM Router Service Tests
// Phase 8: Unit Tests for llm-router-service.ts
// =====================================================

jest.mock('@/lib/db', () => ({
  db: {
    lLMProvider: {
      findFirst: jest.fn(),
    },
    lLMRequestLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    chatCompletion: jest.fn(),
    getStats: jest.fn(),
    healthCheckAll: jest.fn(),
  },
}))

jest.mock('@/lib/services/data-connector-service', () => ({
  dataConnectorService: {
    enrichContext: jest.fn(),
    getStats: jest.fn(),
    getConnectors: jest.fn(),
    testConnector: jest.fn(),
  },
}))

import { db } from '@/lib/db'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { dataConnectorService } from '@/lib/services/data-connector-service'
import { llmRouter } from '@/lib/services/llm-router-service'

describe('LLMRouterService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(llmProviderRegistry.chatCompletion as jest.Mock).mockResolvedValue({
      success: true,
      response: {
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Router answer' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
      },
      providerUsed: 'OpenAI',
      modelUsed: 'gpt-4o',
      latencyMs: 120,
      tokens: { prompt: 10, completion: 12, total: 22 },
    })
    ;(dataConnectorService.enrichContext as jest.Mock).mockResolvedValue({
      connectorsUsed: ['Punjab AQI'],
      liveDataCitations: [
        {
          source: 'Punjab AQI',
          type: 'aqi',
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
      ],
      systemContext: 'AQI is 180',
      userContext: 'AQI is currently elevated',
      postRetrievalContext: '',
    })
    ;(dataConnectorService.getStats as jest.Mock).mockResolvedValue({
      totalConnectors: 1,
      activeConnectors: 1,
      connectorsByType: { aqi: 1, weather: 0, water_quality: 0, custom_api: 0, database: 0 },
    })
    ;(dataConnectorService.getConnectors as jest.Mock).mockResolvedValue([
      { id: 'connector-1', name: 'Punjab AQI' },
    ])
    ;(dataConnectorService.testConnector as jest.Mock).mockResolvedValue({ success: true })
    ;(db.lLMProvider.findFirst as jest.Mock).mockResolvedValue({ id: 'provider-1' })
    ;(db.lLMRequestLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' })
    ;(db.lLMRequestLog.findMany as jest.Mock).mockResolvedValue([
      { latencyMs: 100, status: 'success' },
    ])
  })

  it('enriches the query, calls the provider, and logs the request', async () => {
    const result = await llmRouter.processQuery({
      query: 'What is the air quality in Lahore?',
      sessionId: 'session-1',
      audienceType: 'General Public',
    })

    expect(result.success).toBe(true)
    expect(result.content).toBe('Router answer')
    expect(result.enrichedContext.connectorsUsed).toEqual(['Punjab AQI'])
    expect(dataConnectorService.enrichContext).toHaveBeenCalledWith(
      'air_quality',
      expect.objectContaining({
        query: 'What is the air quality in Lahore?',
      })
    )
    expect(llmProviderRegistry.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('AQI is currently elevated'),
          }),
        ]),
      })
    )
    expect(db.lLMRequestLog.create).toHaveBeenCalled()
  })

  it('returns pipeline health information', async () => {
    ;(llmProviderRegistry.healthCheckAll as jest.Mock).mockResolvedValue({
      OpenAI: 'healthy',
      Ollama: 'unhealthy',
    })

    const health = await llmRouter.healthCheck()

    expect(health.status).toBe('degraded')
    expect(health.providers).toEqual({
      OpenAI: 'healthy',
      Ollama: 'unhealthy',
    })
    expect(health.connectors).toEqual({
      'Punjab AQI': 'healthy',
    })
  })
})
