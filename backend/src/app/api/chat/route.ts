// =====================================================
// EPA Punjab EnvironmentGPT - Enhanced Chat API
// Phase 4, 5 & 8+: Advanced RAG + Dynamic LLM Routing
// Uses vLLM with fallback chain (Qwen3-30B -> Mistral -> Qwen3-8B)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateToken } from '@/middleware/auth'
import { withRateLimit } from '@/lib/security/rate-limiter'
import { advancedEmbeddingService } from '@/lib/services/advanced-embedding-service'
import { queryProcessorService } from '@/lib/services/query-processor'
import { responseCacheService } from '@/lib/services/response-cache'
import { conversationMemoryService } from '@/lib/services/conversation-memory'
import { llmRouter } from '@/lib/services/llm-router-service'
import { llmProviderRegistry } from '@/lib/services/llm-provider-registry'
import { chatMessageSchema, createValidationErrorResponse } from '@/lib/validators'
import type { ChatResponse } from '@/types'
import { getRouteAuthContext } from '@/lib/route-middleware'

const ENVIRONMENTAL_KNOWLEDGE = [
  {
    id: 'air-quality',
    title: 'Air Quality Management in Punjab',
    category: 'Air Quality',
    content: `Air quality in Punjab is monitored through a network of stations measuring PM2.5, PM10, NOx, SO2, and Ozone.
Key challenges include vehicular emissions, industrial pollution, and stubble burning.
EPA Punjab implements the Punjab Clean Air Action Plan which includes:
- Vehicle emission testing programs
- Industrial emission standards enforcement
- Crop residue management initiatives
- Air quality index (AQI) public reporting system

The Air Quality Index (AQI) is calculated based on:
- PM2.5: Fine particulate matter < 2.5 micrometers
- PM10: Particulate matter < 10 micrometers
- Ozone (O3): Ground-level ozone
- Nitrogen Dioxide (NO2)
- Sulfur Dioxide (SO2)
- Carbon Monoxide (CO)`
  },
  {
    id: 'water-quality',
    title: 'Water Quality Standards and Monitoring',
    category: 'Water Resources',
    content: `Punjab's water quality monitoring program covers rivers, canals, and groundwater resources.
Key parameters monitored include:
- pH levels (acceptable range: 6.5-8.5)
- Total Dissolved Solids (TDS)
- Biological Oxygen Demand (BOD)
- Chemical Oxygen Demand (COD)
- Heavy metals (lead, arsenic, mercury)
- Bacteriological parameters (E. coli, coliform)

Major water bodies monitored:
- River Ravi
- River Sutlej
- River Chenab
- River Jhelum

EPA Punjab enforces NEQS (National Environmental Quality Standards) for municipal and industrial wastewater.`
  },
  {
    id: 'biodiversity',
    title: 'Biodiversity and Ecosystem Conservation',
    category: 'Biodiversity',
    content: `Punjab hosts diverse ecosystems including wetlands, forests, and agricultural landscapes.
Key biodiversity initiatives include:
- Wetland conservation programs
- Protected area management
- Species recovery programs
- Habitat restoration projects

Notable protected areas:
- Chinji National Park
- Khabikki Lake Wildlife Sanctuary
- Head Marala Wildlife Sanctuary

Threatened species in Punjab include:
- Indus River Dolphin (Platanista gangetica minor)
- Punjab Urial (Ovis vignei punjabiensis)
- Various migratory bird species`
  },
  {
    id: 'climate-change',
    title: 'Climate Change Adaptation and Mitigation',
    category: 'Climate Change',
    content: `Punjab faces significant climate change impacts including:
- Rising temperatures (average increase of 0.5C per decade)
- Changing precipitation patterns
- Increased frequency of extreme weather events
- Glacier melt affecting water availability

Punjab Climate Change Policy focuses on:
- Water resource management
- Agricultural adaptation
- Urban resilience
- Renewable energy transition
- Carbon sequestration through afforestation

Pakistan's Nationally Determined Contributions (NDCs) commit to:
- 50% reduction in projected emissions by 2030
- 60% renewable energy in electricity mix
- 30% electric vehicles by 2030`
  },
  {
    id: 'waste-management',
    title: 'Solid Waste Management',
    category: 'Waste Management',
    content: `Punjab generates approximately 45,000 tons of solid waste daily.

Waste composition:
- Organic waste: 60-70%
- Plastics: 8-10%
- Paper: 5-8%
- Metals: 1-2%
- Others: 10-15%

Key challenges:
- Limited landfill capacity
- Inadequate waste segregation
- Informal recycling sector integration
- Healthcare waste management

EPA Punjab initiatives:
- Waste-to-energy projects
- Composting programs
- Extended Producer Responsibility (EPR) framework
- Single-use plastic ban implementation`
  },
  {
    id: 'environmental-laws',
    title: 'Environmental Laws and Regulations',
    category: 'Policy & Regulation',
    content: `Key environmental legislation in Pakistan/Punjab:

1. Pakistan Environmental Protection Act, 1997
   - Framework for environmental protection
   - Environmental Impact Assessment (EIA) requirement
   - Pollution control provisions

2. Punjab Environmental Protection Act, 1997 (Amended 2012)
   - Provincial environmental governance
   - EPA Punjab establishment
   - Environmental tribunals

3. National Environmental Quality Standards (NEQS)
   - Air emission standards
   - Water discharge limits
   - Noise pollution limits

4. Punjab Clean Air Action Plan
   - Vehicular emission control
   - Industrial pollution prevention
   - Air quality monitoring network

Penalties for violations:
- Fines up to PKR 1 million
- Imprisonment up to 2 years
- Facility closure orders`
  }
]

