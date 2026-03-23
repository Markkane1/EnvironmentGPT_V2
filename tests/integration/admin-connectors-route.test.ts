import { NextRequest } from 'next/server'
import { createAuthHeaders } from '../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    dataConnector: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    connectorCache: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { GET } from '@/app/api/admin/connectors/route'

const fetchMock = global.fetch as jest.Mock

describe('/api/admin/connectors?action=test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.mockReset()
  })

  it('tests a connector successfully on a cold service cache', async () => {
    ;(db.dataConnector.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'connector-1',
        name: 'Punjab AQI',
        displayName: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
        apiKeyEnvVar: null,
        authMethod: 'none',
        authHeader: null,
        requestMethod: 'GET',
        requestBodyTemplate: null,
        responseMapping: null,
        injectAs: 'system_context',
        injectionTemplate: null,
        isActive: true,
        refreshIntervalSec: 300,
        cacheEnabled: false,
        cacheTtlSec: 300,
        lastFetchedAt: null,
        lastFetchStatus: null,
        lastFetchError: null,
        requestCount: 0,
        errorCount: 0,
        topicMappings: [],
      },
    ])
    ;(db.connectorCache.findFirst as jest.Mock).mockResolvedValue(null)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ aqi: 42 }),
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/connectors?action=test&id=connector-1', {
        headers: createAuthHeaders('admin', 'admin-user'),
      })
    )
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.result.success).toBe(true)
    expect(body.result.data).toEqual({ aqi: 42 })
    expect(db.dataConnector.findMany).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/aqi',
      expect.objectContaining({ method: 'GET' })
    )
  })
})
