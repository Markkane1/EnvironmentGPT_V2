// =====================================================
// EPA Punjab EnvironmentGPT - LLM Router Service
// Unified LLM orchestration with context enrichment
// Combines Provider Registry + Data Connector Layer
// =====================================================

import { llmProviderRegistry, ChatCompletionRequest } from './llm-provider-registry'
import { dataConnectorService, EnrichedContext, ConnectorType } from './data-connector-service'
import { db } from '@/lib/db'

// ==================== Types ====================

export interface RouterRequest {
  query: string
  sessionId?: string
  audienceType?: 'General Public' | 'Technical' | 'Policy Maker'
  category?: string
  location?: string
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface RouterResponse {
  success: boolean
  content: string
  providerUsed: string
  modelUsed: string
  latencyMs: number
  fallbackChain?: string[]
  enrichedContext: {
    connectorsUsed: string[]
    liveDataCitations: Array<{
      source: string
      type: ConnectorType
      timestamp: Date
    }>
  }
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  error?: string
}

export interface PipelineStats {
  providers: {
    total: number
    active: number
    healthy: number
  }
  connectors: {
    total: number
    active: number
    byType: Record<ConnectorType, number>
  }
  recentRequests: {
    total: number
    successRate: number
    avgLatencyMs: number
  }
}

// ==================== Topic Detection ====================

const TOPIC_KEYWORDS: Record<string, string[]> = {
  air_quality: [
    'air', 'aqi', 'pollution', 'pm2.5', 'pm10', 'smog', 'dust', 'emissions',
    'air quality', 'clean air', 'respiratory', 'breathing', 'lungs',
    'no2', 'so2', 'ozone', 'co', 'nitrogen', 'sulfur', 'carbon monoxide'
  ],
  water: [
    'water', 'river', 'groundwater', 'drinking water', 'contamination',
    'ph', 'tds', 'turbidity', 'neqs water', 'aquifer', 'irrigation',
    'ravi', 'chenab', 'sutlej', 'indus', 'water quality'
  ],
  climate: [
    'climate', 'weather', 'temperature', 'rainfall', 'drought', 'flood',
    'global warming', 'carbon', 'greenhouse', 'emission', 'mitigation',
    'adaptation', 'monsoon', 'heat wave'
  ],
  waste: [
    'waste', 'garbage', 'landfill', 'recycling', 'hazardous', 'disposal',
    'solid waste', 'industrial waste', 'medical waste', 'e-waste'
  ],
  biodiversity: [
    'biodiversity', 'species', 'wildlife', 'forest', 'ecosystem',
    'conservation', 'habitat', 'endangered', 'flora', 'fauna'
  ],
  policy: [
    'law', 'regulation', 'policy', 'epa', 'compliance', 'permit',
    'neqs', 'standard', 'guideline', 'legislation', 'penalty'
  ]
}

/**
 * Detect topic from query
 */
function detectTopic(query: string): string {
  const lowerQuery = query.toLowerCase()

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return topic
      }
    }
  }

  return 'general'
}

// ==================== LLM Router Service ====================

class LLMRouterService {
  /**
   * Process a query through the complete pipeline
   * 1. Detect topic
   * 2. Enrich context with live data
   * 3. Build prompt with context
   * 4. Call LLM with fallback
   * 5. Return enriched response
   */
  async processQuery(request: RouterRequest): Promise<RouterResponse> {
    const startTime = Date.now()

    try {
      // Step 1: Detect topic
      const topic = request.category ? request.category.toLowerCase().replace(' ', '_') : detectTopic(request.query)

      // Step 2: Enrich context with live data
      const enrichedContext = await dataConnectorService.enrichContext(topic, {
        location: request.location,
        query: request.query
      })

      // Step 3: Build system prompt
      const systemPrompt = this.buildSystemPrompt(
        topic,
        request.audienceType || 'General Public',
        enrichedContext
      )

      // Step 4: Build messages array
      const messages: ChatCompletionRequest['messages'] = [
        { role: 'system', content: systemPrompt }
      ]

      // Add conversation history if provided
      if (request.conversationHistory && request.conversationHistory.length > 0) {
        for (const msg of request.conversationHistory) {
          messages.push(msg)
        }
      }

      // Add current query (potentially enriched)
      const userContent = enrichedContext.userContext
        ? `${request.query}\n\nContext:\n${enrichedContext.userContext}`
        : request.query

      messages.push({ role: 'user', content: userContent })

      // Step 5: Call LLM with automatic fallback
      const llmResult = await llmProviderRegistry.chatCompletion({
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })

      // Step 6: Log the request
      await this.logRequest({
        sessionId: request.sessionId,
        query: request.query,
        topic,
        providerUsed: llmResult.providerUsed,
        modelUsed: llmResult.modelUsed,
        latencyMs: llmResult.latencyMs,
        status: llmResult.success ? 'success' : 'error',
        errorMessage: llmResult.error,
        fallbackFrom: llmResult.fallbackChain?.[0],
        fallbackTo: llmResult.fallbackChain?.[llmResult.fallbackChain.length - 1]
      })

      const totalLatencyMs = Date.now() - startTime

      return {
        success: llmResult.success,
        content: llmResult.response?.choices[0]?.message?.content || '',
        providerUsed: llmResult.providerUsed || 'unknown',
        modelUsed: llmResult.modelUsed || 'unknown',
        latencyMs: totalLatencyMs,
        fallbackChain: llmResult.fallbackChain,
        enrichedContext: {
          connectorsUsed: enrichedContext.connectorsUsed,
          liveDataCitations: enrichedContext.liveDataCitations
        },
        tokens: llmResult.tokens,
        error: llmResult.error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        content: '',
        providerUsed: 'none',
        modelUsed: 'none',
        latencyMs: Date.now() - startTime,
        enrichedContext: {
          connectorsUsed: [],
          liveDataCitations: []
        },
        error: errorMessage
      }
    }
  }

