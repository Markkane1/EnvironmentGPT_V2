// =====================================================
// EPA Punjab EnvironmentGPT - Data Connectors API
// Admin endpoints for managing data connectors
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { dataConnectorService, ConnectorType } from '@/lib/services/data-connector-service'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { stripSecretFields, validateEnvVarName, validateExternalUrl } from '@/lib/security/ssrf-guard'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { createValidationErrorResponse } from '@/lib/validators'
import { z } from 'zod'

const CONNECTOR_ENV_VAR_PREFIXES: string[] = []
const MAX_URL_LENGTH = 2048
const MAX_NAME_LENGTH = 255
const MAX_HEADER_LENGTH = 255
const MAX_TEMPLATE_LENGTH = 10000
const MAX_ENV_VAR_LENGTH = 255
const MAX_TOPIC_PRIORITY = 1000
const MAX_INTERVAL_SECONDS = 604800

const createConnectorSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  connectorType: z.enum(['aqi', 'weather', 'water_quality', 'custom_api', 'database']),
  endpointUrl: z.string().trim().min(1).max(MAX_URL_LENGTH),
  apiKeyEnvVar: z.string().trim().min(1).max(MAX_ENV_VAR_LENGTH).optional(),
  authMethod: z.enum(['none', 'api_key', 'bearer', 'basic', 'oauth2']).optional(),
  authHeader: z.string().trim().min(1).max(MAX_HEADER_LENGTH).optional(),
  requestMethod: z.enum(['GET', 'POST']).optional(),
  requestBodyTemplate: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  responseMapping: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  injectAs: z.enum(['system_context', 'user_context', 'post_retrieval']).optional(),
  injectionTemplate: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  refreshIntervalSec: z.number().int().min(1).max(MAX_INTERVAL_SECONDS).optional(),
  cacheEnabled: z.boolean().optional(),
  cacheTtlSec: z.number().int().min(1).max(MAX_INTERVAL_SECONDS).optional(),
  topics: z.array(z.object({
    topic: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    priority: z.number().int().min(1).max(MAX_TOPIC_PRIORITY).optional()
  })).optional()
})

const updateConnectorSchema = z.object({
  id: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  connectorType: z.enum(['aqi', 'weather', 'water_quality', 'custom_api', 'database']).optional(),
  endpointUrl: z.string().trim().min(1).max(MAX_URL_LENGTH).optional(),
  apiKeyEnvVar: z.string().trim().min(1).max(MAX_ENV_VAR_LENGTH).optional(),
  authMethod: z.enum(['none', 'api_key', 'bearer', 'basic', 'oauth2']).optional(),
  authHeader: z.string().trim().min(1).max(MAX_HEADER_LENGTH).optional(),
  requestMethod: z.enum(['GET', 'POST']).optional(),
  requestBodyTemplate: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  responseMapping: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  injectAs: z.enum(['system_context', 'user_context', 'post_retrieval']).optional(),
  injectionTemplate: z.string().max(MAX_TEMPLATE_LENGTH).optional(),
  refreshIntervalSec: z.number().int().min(1).max(MAX_INTERVAL_SECONDS).optional(),
  cacheEnabled: z.boolean().optional(),
  cacheTtlSec: z.number().int().min(1).max(MAX_INTERVAL_SECONDS).optional(),
  topics: z.array(z.object({
    topic: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    priority: z.number().int().min(1).max(MAX_TOPIC_PRIORITY).optional()
  })).optional()
})

function sanitizeConnector(connector: Record<string, unknown>) {
  const safeConnector = stripSecretFields(connector)

  return {
    ...safeConnector,
    hasApiKey: typeof connector.apiKeyEnvVar === 'string' && !!process.env[connector.apiKeyEnvVar]
  }
}

// GET /api/admin/connectors - List all connectors
async function handleGet(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

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
      return NextResponse.json({
        success: true,
        connectors: connectors.map(connector => sanitizeConnector(connector as unknown as Record<string, unknown>))
      })
    }

    // Default: list all connectors
    const connectors = await dataConnectorService.getConnectors()
    return NextResponse.json({
      success: true,
      connectors: connectors.map(connector => sanitizeConnector(connector as unknown as Record<string, unknown>))
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
async function handlePost(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = createConnectorSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const connectorInput = parsed.data

    const envVarError = validateEnvVarName(connectorInput.apiKeyEnvVar, CONNECTOR_ENV_VAR_PREFIXES)
    if (envVarError) {
      return NextResponse.json(
        { success: false, error: `Invalid apiKeyEnvVar: ${envVarError}` },
        { status: 400 }
      )
    }

    const ssrfError = await validateExternalUrl(connectorInput.endpointUrl)
    if (ssrfError) {
      return NextResponse.json(
        { success: false, error: `Invalid endpointUrl: ${ssrfError}` },
        { status: 400 }
      )
    }

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

    return NextResponse.json({
      success: true,
      connector: sanitizeConnector(connector as unknown as Record<string, unknown>)
    })
  } catch (error) {
    console.error('[API] Failed to create connector:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create connector' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/connectors - Update connector
async function handlePut(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = updateConnectorSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    if (updates.endpointUrl) {
      const ssrfError = await validateExternalUrl(updates.endpointUrl)
      if (ssrfError) {
        return NextResponse.json(
          { success: false, error: `Invalid endpointUrl: ${ssrfError}` },
          { status: 400 }
        )
      }
    }

    if (typeof updates.apiKeyEnvVar === 'string') {
      const envVarError = validateEnvVarName(updates.apiKeyEnvVar, CONNECTOR_ENV_VAR_PREFIXES)
      if (envVarError) {
        return NextResponse.json(
          { success: false, error: `Invalid apiKeyEnvVar: ${envVarError}` },
          { status: 400 }
        )
      }
    }

    const connector = await dataConnectorService.updateConnector(id, updates)

    if (!connector) {
      return NextResponse.json(
        { success: false, error: 'Connector not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      connector: sanitizeConnector(connector as unknown as Record<string, unknown>)
    })
  } catch (error) {
    console.error('[API] Failed to update connector:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update connector' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/connectors - Delete connector
async function handleDelete(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

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


export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'admin')
export const PUT = withRateLimit((request) => handlePut(request as NextRequest), 'admin')
export const DELETE = withRateLimit((request) => handleDelete(request as NextRequest), 'admin')
