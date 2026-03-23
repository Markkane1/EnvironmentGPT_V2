import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { dataConnectorService } from '@/lib/services/data-connector-service'
import { llmRouter } from '@/lib/services/llm-router-service'
import { validateExternalUrl } from '@/lib/security/ssrf-guard'
import { createAuthHeaders } from '../helpers/auth'
import {
  GET as getProviders,
  POST as postProviders,
  DELETE as deleteProviders,
} from '@/app/api/admin/providers/route'
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
    getProviders: jest.fn(),
    addProvider: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
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
}))

const mockLlmProviderRegistry = llmProviderRegistry as any
const mockDataConnectorService = dataConnectorService as any
const mockLlmRouter = llmRouter as any
const mockValidateExternalUrl = validateExternalUrl as jest.Mock

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

    it('strips apiKeyEnvVar from provider list responses', async () => {
      mockLlmProviderRegistry.getProviders.mockResolvedValue([
        {
          id: 'provider-1',
          name: 'OpenAI',
          displayName: 'OpenAI',
          providerType: 'openai_compat',
          baseUrl: 'https://api.openai.com/v1',
          apiKeyEnvVar: 'PROVIDER_OPENAI_KEY',
          modelId: 'gpt-4o',
          defaultParams: {},
          role: 'primary',
          priority: 1,
          isActive: true,
          healthStatus: 'healthy',
          requestCount: 0,
          errorCount: 0,
        },
      ] as never)
      process.env.PROVIDER_OPENAI_KEY = 'configured'

      const response = await getProviders(new Request('http://localhost/api/admin/providers', {
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.providers[0]).toMatchObject({
        id: 'provider-1',
        hasApiKey: true,
      })
      expect(payload.providers[0].apiKeyEnvVar).toBeUndefined()

      delete process.env.PROVIDER_OPENAI_KEY
    })

    it('creates a provider with validated input', async () => {
      mockLlmProviderRegistry.addProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'OpenAI',
        displayName: 'OpenAI',
      } as never)

      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
      }))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(mockLlmProviderRegistry.addProvider).toHaveBeenCalledWith({
        name: 'OpenAI',
        displayName: 'OpenAI',
        providerType: 'openai_compat',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: undefined,
        modelId: 'gpt-4o',
        defaultParams: undefined,
        role: 'available',
        priority: undefined,
      })
      expect(payload.provider.id).toBe('provider-1')
    })

    it('rejects provider env vars outside the allowlist', async () => {
      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        apiKeyEnvVar: 'OPENAI_API_KEY',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Invalid apiKeyEnvVar')
      expect(mockLlmProviderRegistry.addProvider).not.toHaveBeenCalled()
    })

    it('rejects provider URLs that fail SSRF validation', async () => {
      mockValidateExternalUrl.mockResolvedValue(
        'URL hostname resolves to a private or reserved IP address (127.0.0.1) and is not allowed.'
      )

      const response = await postProviders(jsonRequest('http://localhost/api/admin/providers', {
        name: 'OpenAI',
        baseUrl: 'https://internal.example',
        modelId: 'gpt-4o',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Invalid baseUrl')
      expect(mockLlmProviderRegistry.addProvider).not.toHaveBeenCalled()
    })

    it('returns 404 when deleting a missing provider', async () => {
      mockLlmProviderRegistry.deleteProvider.mockResolvedValue(false)

      const response = await deleteProviders(new Request('http://localhost/api/admin/providers?id=provider-1', {
        method: 'DELETE',
        headers: createAuthHeaders('admin', 'admin-user'),
      }))
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toBe('Provider not found')
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

    it('rejects connector env vars outside the allowlist', async () => {
      const response = await postConnectors(jsonRequest('http://localhost/api/admin/connectors', {
        name: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
        apiKeyEnvVar: 'AQI_API_KEY',
      }))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Invalid apiKeyEnvVar')
      expect(mockDataConnectorService.addConnector).not.toHaveBeenCalled()
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
