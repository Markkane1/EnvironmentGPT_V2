import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { dataConnectorService } from '@/lib/services/data-connector-service'
import { llmRouter } from '@/lib/services/llm-router-service'
import { validateExternalUrl, validateProviderBaseUrl } from '@/lib/security/ssrf-guard'
import { createAuthHeaders } from '../helpers/auth'
import {
  GET as getProviders,
  POST as postProviders,
  DELETE as deleteProviders,
  PUT as putProviders,
} from '@/app/api/admin/providers/route'
import { POST as postSystemProviderTest } from '@/app/api/admin/system/providers/[id]/test/route'
import {
  GET as getConnectors,
  POST as postConnectors,
  DELETE as deleteConnectors,
} from '@/app/api/admin/connectors/route'
import {
  GET as getPipeline,
  POST as postPipeline,
} from '@/app/api/admin/pipeline/route'

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getStats: jest.fn(),
    healthCheckAll: jest.fn(),
    getProviderChain: jest.fn(),
    getAllProviders: jest.fn(),
    getProviders: jest.fn(),
    availableProviders: jest.fn(),
    addProvider: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
    testProvider: jest.fn(),
  },
}))

jest.mock('@/lib/services/data-connector-service', () => ({
  dataConnectorService: {
    getStats: jest.fn(),
    testConnector: jest.fn(),
    clearCache: jest.fn(),
    getConnectorsForTopic: jest.fn(),
    getConnectors: jest.fn(),
    addConnector: jest.fn(),
    updateConnector: jest.fn(),
    deleteConnector: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-router-service', () => ({
  llmRouter: {
    getStats: jest.fn(),
    healthCheck: jest.fn(),
    processQuery: jest.fn(),
  },
}))

jest.mock('@/lib/security/ssrf-guard', () => ({
  ...jest.requireActual('@/lib/security/ssrf-guard'),
  validateExternalUrl: jest.fn().mockResolvedValue(null),
  validateProviderBaseUrl: jest.fn().mockReturnValue(null),
}))

const mockLlmProviderRegistry = llmProviderRegistry as any
const mockDataConnectorService = dataConnectorService as any
const mockLlmRouter = llmRouter as any
const mockValidateExternalUrl = validateExternalUrl as jest.Mock
const mockValidateProviderBaseUrl = validateProviderBaseUrl as jest.Mock

function jsonRequest(url: string, body?: unknown, method = 'POST'): Request {
  const headers = new Headers(createAuthHeaders('admin', 'admin-user'))

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const init: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  return new Request(url, init)
}

describe('Admin API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateExternalUrl.mockResolvedValue(null)
    mockValidateProviderBaseUrl.mockReturnValue(null)
  })

  describe('providers route', () => {
    it('returns provider stats when requested', async () => {
      mockLlmProviderRegistry.getStats.mockResolvedValue({
        totalProviders: 2,
        activeProviders: 2,
        healthyProviders: 1,
        primaryProvider: 'OpenAI',
        totalRequests: 10,
        totalErrors: 1,
      } as never)

      const response = await getProviders(new Request('http://localhost/api/admin/providers?action=stats', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.stats.totalProviders).toBe(2)
    })

    it('returns the richer legacy provider payload for the mounted admin UI', async () => {
      mockLlmProviderRegistry.getAllProviders.mockResolvedValue([
        {
          id: 'provider-1',
          name: 'OpenAI',
          displayName: 'OpenAI',
          providerType: 'openai_compat',
          baseUrl: 'https://api.openai.com',
          apiKeyEnvVar: 'OPENAI_API_KEY',
          modelId: 'gpt-4o',
          role: 'primary',
          isActive: true,
          priority: 1,
          timeoutSeconds: 120,
          maxTokens: 1024,
          temperature: 0.1,
          notes: null,
          createdAt: new Date('2026-03-23T00:00:00Z'),
          healthStatus: 'healthy',
          lastHealthCheck: null,
          requestCount: 0,
          errorCount: 0,
          avgLatencyMs: null,
        },
      ] as never)
      process.env.OPENAI_API_KEY = 'configured'

      const response = await getProviders(new Request('http://localhost/api/admin/providers', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.providers[0]).toMatchObject({
        id: 'provider-1',
        displayName: 'OpenAI',
        hasApiKey: true,
        apiKeyEnvVar: 'OPENAI_API_KEY',
      })

      delete process.env.OPENAI_API_KEY
    })

    it('creates a provider with validated input', async () => {
      mockLlmProviderRegistry.addProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'OpenAI',
        providerType: 'openai_compat',
        baseUrl: 'https://api.openai.com',
        modelId: 'gpt-4o',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        role: 'available',
        isActive: true,
        timeoutSeconds: 120,
        maxTokens: 1024,
        temperature: 0.1,
        notes: null,
        createdAt: new Date('2026-03-23T00:00:00Z'),
        healthStatus: 'unknown',
        lastHealthCheck: null,
      } as never)

      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        api_key_env_var: 'OPENAI_API_KEY',
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmProviderRegistry.addProvider).toHaveBeenCalledWith({
        name: 'OpenAI',
        providerType: 'openai_compat',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        modelId: 'gpt-4o',
        role: 'available',
        isActive: true,
        timeoutSeconds: undefined,
        maxTokens: undefined,
        temperature: undefined,
        notes: null,
        addedBy: 'admin-user',
      })
      expect(payload.provider.id).toBe('provider-1')
      expect(payload.provider.apiKeyEnvVar).toBe('OPENAI_API_KEY')
    })

    it('accepts internal provider URLs like Docker service names', async () => {
      mockLlmProviderRegistry.addProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'vLLM Primary',
        providerType: 'openai_compat',
        baseUrl: 'http://vllm:8000',
        modelId: 'qwen3-30b-a3b',
        apiKeyEnvVar: null,
        role: 'primary',
        isActive: true,
        timeoutSeconds: 120,
        maxTokens: 1024,
        temperature: 0.1,
        notes: null,
        createdAt: new Date('2026-03-23T00:00:00Z'),
        healthStatus: 'unknown',
        lastHealthCheck: null,
      } as never)

      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'vLLM Primary',
        baseUrl: 'http://vllm:8000',
        modelId: 'qwen3-30b-a3b',
        role: 'primary',
      }))

      expect(response.status).toBe(200)
      expect(mockValidateProviderBaseUrl).toHaveBeenCalledWith('http://vllm:8000')
    })

    it('rejects malformed provider env vars', async () => {
      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        apiKeyEnvVar: 'openai-api-key',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Invalid apiKeyEnvVar')
      expect(mockLlmProviderRegistry.addProvider).not.toHaveBeenCalled()
    })

    it('rejects provider URLs that fail provider validation', async () => {
      mockValidateProviderBaseUrl.mockReturnValue('Provider base URLs must be the server root or /v1 only.')

      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/custom/path',
        modelId: 'gpt-4o',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toBe('Invalid baseUrl: Provider base URLs must be the server root or /v1 only.')
      expect(mockLlmProviderRegistry.addProvider).not.toHaveBeenCalled()
    })

    it('returns 404 when deleting a missing provider', async () => {
      mockLlmProviderRegistry.deleteProvider.mockResolvedValue({ success: false, reason: 'not_found' })

      const response = await deleteProviders(new Request('http://localhost/api/admin/providers?id=provider-1', {
        method: 'DELETE',
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Provider not found')
    })

    it('updates a provider with an ID in the request body', async () => {
      mockLlmProviderRegistry.updateProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'OpenAI',
        providerType: 'openai_compat',
        baseUrl: 'https://api.openai.com',
        modelId: 'gpt-5-nano',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        role: 'fallback_1',
        isActive: true,
        timeoutSeconds: 90,
        maxTokens: 2048,
        temperature: 0.2,
        notes: 'updated',
        createdAt: new Date('2026-03-23T00:00:00Z'),
        healthStatus: 'healthy',
        lastHealthCheck: null,
      } as never)

      const response = await putProviders(jsonRequest('http://localhost/api/admin/providers', {
        id: 'provider-1',
        role: 'fallback_1',
        max_tokens: 2048,
      }, 'PUT'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmProviderRegistry.updateProvider).toHaveBeenCalledWith('provider-1', expect.objectContaining({
        role: 'fallback_1',
        maxTokens: 2048,
      }))
      expect(payload.provider.role).toBe('fallback_1')
    })

    it('returns test results for a specific provider', async () => {
      mockLlmProviderRegistry.testProvider.mockResolvedValue({
        success: true,
        latencyMs: 37,
        error: null,
      } as never)

      const response = await postSystemProviderTest(
        jsonRequest('http://localhost/api/admin/system/providers/provider-1/test', {
          message: 'ping',
        }),
        { params: Promise.resolve({ id: 'provider-1' }) }
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmProviderRegistry.testProvider).toHaveBeenCalledWith('provider-1', 'ping')
      expect(payload).toEqual({
        success: true,
        latencyMs: 37,
        error: null,
      })
    })

    it('returns test results for a provider via query action', async () => {
      mockLlmProviderRegistry.testProvider.mockResolvedValue({
        success: true,
        latencyMs: 19,
        error: null,
      } as never)

      const response = await getProviders(new Request('http://localhost/api/admin/providers?action=test&id=provider-1', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmProviderRegistry.testProvider).toHaveBeenCalledWith('provider-1')
      expect(payload).toEqual({
        success: true,
        result: {
          success: true,
          latencyMs: 19,
          error: null,
        },
      })
    })
  })

  describe('connectors route', () => {
    it('rejects invalid connector payloads', async () => {
      const response = await postConnectors(jsonRequest('http://localhost/api/admin/connectors', {
        name: 'Punjab AQI',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.success).toBe(false)
      expect(payload.error.code).toBe('VALIDATION_ERROR')
      expect(payload.error.message).toBe('Validation failed')
      expect(payload.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'connectorType',
          }),
          expect.objectContaining({
            path: 'endpointUrl',
          }),
        ])
      )
    })

    it('strips apiKeyEnvVar from connector list responses', async () => {
      mockDataConnectorService.getConnectors.mockResolvedValue([
        {
          id: 'connector-1',
          name: 'Punjab AQI',
          displayName: 'Punjab AQI',
          connectorType: 'aqi',
          endpointUrl: 'https://example.com/aqi',
          apiKeyEnvVar: 'CONNECTOR_AQI_KEY',
          authMethod: 'api_key',
          requestMethod: 'GET',
          injectAs: 'system_context',
          isActive: true,
          refreshIntervalSec: 300,
          cacheEnabled: true,
          cacheTtlSec: 300,
          requestCount: 0,
          errorCount: 0,
          topicMappings: [],
        },
      ] as never)
      process.env.CONNECTOR_AQI_KEY = 'configured'

      const response = await getConnectors(new Request('http://localhost/api/admin/connectors', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.connectors[0]).toMatchObject({
        id: 'connector-1',
        hasApiKey: true,
      })
      expect(payload.connectors[0].apiKeyEnvVar).toBeUndefined()

      delete process.env.CONNECTOR_AQI_KEY
    })

    it('creates a connector with validated input', async () => {
      mockDataConnectorService.addConnector.mockResolvedValue({
        id: 'connector-1',
        name: 'Punjab AQI',
        displayName: 'Punjab AQI',
      } as never)

      const response = await postConnectors(jsonRequest('http://localhost/api/admin/connectors', {
        name: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockDataConnectorService.addConnector).toHaveBeenCalledWith({
        name: 'Punjab AQI',
        displayName: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
        apiKeyEnvVar: undefined,
        authMethod: undefined,
        authHeader: undefined,
        requestMethod: undefined,
        requestBodyTemplate: undefined,
        responseMapping: undefined,
        injectAs: undefined,
        injectionTemplate: undefined,
        refreshIntervalSec: undefined,
        cacheEnabled: undefined,
        cacheTtlSec: undefined,
        topics: undefined,
      })
      expect(payload.connector.id).toBe('connector-1')
    })

    it('accepts common connector env var names that do not use a CONNECTOR_ prefix', async () => {
      mockDataConnectorService.addConnector.mockResolvedValue({
        id: 'connector-2',
        name: 'Punjab AQI',
        displayName: 'Punjab AQI',
      } as never)

      const response = await postConnectors(jsonRequest('http://localhost/api/admin/connectors', {
        name: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
        apiKeyEnvVar: 'AQI_API_KEY',
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockDataConnectorService.addConnector).toHaveBeenCalledWith(expect.objectContaining({
        apiKeyEnvVar: 'AQI_API_KEY',
      }))
      expect(payload.connector.id).toBe('connector-2')
    })

    it('returns 404 when deleting a missing connector', async () => {
      mockDataConnectorService.deleteConnector.mockResolvedValue(false)

      const response = await deleteConnectors(new Request('http://localhost/api/admin/connectors?id=connector-1', {
        method: 'DELETE',
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Connector not found')
    })
  })

  describe('pipeline route', () => {
    it('returns health information', async () => {
      mockLlmRouter.healthCheck.mockResolvedValue({
        status: 'healthy',
        providers: {},
        connectors: {},
      } as never)

      const response = await getPipeline(new Request('http://localhost/api/admin/pipeline?action=health', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.health.status).toBe('healthy')
    })

    it('rejects pipeline queries without a valid prompt', async () => {
      const response = await postPipeline(jsonRequest('http://localhost/api/admin/pipeline', {}))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toBe('Invalid pipeline query')
    })

    it('processes a validated pipeline query', async () => {
      mockLlmRouter.processQuery.mockResolvedValue({
        success: true,
        content: 'Use the latest AQI data for Lahore.',
        providerUsed: 'OpenAI',
        modelUsed: 'gpt-4o',
        latencyMs: 42,
        enrichedContext: {
          connectorsUsed: ['Punjab AQI'],
          liveDataCitations: [],
        },
      } as never)

      const response = await postPipeline(jsonRequest('http://localhost/api/admin/pipeline', {
        query: 'What is the air quality in Lahore?',
        audienceType: 'General Public',
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmRouter.processQuery).toHaveBeenCalledWith({
        query: 'What is the air quality in Lahore?',
        sessionId: undefined,
        audienceType: 'General Public',
        category: undefined,
        location: undefined,
        conversationHistory: undefined,
      })
      expect(payload.content).toBe('Use the latest AQI data for Lahore.')
    })
  })
})