async function retrieveRelevantDocuments(
  query: string,
  category?: string,
  topK: number = 3
): Promise<typeof ENVIRONMENTAL_KNOWLEDGE> {
  if (process.env.PLAYWRIGHT_TEST !== '1') {
    try {
      const retrievalResult = await advancedEmbeddingService.retrieveRelevantChunks(
        query,
        topK,
        0.5,
        { category, useHybrid: true }
      )

      if (retrievalResult.chunks.length > 0) {
        const documentIds = [...new Set(retrievalResult.chunks.map((chunk) => chunk.documentId))]
        const documents = await db.document.findMany({
          where: { id: { in: documentIds } }
        })

        return documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          category: doc.category || 'General',
          content: doc.content.slice(0, 2000)
        }))
      }
    } catch {
      console.error('Vector retrieval failed, falling back to keyword search')
    }
  }

  const processedQuery = queryProcessorService.processQuery(query)
  const queryLower = processedQuery.cleaned
  const queryTerms = queryLower.split(/\s+/)

  const scored = ENVIRONMENTAL_KNOWLEDGE.map((doc) => {
    if (category && doc.category !== category) {
      return { doc, score: 0 }
    }

    const contentLower = `${doc.title} ${doc.content}`.toLowerCase()
    let score = 0

    for (const term of queryTerms) {
      if (term.length < 3) continue
      const regex = new RegExp(term, 'gi')
      const matches = contentLower.match(regex)
      if (matches) {
        score += matches.length
      }
    }

    if (doc.title.toLowerCase().includes(queryLower)) {
      score += 20
    }

    if (doc.category && queryLower.includes(doc.category.toLowerCase())) {
      score += 10
    }

    if (processedQuery.category && doc.category === processedQuery.category) {
      score += 15
    }

    return { doc, score }
  })

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map((item) => item.doc)
}

function summarizeFallbackContent(content: string, maxLength: number = 220): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

function buildOfflineFallbackResponse(
  message: string,
  relevantDocs: Array<{ title: string; category: string; content: string }>,
  audience: string
): string {
  const modeNote = audience === 'Technical'
    ? 'Technical note: the live LLM providers are unavailable, so this answer is a deterministic summary from the local knowledge base.'
    : audience === 'Policy Maker'
      ? 'Policy note: the live LLM providers are unavailable, so this answer is a deterministic summary from the local knowledge base. Verify current legal thresholds before operational use.'
      : 'The live LLM providers are unavailable, so this answer is a deterministic summary from the local knowledge base.'

  if (relevantDocs.length === 0) {
    return `${modeNote}\n\nI could not find a strong local document match for "${message}". Try asking about air quality, water quality, climate change, biodiversity, waste management, or environmental regulations in Punjab.`
  }

  const documentSummaries = relevantDocs
    .slice(0, 3)
    .map((doc, index) => `${index + 1}. ${doc.title} (${doc.category}): ${summarizeFallbackContent(doc.content)}`)
    .join('\n')

  return `${modeNote}\n\nRelevant information for "${message}":\n${documentSummaries}\n\nThis response is based on the built-in Punjab environmental knowledge base and any locally indexed documents that matched your query.`
}

