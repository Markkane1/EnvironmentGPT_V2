// =====================================================
// EPA Punjab EnvironmentGPT - Data Connectors API
// Admin endpoints for managing data connectors
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { dataConnectorService, ConnectorType } from '@/lib/services/data-connector-service'
import { z } from 'zod'

const createConnectorSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  connectorType: z.enum(['aqi', 'weather', 'water_quality', 'custom_api', 'database']),
  endpointUrl: z.string().min(1),
  apiKeyEnvVar: z.string().optional(),
  authMethod: z.enum(['none', 'api_key', 'bearer', 'basic', 'oauth2']).optional(),
  authHeader: z.string().optional(),
  requestMethod: z.enum(['GET', 'POST']).optional(),
  requestBodyTemplate: z.string().optional(),
  responseMapping: z.string().optional(),
  injectAs: z.enum(['system_context', 'user_context', 'post_retrieval']).optional(),
  injectionTemplate: z.string().optional(),
  refreshIntervalSec: z.number().int().positive().optional(),
  cacheEnabled: z.boolean().optional(),
  cacheTtlSec: z.number().int().positive().optional(),
  topics: z.array(z.object({
    topic: z.string().min(1),
    priority: z.number().int().positive().optional()
  })).optional()
})

// GET /api/admin/connectors - List all connectors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')
    const topic = searchParams.get('topic')

    if (action === 'stats') {
      const stats = await dataConnectorService.getStats()
      return NextResponse.json({ success: true, stats })
    }

    if (action === 'test' && id) {
      const result = await dataConnectorService.testConnector(id)
      return NextResponse.json({ success: true, result })
    }

    if (action === 'clear-cache') {
      await dataConnectorService.clearCache()
      return NextResponse.json({ success: true, message: 'Cache cleared' })
    }

    if (topic) {
      const connectors = await dataConnectorService.getConnectorsForTopic(topic)
      return NextResponse.json({ success: true, connectors })
    }

    // Default: list all connectors
    const connectors = await dataConnectorService.getConnectors()
    return NextResponse.json({
      success: true,
      connectors: connectors.map(c => ({
        ...c,
        hasApiKey: !!c.apiKeyEnvVar && !!process.env[c.apiKeyEnvVar]
      }))
    })
  } catch (error) {
    console.error('[API] Failed to get connectors:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve connectors' },
      { status: 500 }
    )
  }
}

// POST /api/admin/connectors - Create new connector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createConnectorSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid connector configuration' },
        { status: 400 }
      )
    }

    const connectorInput = parsed.data

    const connector = await dataConnectorService.addConnector({
      name: connectorInput.name,
      displayName: connectorInput.displayName || connectorInput.name,
      connectorType: connectorInput.connectorType as ConnectorType,
      endpointUrl: connectorInput.endpointUrl,
      apiKeyEnvVar: connectorInput.apiKeyEnvVar,
      authMethod: connectorInput.authMethod,
      authHeader: connectorInput.authHeader,
      requestMethod: connectorInput.requestMethod,
      requestBodyTemplate: connectorInput.requestBodyTemplate,
      responseMapping: connectorInput.responseMapping,
      injectAs: connectorInput.injectAs,
      injectionTemplate: connectorInput.injectionTemplate,
      refreshIntervalSec: connectorInput.refreshIntervalSec,
      cacheEnabled: connectorInput.cacheEnabled,
      cacheTtlSec: connectorInput.cacheTtlSec,
      topics: connectorInput.topics
    })

    return NextResponse.json({ success: true, connector })
  } catch (error) {
    console.error('[API] Failed to create connector:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create connector' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/connectors - Update connector
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connector ID is required' },
        { status: 400 }
      )
    }

    const connector = await dataConnectorService.updateConnector(id, updates)

    if (!connector) {
      return NextResponse.json(
        { success: false, error: 'Connector not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, connector })
  } catch (error) {
    console.error('[API] Failed to update connector:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update connector' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/connectors - Delete connector
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connector ID is required' },
        { status: 400 }
      )
    }

    const deleted = await dataConnectorService.deleteConnector(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Connector not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Connector deleted' })
  } catch (error) {
    console.error('[API] Failed to delete connector:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete connector' },
      { status: 500 }
    )
  }
}