  /**
   * Build system prompt with audience type and context
   */
  private buildSystemPrompt(
    topic: string,
    audienceType: 'General Public' | 'Technical' | 'Policy Maker',
    enrichedContext: EnrichedContext
  ): string {
    const audienceInstructions = this.getAudienceInstructions(audienceType)
    const topicContext = this.getTopicContext(topic)

    let systemPrompt = `You are EnvironmentGPT, an AI assistant specialized in environmental topics for Punjab, Pakistan. You provide accurate, helpful information about air quality, water resources, climate change, waste management, biodiversity, and environmental regulations.

## Audience: ${audienceType}
${audienceInstructions}

## Topic Context: ${topic}
${topicContext}
`

    // Add live data context if available
    if (enrichedContext.systemContext) {
      systemPrompt += `

## Live Data Context
The following real-time data has been retrieved to inform your response:
${enrichedContext.systemContext}

When referencing this live data, cite the source appropriately.
`
    }

    // Add post-retrieval context if available
    if (enrichedContext.postRetrievalContext) {
      systemPrompt += `

## Additional Context
${enrichedContext.postRetrievalContext}
`
    }

    // Add general instructions
    systemPrompt += `

## Response Guidelines
1. Be accurate and cite sources when possible
2. If live data is provided, incorporate it naturally into your response
3. Be honest about uncertainty - if you don't know something, say so
4. Keep responses focused and relevant to Punjab's environmental context
5. Use appropriate technical depth for the audience type
6. If the question is outside environmental scope, politely redirect

Stay within the environmental domain. Do not provide advice on medical, legal, or other non-environmental topics unless they directly relate to environmental health or regulations.`

    return systemPrompt
  }

  /**
   * Get audience-specific instructions
   */
  private getAudienceInstructions(audienceType: string): string {
    switch (audienceType) {
      case 'Technical':
        return `
- Use scientific terminology and technical language
- Include specific measurements, units, and thresholds
- Reference regulatory standards (NEQS, WHO guidelines)
- Provide detailed methodology when relevant
- Include quantitative data and statistics`

      case 'Policy Maker':
        return `
- Focus on policy implications and regulatory context
- Highlight actionable recommendations
- Reference relevant laws, regulations, and policies
- Consider implementation challenges
- Provide comparative analysis when helpful`

      default: // General Public
        return `
- Use plain, accessible language
- Avoid technical jargon or explain it when necessary
- Focus on practical, actionable information
- Explain health implications clearly
- Provide context for any technical terms used`
    }
  }

