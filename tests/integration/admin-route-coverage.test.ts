import { NextRequest } from 'next/server'
import { clearRateLimitStore } from '@/lib/security/rate-limiter'
import { createAuthHeaders } from '../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    document: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    chatSession: {
      count: jest.fn(),
    },
    chatMessage: {
      count: jest.fn(),
    },
    feedback: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    lLMRequestLog: {
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/document-service', () => ({
  documentService: {
    getStatistics: jest.fn(),
  },
}))

jest.mock('@/lib/services/llm-provider-registry', () => ({
  llmProviderRegistry: {
    getStats: jest.fn(),
    healthCheckAll: jest.fn(),
    getProviderChain: jest.fn(),
    getAllProviders: jest.fn(),
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

jest.mock('@/lib/services/response-cache', () => ({
  responseCacheService: {
    getStats: jest.fn(),
    getPopularQueries: jest.fn(),
    isEnabled: jest.fn(),
    clear: jest.fn(),
    invalidatePattern: jest.fn(),
    invalidateOlderThan: jest.fn(),
    cleanup: jest.fn(),
    setEnabled: jest.fn(),
  },
}))

jest.mock('@/lib/security/ssrf-guard', () => ({
  ...jest.requireActual('@/lib/security/ssrf-guard'),
  validateExternalUrl: jest.fn().mockResolvedValue(null),
  validateProviderBaseUrl: jest.fn().mockReturnValue(null),
}))

import { db } from '@/lib/db'
import { documentService } from '@/lib/services/document-service'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { dataConnectorService } from '@/lib/services/data-connector-service'
import { llmRouter } from '@/lib/services/llm-router-service'
import { responseCacheService } from '@/lib/services/response-cache'
import { validateExternalUrl, validateProviderBaseUrl } from '@/lib/security/ssrf-guard'
import {
  GET as getAdminProviders,
  POST as postAdminProviders,
  PUT as putAdminProviders,
  DELETE as deleteAdminProviders,
} from '@/app/api/admin/providers/route'
import {
  GET as getAdminConnectors,
  PUT as putAdminConnectors,
} from '@/app/api/admin/connectors/route'
import { GET as getSystemProviders } from '@/app/api/admin/system/providers/route'
import {
  PUT as putSystemProvider,
  DELETE as deleteSystemProvider,
} from '@/app/api/admin/system/providers/[id]/route'
import { POST as postSystemProviderTest } from '@/app/api/admin/system/providers/[id]/test/route'
import {
  GET as getAdminPipeline,
  POST as postAdminPipeline,
} from '@/app/api/admin/pipeline/route'
import { GET as getCache, POST as postCache } from '@/app/api/cache/route'
import { GET as getStats } from '@/app/api/stats/route'
import {
  GET as getUsers,
  POST as postUsers,
  PATCH as patchUsers,
  DELETE as deleteUsers,
} from '@/app/api/users/route'

const mockDb = db as any
const mockDocumentService = documentService as any
const mockProviderRegistry = llmProviderRegistry as any
const mockConnectorService = dataConnectorService as any
const mockLlmRouter = llmRouter as any
const mockResponseCacheService = responseCacheService as any
const mockValidateExternalUrl = validateExternalUrl as jest.Mock
const mockValidateProviderBaseUrl = validateProviderBaseUrl as jest.Mock

process.env.JWT_SECRET = 'integration-secret'

function adminRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(createAuthHeaders('admin', 'admin-user'))) {
    headers.set(key, value)
  }

  return new NextRequest(url, {
    ...init,
    headers,
  })
}

function adminJsonRequest(url: string, method: string, body: unknown) {
  return adminRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('admin route coverage expansion', () => {
  beforeEach(() => {
    clearRateLimitStore()
    jest.clearAllMocks()
    mockValidateExternalUrl.mockResolvedValue(null)
    mockValidateProviderBaseUrl.mockReturnValue(null)
    mockResponseCacheService.getStats.mockReturnValue({
      totalEntries: 5,
      totalHits: 8,
      totalMisses: 2,
      hitRate: 0.8,
      memoryUsage: 4096,
    })
    mockResponseCacheService.getPopularQueries.mockReturnValue([
      { query: 'lahore aqi', hits: 3 },
    ])
    mockResponseCacheService.isEnabled.mockReturnValue(true)
  })

  describe('admin providers routes', () => {
    it('returns provider health and fallback chain payloads', async () => {
      mockProviderRegistry.healthCheckAll.mockResolvedValue({
        primary: { status: 'healthy' },
      } as never)
      mockProviderRegistry.getProviderChain.mockResolvedValue([
        {
          id: 'provider-1',
          name: 'Primary',
          displayName: 'Primary',
          providerType: 'openai_compat',
          baseUrl: 'https://api.example.com/v1',
          modelId: 'gpt-4o-mini',
          apiKeyEnvVar: null,
          role: 'primary',
          isActive: true,
          priority: 1,
          timeoutSeconds: 60,
          maxTokens: 1024,
          temperature: 0.1,
          notes: null,
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          healthStatus: 'healthy',
          lastHealthCheck: null,
          requestCount: 4,
          errorCount: 0,
          avgLatencyMs: 40,
        },
      ] as never)

      const healthResponse = await getAdminProviders(adminRequest('http://localhost/api/admin/providers?action=health'))
      const healthPayload = await healthResponse.json()
      const chainResponse = await getAdminProviders(adminRequest('http://localhost/api/admin/providers?action=chain'))
      const chainPayload = await chainResponse.json()

      expect(healthResponse.status).toBe(200)
      expect(healthPayload.health).toEqual({
        primary: { status: 'healthy' },
      })
      expect(chainResponse.status).toBe(200)
      expect(chainPayload.chain[0]).toMatchObject({
        id: 'provider-1',
        role: 'primary',
      })
    })

    it('returns a safe 500 when provider creation throws unexpectedly', async () => {
      mockProviderRegistry.addProvider.mockRejectedValue(new Error('provider insert failed'))

      const response = await postAdminProviders(adminJsonRequest('http://localhost/api/admin/providers', 'POST', {
        name: 'OpenAI',
        baseUrl: 'https://api.example.com/v1',
        modelId: 'gpt-4o-mini',
      }))
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Failed to create provider',
      })
    })

    it('updates and deletes providers through the path-param system routes', async () => {
      mockProviderRegistry.updateProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'OpenAI',
        displayName: 'OpenAI',
        providerType: 'openai_compat',
        baseUrl: 'https://api.example.com/v1',
        modelId: 'gpt-5-mini',
        apiKeyEnvVar: null,
        role: 'fallback_1',
        isActive: true,
        priority: 2,
        timeoutSeconds: 60,
        maxTokens: 2048,
        temperature: 0.2,
        notes: 'updated',
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        healthStatus: 'healthy',
        lastHealthCheck: null,
        requestCount: 0,
        errorCount: 0,
        avgLatencyMs: null,
      } as never)
      mockProviderRegistry.deleteProvider.mockResolvedValue({ success: true } as never)

      const updateResponse = await putSystemProvider(
        adminJsonRequest('http://localhost/api/admin/system/providers/provider-1', 'PUT', {
          role: 'fallback_1',
          modelId: 'gpt-5-mini',
        }),
        { params: Promise.resolve({ id: 'provider-1' }) }
      )
      const updatePayload = await updateResponse.json()
      const deleteResponse = await deleteSystemProvider(
        adminRequest('http://localhost/api/admin/system/providers/provider-1', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'provider-1' }) }
      )
      const deletePayload = await deleteResponse.json()

      expect(updateResponse.status).toBe(200)
      expect(updatePayload.provider).toMatchObject({
        id: 'provider-1',
        role: 'fallback_1',
        modelId: 'gpt-5-mini',
      })
      expect(deleteResponse.status).toBe(200)
      expect(deletePayload).toEqual({
        success: true,
        message: 'Provider disabled',
      })
    })

    it('returns 502 when a provider health test fails at the provider layer', async () => {
      mockProviderRegistry.testProvider.mockResolvedValue({
        success: false,
        latencyMs: 80,
        error: 'Connection refused',
      } as never)

      const response = await postSystemProviderTest(
        adminJsonRequest('http://localhost/api/admin/system/providers/provider-1/test', 'POST', {
          message: 'ping',
        }),
        { params: Promise.resolve({ id: 'provider-1' }) }
      )
      const payload = await response.json()

      expect(response.status).toBe(502)
      expect(payload).toEqual({
        success: false,
        latencyMs: 80,
        error: 'Connection refused',
      })
    })

    it('lists system providers for the spec-aligned admin route', async () => {
      mockProviderRegistry.availableProviders.mockResolvedValue([
        { id: 'provider-1', name: 'Primary' },
      ] as never)

      const response = await getSystemProviders(adminRequest('http://localhost/api/admin/system/providers'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload).toEqual({
        success: true,
        providers: [{ id: 'provider-1', name: 'Primary' }],
      })
    })
  })

  describe('admin connectors routes', () => {
    it('filters connectors by topic and updates connector records', async () => {
      mockConnectorService.getConnectorsForTopic.mockResolvedValue([
        {
          id: 'connector-1',
          name: 'Punjab AQI',
          displayName: 'Punjab AQI',
          connectorType: 'aqi',
          endpointUrl: 'https://example.com/aqi',
          apiKeyEnvVar: 'AQI_API_KEY',
          authMethod: 'api_key',
          requestMethod: 'GET',
          injectAs: 'system_context',
          isActive: true,
          refreshIntervalSec: 300,
          cacheEnabled: true,
          cacheTtlSec: 300,
          requestCount: 5,
          errorCount: 0,
          topicMappings: [],
        },
      ] as never)
      mockConnectorService.updateConnector.mockResolvedValue({
        id: 'connector-1',
        name: 'Punjab AQI',
        displayName: 'AQI',
        endpointUrl: 'https://example.com/new-aqi',
      } as never)

      const listResponse = await getAdminConnectors(adminRequest('http://localhost/api/admin/connectors?topic=air'))
      const listPayload = await listResponse.json()
      const updateResponse = await putAdminConnectors(adminJsonRequest('http://localhost/api/admin/connectors', 'PUT', {
        id: 'connector-1',
        endpointUrl: 'https://example.com/new-aqi',
      }))
      const updatePayload = await updateResponse.json()

      expect(listResponse.status).toBe(200)
      expect(listPayload.connectors[0]).toMatchObject({
        id: 'connector-1',
        hasApiKey: false,
      })
      expect(listPayload.connectors[0].apiKeyEnvVar).toBeUndefined()
      expect(updateResponse.status).toBe(200)
      expect(updatePayload.connector).toMatchObject({
        id: 'connector-1',
        endpointUrl: 'https://example.com/new-aqi',
      })
    })

    it('clears cached connector data and returns a safe 500 when updates fail unexpectedly', async () => {
      mockConnectorService.clearCache.mockResolvedValue(undefined as never)
      mockConnectorService.updateConnector.mockRejectedValue(new Error('connector update failed'))

      const clearResponse = await getAdminConnectors(adminRequest('http://localhost/api/admin/connectors?action=clear-cache'))
      const clearPayload = await clearResponse.json()
      const errorResponse = await putAdminConnectors(adminJsonRequest('http://localhost/api/admin/connectors', 'PUT', {
        id: 'connector-1',
        endpointUrl: 'https://example.com/new-aqi',
      }))
      const errorPayload = await errorResponse.json()

      expect(clearResponse.status).toBe(200)
      expect(clearPayload).toEqual({
        success: true,
        message: 'Cache cleared',
      })
      expect(errorResponse.status).toBe(500)
      expect(errorPayload).toEqual({
        success: false,
        error: 'Failed to update connector',
      })
    })
  })

  describe('admin pipeline route', () => {
    it('returns pipeline stats and a safe 500 on downstream execution failure', async () => {
      mockLlmRouter.getStats.mockResolvedValue({
        totalRequests: 42,
        successRate: 0.95,
      } as never)
      mockLlmRouter.processQuery.mockRejectedValue(new Error('router failed'))

      const statsResponse = await getAdminPipeline(adminRequest('http://localhost/api/admin/pipeline'))
      const statsPayload = await statsResponse.json()
      const errorResponse = await postAdminPipeline(adminJsonRequest('http://localhost/api/admin/pipeline', 'POST', {
        query: 'What is the AQI in Lahore?',
      }))
      const errorPayload = await errorResponse.json()

      expect(statsResponse.status).toBe(200)
      expect(statsPayload).toEqual({
        success: true,
        stats: {
          totalRequests: 42,
          successRate: 0.95,
        },
      })
      expect(errorResponse.status).toBe(500)
      expect(errorPayload).toEqual({
        success: false,
        error: 'Pipeline query failed',
      })
    })
  })

  describe('cache route', () => {
    it('returns cache statistics and supports clear, invalidate_old, cleanup, and toggle actions', async () => {
      mockResponseCacheService.invalidateOlderThan.mockReturnValue(2)
      mockResponseCacheService.cleanup.mockReturnValue(1)
      mockResponseCacheService.setEnabled.mockImplementation(() => {
        mockResponseCacheService.isEnabled.mockReturnValue(false)
      })

      const getResponse = await getCache(adminRequest('http://localhost/api/cache'))
      const getPayload = await getResponse.json()
      const clearResponse = await postCache(adminJsonRequest('http://localhost/api/cache', 'POST', { action: 'clear' }))
      const oldResponse = await postCache(adminJsonRequest('http://localhost/api/cache', 'POST', {
        action: 'invalidate_old',
        params: { maxAgeMs: 60000 },
      }))
      const cleanupResponse = await postCache(adminJsonRequest('http://localhost/api/cache', 'POST', { action: 'cleanup' }))
      const toggleResponse = await postCache(adminJsonRequest('http://localhost/api/cache', 'POST', {
        action: 'toggle',
        params: { enabled: false },
      }))

      expect(getResponse.status).toBe(200)
      expect(getPayload).toMatchObject({
        success: true,
        stats: {
          totalEntries: 5,
          hitRate: 0.8,
        },
        config: {
          enabled: true,
        },
      })
      expect((await clearResponse.json()).message).toBe('Cache cleared successfully')
      expect((await oldResponse.json()).invalidated).toBe(2)
      expect((await cleanupResponse.json()).cleaned).toBe(1)
      expect((await toggleResponse.json()).enabled).toBe(false)
    })

    it('returns a safe 500 when cache statistics retrieval throws', async () => {
      mockResponseCacheService.getStats.mockImplementation(() => {
        throw new Error('cache stats failed')
      })

      const response = await getCache(adminRequest('http://localhost/api/cache'))
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Failed to get cache statistics',
      })
    })
  })

  describe('stats route', () => {
    it('returns overview and config statistics payloads', async () => {
      mockDb.document.count.mockResolvedValue(3)
      mockDb.chatSession.count.mockResolvedValue(4)
      mockDb.chatMessage.count.mockResolvedValue(5)
      mockDb.feedback.count.mockResolvedValue(6)

      const overviewResponse = await getStats(adminRequest('http://localhost/api/stats?type=overview'))
      const overviewPayload = await overviewResponse.json()
      const configResponse = await getStats(adminRequest('http://localhost/api/stats?type=config'))
      const configPayload = await configResponse.json()

      expect(overviewResponse.status).toBe(200)
      expect(overviewPayload.statistics).toEqual({
        documents: 3,
        sessions: 4,
        messages: 5,
        feedback: 6,
      })
      expect(configResponse.status).toBe(200)
      expect(configPayload.success).toBe(true)
      expect(configPayload.config).toEqual(expect.objectContaining({
        app: expect.any(Object),
        limits: expect.any(Object),
        features: expect.any(Object),
      }))
    })

    it('returns 400 for an invalid stats type', async () => {
      const response = await getStats(adminRequest('http://localhost/api/stats?type=unsupported'))
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload).toEqual({
        success: false,
        error: 'Invalid stats type',
      })
    })
  })

  describe('users route', () => {
    it('filters users by role and creates a new user with hashed credentials', async () => {
      mockDb.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'admin@example.com',
          username: 'admin',
          name: 'Admin User',
          role: 'admin',
          department: 'Ops',
          isActive: true,
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
          _count: {
            chatSessions: 2,
            feedback: 1,
          },
        },
      ] as never)
      mockDb.user.findUnique
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
      mockDb.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'viewer@example.com',
        username: 'viewer',
        name: 'Viewer User',
        role: 'viewer',
        department: 'Air Quality',
        isActive: true,
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      } as never)

      const getResponse = await getUsers(adminRequest('http://localhost/api/users?role=admin'))
      const getPayload = await getResponse.json()
      const postResponse = await postUsers(adminJsonRequest('http://localhost/api/users', 'POST', {
        email: 'viewer@example.com',
        username: 'viewer',
        password: 'TestPass123!',
        name: 'Viewer User',
        role: 'viewer',
        department: 'Air Quality',
      }))
      const postPayload = await postResponse.json()

      expect(getResponse.status).toBe(200)
      expect(mockDb.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { role: 'admin' },
      }))
      expect(getPayload.users[0].role).toBe('admin')
      expect(postResponse.status).toBe(201)
      expect(postPayload.user).toMatchObject({
        id: 'user-2',
        email: 'viewer@example.com',
      })
      expect(mockDb.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'viewer@example.com',
          username: 'viewer',
          passwordHash: expect.any(String),
        }),
      })
    })

    it('returns 409 for duplicate emails and usernames', async () => {
      mockDb.user.findUnique.mockResolvedValueOnce({ id: 'existing-email' } as never)

      const duplicateEmailResponse = await postUsers(adminJsonRequest('http://localhost/api/users', 'POST', {
        email: 'viewer@example.com',
        username: 'viewer',
        name: 'Viewer User',
      }))
      const duplicateEmailPayload = await duplicateEmailResponse.json()

      mockDb.user.findUnique
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({ id: 'existing-username' } as never)

      const duplicateUsernameResponse = await postUsers(adminJsonRequest('http://localhost/api/users', 'POST', {
        email: 'viewer2@example.com',
        username: 'viewer',
        name: 'Viewer User',
      }))
      const duplicateUsernamePayload = await duplicateUsernameResponse.json()

      expect(duplicateEmailResponse.status).toBe(409)
      expect(duplicateEmailPayload.error).toBe('User with this email already exists')
      expect(duplicateUsernameResponse.status).toBe(409)
      expect(duplicateUsernamePayload.error).toBe('User with this username already exists')
    })

    it('updates and deactivates users and handles missing identifiers', async () => {
      mockDb.user.update
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'updated@example.com',
          username: 'viewer',
          name: 'Updated User',
          role: 'analyst',
          department: 'Water',
          isActive: true,
        } as never)
        .mockResolvedValueOnce({} as never)

      const patchResponse = await patchUsers(adminJsonRequest('http://localhost/api/users?id=user-1', 'PATCH', {
        email: 'updated@example.com',
        role: 'analyst',
      }))
      const patchPayload = await patchResponse.json()
      const deleteResponse = await deleteUsers(adminRequest('http://localhost/api/users?id=user-1', { method: 'DELETE' }))
      const deletePayload = await deleteResponse.json()
      const missingIdResponse = await patchUsers(adminJsonRequest('http://localhost/api/users', 'PATCH', {
        name: 'No Id',
      }))
      const missingIdPayload = await missingIdResponse.json()

      expect(patchResponse.status).toBe(200)
      expect(patchPayload.user).toMatchObject({
        id: 'user-1',
        role: 'analyst',
      })
      expect(deleteResponse.status).toBe(200)
      expect(deletePayload).toEqual({
        success: true,
        message: 'User deactivated successfully',
      })
      expect(missingIdResponse.status).toBe(400)
      expect(missingIdPayload).toEqual({
        success: false,
        error: 'User ID is required',
      })
    })

    it('returns a safe 500 when user creation throws unexpectedly', async () => {
      mockDb.user.findUnique
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
      mockDb.user.create.mockRejectedValue(new Error('insert failed'))

      const response = await postUsers(adminJsonRequest('http://localhost/api/users', 'POST', {
        email: 'viewer@example.com',
        username: 'viewer',
        password: 'TestPass123!',
        name: 'Viewer User',
      }))
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Failed to create user',
      })
    })
  })
})
