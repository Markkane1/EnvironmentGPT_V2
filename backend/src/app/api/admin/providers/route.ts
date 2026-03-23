// =====================================================
// EPA Punjab EnvironmentGPT - LLM Providers API
// Admin endpoints for managing LLM providers
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { z } from 'zod'

const createProviderSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1).optional(),
  providerType: z.enum(['openai_compat', 'ollama', 'azure']).optional(),
  baseUrl: z.string().min(1),
  apiKeyEnvVar: z.string().optional(),
  modelId: z.string().min(1),
  defaultParams: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(['primary', 'fallback_1', 'fallback_2', 'available']).optional(),
  priority: z.number().int().optional()
})

// GET /api/admin/providers - List all providers
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ success: true, chain })
    }

    // Default: list all providers
    const providers = await llmProviderRegistry.getProviders()
    return NextResponse.json({
      success: true,
      providers: providers.map(p => ({
        ...p,
        hasApiKey: !!p.apiKeyEnvVar && !!process.env[p.apiKeyEnvVar]
      }))
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProviderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider configuration' },
        { status: 400 }
      )
    }

    const providerInput = parsed.data

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

    return NextResponse.json({ success: true, provider })
  } catch (error) {
    console.error('[API] Failed to create provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/providers - Update provider
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    const provider = await llmProviderRegistry.updateProvider(id, updates)

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, provider })
  } catch (error) {
    console.error('[API] Failed to update provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update provider' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/providers - Delete provider
export async function DELETE(request: NextRequest) {
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
