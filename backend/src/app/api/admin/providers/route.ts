// =====================================================
// EPA Punjab EnvironmentGPT - LLM Providers API
// Admin endpoints for managing provider-registry entries
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { llmProviderRegistry, type LLMProviderConfig } from '@/lib/services/llm-provider-registry'
import { authenticateToken, requireAdmin } from '@/middleware/auth'
import { getRouteAuthContext } from '@/lib/route-middleware'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { createValidationErrorResponse } from '@/lib/validators'
import { validateEnvVarName, validateProviderBaseUrl } from '@/lib/security/ssrf-guard'

const MAX_NAME_LENGTH = 100
const MAX_URL_LENGTH = 500
const MAX_ENV_VAR_LENGTH = 100
const MAX_MODEL_ID_LENGTH = 200
const MAX_NOTES_LENGTH = 500

const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  providerType: z.enum(['openai_compat', 'ollama']).optional(),
  baseUrl: z.string().trim().min(1).max(MAX_URL_LENGTH),
  modelId: z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH),
  apiKeyEnvVar: z.string().trim().min(1).max(MAX_ENV_VAR_LENGTH).nullable().optional(),
  role: z.enum(['primary', 'fallback_1', 'fallback_2', 'available', 'disabled']).optional(),
  isActive: z.boolean().optional(),
  timeoutSeconds: z.number().int().min(1).max(3600).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
  temperature: z.number().min(0).max(2).optional(),
  notes: z.string().trim().max(MAX_NOTES_LENGTH).nullable().optional(),
}).strict()

const providerUpdateSchema = providerInputSchema.partial().extend({
  id: z.string().trim().min(1).max(255),
}).strict()

function normalizeProviderPayload(input: unknown): Record<string, unknown> {
  const value = (input && typeof input === 'object') ? input as Record<string, unknown> : {}

  return {
    id: value.id,
    name: value.name,
    providerType: value.providerType ?? value.provider_type,
    baseUrl: value.baseUrl ?? value.base_url,
    modelId: value.modelId ?? value.model_id,
    apiKeyEnvVar: value.apiKeyEnvVar ?? value.api_key_env_var ?? null,
    role: value.role,
    isActive: value.isActive ?? value.is_active,
    timeoutSeconds: value.timeoutSeconds ?? value.timeout_seconds,
    maxTokens: value.maxTokens ?? value.max_tokens,
    temperature: value.temperature,
    notes: value.notes ?? null,
  }
}

function serializeProvider(provider: LLMProviderConfig) {
  return {
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    modelId: provider.modelId,
    apiKeyEnvVar: provider.apiKeyEnvVar ?? null,
    role: provider.role,
    isActive: provider.isActive,
    timeoutSeconds: provider.timeoutSeconds,
    maxTokens: provider.maxTokens,
    temperature: provider.temperature,
    notes: provider.notes ?? null,
    hasApiKey: typeof provider.apiKeyEnvVar === 'string' && !!process.env[provider.apiKeyEnvVar],
    createdAt: provider.createdAt,
    healthStatus: provider.healthStatus,
    lastHealthCheck: provider.lastHealthCheck ?? null,
  }
}

async function validateProviderInput(input: {
  baseUrl?: string
  apiKeyEnvVar?: string | null
}) {
  if (input.baseUrl) {
    const baseUrlError = validateProviderBaseUrl(input.baseUrl)
    if (baseUrlError) {
      return `Invalid baseUrl: ${baseUrlError}`
    }
  }

  if (typeof input.apiKeyEnvVar === 'string') {
    const envVarError = validateEnvVarName(input.apiKeyEnvVar, [])
    if (envVarError) {
      return `Invalid apiKeyEnvVar: ${envVarError}`
    }
  }

  return null
}

export async function handleGet(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
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
        chain: chain.map(serializeProvider),
      })
    }

    const providers = await llmProviderRegistry.availableProviders()
    return NextResponse.json({
      success: true,
      providers,
    })
  } catch (error) {
    console.error('[API] Failed to get providers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve providers' },
      { status: 500 }
    )
  }
}

export async function handlePost(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = normalizeProviderPayload(await request.json())
    const parsed = providerInputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const inputError = await validateProviderInput(parsed.data)
    if (inputError) {
      return NextResponse.json(
        { success: false, error: inputError },
        { status: 400 }
      )
    }

    const provider = await llmProviderRegistry.addProvider({
      name: parsed.data.name,
      providerType: parsed.data.providerType || 'openai_compat',
      baseUrl: parsed.data.baseUrl,
      modelId: parsed.data.modelId,
      apiKeyEnvVar: parsed.data.apiKeyEnvVar || null,
      role: parsed.data.role || 'available',
      isActive: parsed.data.isActive ?? true,
      timeoutSeconds: parsed.data.timeoutSeconds,
      maxTokens: parsed.data.maxTokens,
      temperature: parsed.data.temperature,
      notes: parsed.data.notes || null,
      addedBy: user?.userId,
    })

    return NextResponse.json({
      success: true,
      provider: serializeProvider(provider),
    })
  } catch (error) {
    console.error('[API] Failed to create provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}

export async function handlePut(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
  if (authError) return authError

  try {
    const body = normalizeProviderPayload(await request.json())
    const parsed = providerUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data
    const inputError = await validateProviderInput(updates)
    if (inputError) {
      return NextResponse.json(
        { success: false, error: inputError },
        { status: 400 }
      )
    }

    const provider = await llmProviderRegistry.updateProvider(id, {
      name: updates.name,
      providerType: updates.providerType,
      baseUrl: updates.baseUrl,
      modelId: updates.modelId,
      apiKeyEnvVar: updates.apiKeyEnvVar,
      role: updates.role,
      isActive: updates.isActive,
      timeoutSeconds: updates.timeoutSeconds,
      maxTokens: updates.maxTokens,
      temperature: updates.temperature,
      notes: updates.notes,
    })

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      provider: serializeProvider(provider),
    })
  } catch (error) {
    console.error('[API] Failed to update provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update provider' },
      { status: 500 }
    )
  }
}

export async function handleDelete(request: NextRequest) {
  const { response: authError } = await getRouteAuthContext(request, authenticateToken, requireAdmin)
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

    if (!deleted.success && deleted.reason === 'not_found') {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    if (!deleted.success && deleted.reason === 'primary_delete_blocked') {
      return NextResponse.json(
        { success: false, error: 'Cannot disable the only active primary provider' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, message: 'Provider disabled' })
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
