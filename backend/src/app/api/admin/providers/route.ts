// =====================================================
// EPA Punjab EnvironmentGPT - LLM Providers API
// Admin endpoints for managing LLM providers
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { stripSecretFields, validateEnvVarName, validateExternalUrl } from '@/lib/security/ssrf-guard'
import { runRouteMiddleware } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { createValidationErrorResponse } from '@/lib/validators'
import { z } from 'zod'

const PROVIDER_ENV_VAR_PREFIXES = ['PROVIDER_']
const MAX_URL_LENGTH = 2048
const MAX_NAME_LENGTH = 255
const MAX_ENV_VAR_LENGTH = 255
const MAX_MODEL_ID_LENGTH = 255
const MAX_PROVIDER_PRIORITY = 1000

const createProviderSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  providerType: z.enum(['openai_compat', 'ollama', 'azure']).optional(),
  baseUrl: z.string().trim().min(1).max(MAX_URL_LENGTH),
  apiKeyEnvVar: z.string().trim().min(1).max(MAX_ENV_VAR_LENGTH).optional(),
  modelId: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH),
  defaultParams: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(['primary', 'fallback_1', 'fallback_2', 'available']).optional(),
  priority: z.number().int().min(1).max(MAX_PROVIDER_PRIORITY).optional()
})

const updateProviderSchema = z.object({
  id: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  providerType: z.enum(['openai_compat', 'ollama', 'azure']).optional(),
  baseUrl: z.string().trim().min(1).max(MAX_URL_LENGTH).optional(),
  apiKeyEnvVar: z.string().trim().min(1).max(MAX_ENV_VAR_LENGTH).optional(),
  modelId: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH).optional(),
  defaultParams: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(['primary', 'fallback_1', 'fallback_2', 'available']).optional(),
  priority: z.number().int().min(1).max(MAX_PROVIDER_PRIORITY).optional()
})

function sanitizeProvider(provider: Record<string, unknown>) {
  const safeProvider = stripSecretFields(provider)

  return {
    ...safeProvider,
    hasApiKey: typeof provider.apiKeyEnvVar === 'string' && !!process.env[provider.apiKeyEnvVar]
  }
}

// GET /api/admin/providers - List all providers
async function handleGet(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = await llmProviderRegistry.getStats()
      return NextResponse.json({ success: true, stats })
    }

    if (action === 'health') {
      const health = await llmProviderRegistry.healthCheckAll()
      return NextResponse.json({ success: true, health })
    }

    if (action === 'chain') {
      const chain = await llmProviderRegistry.getProviderChain()
      return NextResponse.json({
        success: true,
        chain: chain.map(provider => sanitizeProvider(provider as unknown as Record<string, unknown>))
      })
    }

    // Default: list all providers
    const providers = await llmProviderRegistry.getProviders()
    return NextResponse.json({
      success: true,
      providers: providers.map(provider => sanitizeProvider(provider as unknown as Record<string, unknown>))
    })
  } catch (error) {
    console.error('[API] Failed to get providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve providers' },
      { status: 500 }
    )
  }
}

// POST /api/admin/providers - Create new provider
async function handlePost(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = createProviderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const providerInput = parsed.data

    const envVarError = validateEnvVarName(providerInput.apiKeyEnvVar, PROVIDER_ENV_VAR_PREFIXES)
    if (envVarError) {
      return NextResponse.json(
        { success: false, error: `Invalid apiKeyEnvVar: ${envVarError}` },
        { status: 400 }
      )
    }

    const ssrfError = await validateExternalUrl(providerInput.baseUrl)
    if (ssrfError) {
      return NextResponse.json(
        { success: false, error: `Invalid baseUrl: ${ssrfError}` },
        { status: 400 }
      )
    }

    const provider = await llmProviderRegistry.addProvider({
      name: providerInput.name,
      displayName: providerInput.displayName || providerInput.name,
      providerType: providerInput.providerType || 'openai_compat',
      baseUrl: providerInput.baseUrl,
      apiKeyEnvVar: providerInput.apiKeyEnvVar,
      modelId: providerInput.modelId,
      defaultParams: providerInput.defaultParams,
      role: providerInput.role || 'available',
      priority: providerInput.priority
    })

    return NextResponse.json({
      success: true,
      provider: sanitizeProvider(provider as unknown as Record<string, unknown>)
    })
  } catch (error) {
    console.error('[API] Failed to create provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/providers - Update provider
async function handlePut(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = updateProviderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    if (updates.baseUrl) {
      const ssrfError = await validateExternalUrl(updates.baseUrl)
      if (ssrfError) {
        return NextResponse.json(
          { success: false, error: `Invalid baseUrl: ${ssrfError}` },
          { status: 400 }
        )
      }
    }

    if (typeof updates.apiKeyEnvVar === 'string') {
      const envVarError = validateEnvVarName(updates.apiKeyEnvVar, PROVIDER_ENV_VAR_PREFIXES)
      if (envVarError) {
        return NextResponse.json(
          { success: false, error: `Invalid apiKeyEnvVar: ${envVarError}` },
          { status: 400 }
        )
      }
    }

    const provider = await llmProviderRegistry.updateProvider(id, updates)

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      provider: sanitizeProvider(provider as unknown as Record<string, unknown>)
    })
  } catch (error) {
    console.error('[API] Failed to update provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update provider' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/providers - Delete provider
async function handleDelete(request: NextRequest) {
  const authError = await runRouteMiddleware(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    const deleted = await llmProviderRegistry.deleteProvider(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Provider deleted' })
  } catch (error) {
    console.error('[API] Failed to delete provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete provider' },
      { status: 500 }
    )
  }
}


export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'admin')
export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'admin')
export const PUT = withRateLimit((request) => handlePut(request as NextRequest), 'admin')
export const DELETE = withRateLimit((request) => handleDelete(request as NextRequest), 'admin')