  /**
   * Get topic-specific context
   */
  private getTopicContext(topic: string): string {
    const contexts: Record<string, string> = {
      air_quality: `
Focus on air quality issues in Punjab, including:
- Air Quality Index (AQI) and health implications
- PM2.5, PM10, and gaseous pollutants
- Seasonal patterns (smog season October-February)
- NEQS standards and WHO guidelines
- Health protection measures`,

      water: `
Focus on water resources in Punjab, including:
- River systems (Ravi, Chenab, Sutlej, Indus)
- Groundwater quality and depletion
- NEQS water quality standards
- Drinking water safety
- Irrigation and agricultural water use`,

      climate: `
Focus on climate issues in Punjab, including:
- Climate change impacts on agriculture
- Monsoon patterns and variability
- Heat waves and extreme weather
- Adaptation and mitigation strategies
- Greenhouse gas emissions`,

      waste: `
Focus on waste management in Punjab, including:
- Solid waste management systems
- Hazardous waste regulations
- Industrial waste treatment
- Medical waste disposal
- Recycling initiatives`,

      biodiversity: `
Focus on biodiversity in Punjab, including:
- Native flora and fauna
- Protected areas and wetlands
- Endangered species
- Ecosystem services
- Conservation efforts`,

      policy: `
Focus on environmental policy in Punjab, including:
- EPA Punjab regulations
- National Environmental Quality Standards (NEQS)
- Environmental Impact Assessment requirements
- Compliance and enforcement
- International environmental agreements`
    }

    return contexts[topic] || 'Provide relevant environmental information for Punjab, Pakistan.'
  }

  /**
   * Log LLM request to database
   */
  private async logRequest(params: {
    sessionId?: string
    query: string
    topic: string
    providerUsed?: string
    modelUsed?: string
    latencyMs: number
    status: string
    errorMessage?: string
    fallbackFrom?: string
    fallbackTo?: string
  }): Promise<void> {
    try {
      // Find provider ID by name
      let providerId: string | null = null
      if (params.providerUsed) {
        const provider = await db.lLMProvider.findFirst({
          where: { name: params.providerUsed }
        })
        providerId = provider?.id || null
      }

      await db.lLMRequestLog.create({
        data: {
          providerId,
          sessionId: params.sessionId,
          query: params.query.substring(0, 500), // Truncate long queries
          modelUsed: params.modelUsed,
          latencyMs: params.latencyMs,
          status: params.status,
          errorMessage: params.errorMessage?.substring(0, 1000),
          fallbackFrom: params.fallbackFrom,
          fallbackTo: params.fallbackTo
        }
      })
    } catch (error) {
      console.error('[LLM Router] Failed to log request:', error)
    }
  }

  /**
   * Get pipeline statistics
   */
  async getStats(): Promise<PipelineStats> {
    const [providerStats, connectorStats, recentLogs] = await Promise.all([
      llmProviderRegistry.getStats(),
      dataConnectorService.getStats(),
      db.lLMRequestLog.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          latencyMs: true,
          status: true
        }
      })
    ])

    const totalRequests = recentLogs.length
    const successfulRequests = recentLogs.filter(l => l.status === 'success').length
    const avgLatencyMs = totalRequests > 0
      ? recentLogs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / totalRequests
      : 0

    return {
      providers: {
        total: providerStats.totalProviders,
        active: providerStats.activeProviders,
        healthy: providerStats.healthyProviders
      },
      connectors: {
        total: connectorStats.totalConnectors,
        active: connectorStats.activeConnectors,
        byType: connectorStats.connectorsByType
      },
      recentRequests: {
        total: totalRequests,
        successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
        avgLatencyMs
      }
    }
  }

  /**
   * Health check for entire pipeline
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    providers: Record<string, { healthy: boolean; latencyMs: number | null; error?: string }>
    connectors: Record<string, string>
  }> {
    const providerHealth = await llmProviderRegistry.healthCheckAll()
    const connectors = await dataConnectorService.getConnectors()
    const connectorHealth: Record<string, string> = {}

    for (const connector of connectors) {
      const testResult = await dataConnectorService.testConnector(connector.id)
      connectorHealth[connector.name] = testResult.success ? 'healthy' : 'unhealthy'
    }

    // Determine overall status
    const healthyProviders = Object.values(providerHealth).filter(status => status.healthy).length
    const totalProviders = Object.keys(providerHealth).length

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyProviders === 0 || totalProviders === 0) {
      status = 'unhealthy'
    } else if (healthyProviders < totalProviders) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    return { status, providers: providerHealth, connectors: connectorHealth }
  }

  /**
   * Simple chat method for quick queries
   */
  async chat(
    message: string,
    options?: {
      systemPrompt?: string
      audienceType?: 'General Public' | 'Technical' | 'Policy Maker'
    }
  ): Promise<string> {
    const result = await this.processQuery({
      query: message,
      audienceType: options?.audienceType
    })

    if (!result.success) {
      throw new Error(result.error || 'Chat failed')
    }

    return result.content
  }
}

// Export singleton instance
export const llmRouter = new LLMRouterService()

// Re-export types for convenience
export type { LLMProviderConfig, ChatCompletionRequest, ChatCompletionResponse } from './llm-provider-registry'
export type { DataConnectorConfig, ConnectorType as ConnectorTypeEnum } from './data-connector-service'