function buildRetrievedDocuments(
  relevantDocs: Array<{ id: string; title: string; category: string; content: string }>
) {
  return relevantDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    content: doc.content
  }))
}

function buildStreamMetadata(
  sessionId: string,
  sources: Array<{ id: string; documentId: string; title: string; category?: string; relevanceScore: number }>,
  confidence: number,
  providerUsed: string,
  modelUsed: string
) {
  return {
    type: 'meta' as const,
    sessionId,
    sources,
    confidence,
    providerUsed,
    modelUsed
  }
}

function buildTextEventStream(
  content: string,
  metadata: ReturnType<typeof buildStreamMetadata>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })
}

async function handlePost(request: NextRequest) {
  const startTime = Date.now()

  try {
    let user: { userId: string; role: string } | undefined
    if (request.headers.get('authorization')) {
      const { response: authError, user: authenticatedUser } = await getRouteAuthContext(request, authenticateToken)
      if (authError) return authError
      user = authenticatedUser
    }

    const body = await request.json()
    const parsed = chatMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        createValidationErrorResponse(parsed.error),
        { status: 400 }
      )
    }

    const validatedInput = parsed.data
    const {
      message,
      audience = 'General Public',
      sessionId,
      filters,
      stream: streamRequested = false
    } = validatedInput

    const processedQuery = queryProcessorService.processQuery(message)

    const scopeCheck = queryProcessorService.isWithinScope(message)
    if (!scopeCheck.inScope) {
      return NextResponse.json({
        success: true,
        response: scopeCheck.reason,
        sources: [],
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: {
          outOfScope: true,
          processedQuery: {
            intent: processedQuery.intent,
            category: processedQuery.category
          }
        }
      })
    }

    const cacheKey = responseCacheService.generateKey({
      query: processedQuery.cleaned,
      audience,
      category: processedQuery.category || filters?.category
    })

    if (!streamRequested) {
      const cachedResponse = responseCacheService.get(cacheKey)
      if (cachedResponse) {
        return NextResponse.json({
          ...cachedResponse,
          cached: true,
          processingTime: Date.now() - startTime
        })
      }
    }

    const relevantDocs = await retrieveRelevantDocuments(
      processedQuery.expanded,
      filters?.category || processedQuery.suggestedFilters.category,
      5
    )

    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (sessionId) {
      const contextData = await conversationMemoryService.getConversationContext(sessionId)
      conversationHistory = contextData.messages
        .filter((historyMessage): historyMessage is typeof historyMessage & { role: 'user' | 'assistant' } => (
          historyMessage.role === 'user' || historyMessage.role === 'assistant'
        ))
        .slice(-10)
        .map((historyMessage) => ({
          role: historyMessage.role,
          content: historyMessage.content
        }))
    }

    const providers = await llmProviderRegistry.getProviders()
    const hasConfiguredProviders = providers.length > 0
    const retrievedDocuments = buildRetrievedDocuments(relevantDocs)
    const confidence = relevantDocs.length > 0
      ? Math.min(0.5 + (relevantDocs.length * 0.1), 0.95)
      : 0.4

    const sources = relevantDocs.map((doc) => ({
      id: doc.id,
      documentId: doc.id,
      title: doc.title,
      category: doc.category || undefined,
      relevanceScore: confidence
    }))

    if (streamRequested) {
      let currentSessionId = sessionId
      if (!currentSessionId) {
        const session = await db.chatSession.create({
          data: {
            title: message.slice(0, 50),
            userId: user?.userId || null
          }
        })
        currentSessionId = session.id
      }

      const streamHeaders = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Session-Id': currentSessionId
      }

      if (!hasConfiguredProviders) {
        const fallbackResponse = buildOfflineFallbackResponse(message, relevantDocs, audience)
        await conversationMemoryService.addMessage(currentSessionId, 'user', message)
        await conversationMemoryService.addMessage(
          currentSessionId,
          'assistant',
          fallbackResponse,
          JSON.stringify(sources),
          {
            confidence,
            category: processedQuery.category ?? undefined,
            intent: processedQuery.intent.type,
            providerUsed: 'local-fallback',
            modelUsed: 'knowledge-base'
          }
        )

        return new Response(
          buildTextEventStream(
            fallbackResponse,
            buildStreamMetadata(currentSessionId, sources, confidence, 'local-fallback', 'knowledge-base')
          ),
          {
            headers: {
              ...streamHeaders,
              'X-Provider-Used': 'local-fallback',
              'X-Model-Used': 'knowledge-base'
            }
          }
        )
      }

      try {
        const { stream, providerUsed, modelUsed } = await llmRouter.streamQuery({
          query: message,
          sessionId: currentSessionId,
          audienceType: audience as 'General Public' | 'Technical' | 'Policy Maker',
          category: processedQuery.category ?? undefined,
          conversationHistory,
          retrievedDocuments
        })

        let fullResponse = ''
        let sseBuffer = ''
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()

        const consumeSseBuffer = (flush: boolean = false) => {
          const delimiter = '\n\n'
          let boundaryIndex = sseBuffer.indexOf(delimiter)

          while (boundaryIndex !== -1) {
            const eventBlock = sseBuffer.slice(0, boundaryIndex)
            sseBuffer = sseBuffer.slice(boundaryIndex + delimiter.length)

            for (const line of eventBlock.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue

              try {
                const parsedLine = JSON.parse(data)
                const delta = parsedLine.choices?.[0]?.delta?.content
                if (delta) {
                  fullResponse += delta
                }
              } catch {
                // Ignore malformed chunks while preserving the stream.
              }
            }

            boundaryIndex = sseBuffer.indexOf(delimiter)
          }

          if (flush && sseBuffer.trim()) {
            const remaining = sseBuffer
            sseBuffer = ''
            for (const line of remaining.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue

              try {
                const parsedLine = JSON.parse(data)
                const delta = parsedLine.choices?.[0]?.delta?.content
                if (delta) {
                  fullResponse += delta
                }
              } catch {
                // Ignore malformed chunks while preserving the stream.
              }
            }
          }
        }

        const wrappedStream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = stream.getReader()
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(buildStreamMetadata(currentSessionId!, sources, confidence, providerUsed, modelUsed))}\n\n`
              )
            )

            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (!value) continue

                controller.enqueue(value)
                sseBuffer += decoder.decode(value, { stream: true })
                consumeSseBuffer(false)
              }

              sseBuffer += decoder.decode()
              consumeSseBuffer(true)

              await conversationMemoryService.addMessage(currentSessionId!, 'user', message)
              await conversationMemoryService.addMessage(
                currentSessionId!,
                'assistant',
                fullResponse,
                JSON.stringify(sources),
                {
                  confidence,
                  category: processedQuery.category ?? undefined,
                  intent: processedQuery.intent.type,
                  providerUsed,
                  modelUsed
                }
              )

              controller.close()
            } catch (error) {
              console.error('[Chat] Failed to process streamed response:', error)
              controller.error(error)
            } finally {
              reader.releaseLock()
            }
          }
        })

        return new Response(wrappedStream, {
          headers: {
            ...streamHeaders,
            'X-Provider-Used': providerUsed,
            'X-Model-Used': modelUsed
          }
        })
      } catch (error) {
        console.error('[Chat] Streaming provider path failed, using local fallback:', error)
        const fallbackResponse = buildOfflineFallbackResponse(message, relevantDocs, audience)

        await conversationMemoryService.addMessage(currentSessionId, 'user', message)
        await conversationMemoryService.addMessage(
          currentSessionId,
          'assistant',
          fallbackResponse,
          JSON.stringify(sources),
          {
            confidence,
            category: processedQuery.category ?? undefined,
            intent: processedQuery.intent.type,
            providerUsed: 'local-fallback',
            modelUsed: 'knowledge-base'
          }
        )

        return new Response(
          buildTextEventStream(
            fallbackResponse,
            buildStreamMetadata(currentSessionId, sources, confidence, 'local-fallback', 'knowledge-base')
          ),
          {
            headers: {
              ...streamHeaders,
              'X-Provider-Used': 'local-fallback',
              'X-Model-Used': 'knowledge-base'
            }
          }
        )
      }
    }

    let assistantResponse: string
    let providerUsed = 'unknown'
    let modelUsed = 'unknown'
    let latencyMs = 0
    let fallbackChain: string[] | undefined

    if (hasConfiguredProviders) {
      const routerResult = await llmRouter.processQuery({
        query: message,
        sessionId,
        audienceType: audience as 'General Public' | 'Technical' | 'Policy Maker',
        category: processedQuery.category ?? undefined,
        conversationHistory,
        retrievedDocuments
      })

      if (!routerResult.success) {
        console.error('[Chat] LLM Router failed, using local fallback')
        assistantResponse = buildOfflineFallbackResponse(message, relevantDocs, audience)
        providerUsed = 'local-fallback'
        modelUsed = 'knowledge-base'
        latencyMs = Date.now() - startTime
        fallbackChain = routerResult.fallbackChain ?? undefined
      } else {
        assistantResponse = routerResult.content
        providerUsed = routerResult.providerUsed
        modelUsed = routerResult.modelUsed
        latencyMs = routerResult.latencyMs
        fallbackChain = routerResult.fallbackChain ?? undefined
      }
    } else {
      assistantResponse = buildOfflineFallbackResponse(message, relevantDocs, audience)
      providerUsed = 'local-fallback'
      modelUsed = 'knowledge-base'
      latencyMs = Date.now() - startTime
    }

    let currentSessionId = sessionId
    if (!currentSessionId) {
      const session = await db.chatSession.create({
        data: {
          title: message.slice(0, 50),
          userId: user?.userId || null
        }
      })
      currentSessionId = session.id
    }

    await conversationMemoryService.addMessage(currentSessionId, 'user', message)

    const assistantMessage = await conversationMemoryService.addMessage(
      currentSessionId,
      'assistant',
      assistantResponse,
      JSON.stringify(sources),
      {
        confidence,
        category: processedQuery.category ?? undefined,
        intent: processedQuery.intent.type,
        providerUsed,
        modelUsed
      }
    )

    const response: ChatResponse = {
      success: true,
      response: assistantResponse,
      sources,
      sessionId: currentSessionId,
      messageId: assistantMessage?.id,
      timestamp: new Date(),
      confidence,
      metadata: {
        processedQuery: {
          intent: processedQuery.intent,
          category: processedQuery.category,
          entities: processedQuery.entities
        },
        retrievalCount: relevantDocs.length,
        processingTime: Date.now() - startTime,
        llm: {
          provider: providerUsed,
          model: modelUsed,
          latencyMs,
          fallbackChain
        }
      }
    }

    responseCacheService.set(cacheKey, response, {
      query: processedQuery.cleaned,
      audience,
      category: processedQuery.category ?? undefined,
      documentCount: relevantDocs.length
    })

    return NextResponse.json(response)
  } catch {
    console.error('Chat API error')

    return NextResponse.json(
      { success: false, error: 'Failed to process your request. Please try again.' },
      { status: 500 }
    )
  }
}

async function handleGet(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      const session = await db.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 404 }
        )
      }

      if (user.role !== 'admin' && session.userId !== user.userId) {
        return NextResponse.json(
          { success: false, error: 'You do not have access to this session' },
          { status: 403 }
        )
      }

      const context = await conversationMemoryService.getConversationContext(sessionId)

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          summary: context.summary,
          messages: session.messages.map((message) => ({
            id: message.id,
            sessionId: message.sessionId,
            role: message.role,
            content: message.content,
            sources: message.sources ? JSON.parse(message.sources) : undefined,
            createdAt: message.createdAt
          }))
        }
      })
    }

    const recentConversations = await conversationMemoryService.getRecentConversations(
      20,
      user.role === 'admin' ? undefined : user.userId
    )

    return NextResponse.json({
      success: true,
      sessions: recentConversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.lastMessage,
        updatedAt: conversation.lastMessage,
        preview: conversation.preview,
        messageCount: conversation.messageCount
      }))
    })
  } catch {
    console.error('Session API error')
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve sessions' },
      { status: 500 }
    )
  }
}

async function handleDelete(request: NextRequest) {
  const { response: authError, user } = await getRouteAuthContext(request, authenticateToken)
  if (authError || !user) return authError

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true }
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    if (user.role !== 'admin' && session.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this session' },
        { status: 403 }
      )
    }

    const deleted = await conversationMemoryService.deleteConversation(sessionId)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    console.error('Delete session error')
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit((request) => handlePost(request as NextRequest), 'chat')
export const GET = withRateLimit((request) => handleGet(request as NextRequest), 'chat')
export const DELETE = withRateLimit((request) => handleDelete(request as NextRequest), 'chat')
