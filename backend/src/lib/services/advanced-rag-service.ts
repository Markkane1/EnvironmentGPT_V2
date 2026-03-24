// =====================================================
// EPA Punjab EnvironmentGPT - Enhanced RAG Engine
// Phase 5: Production-Ready Retrieval-Augmented Generation
// =====================================================

import { db } from '@/lib/db'
import { llmProviderRegistry } from './llm-provider-registry'
import { advancedEmbeddingService } from './advanced-embedding-service'
import { queryProcessorService, ProcessedQuery } from './query-processor'
import { responseCacheService } from './response-cache'
import { 
  ChatRequest, 
  ChatResponse, 
  SourceReference, 
  RAGConfig,
  MessageRole
} from '@/types'
import { RAG_CONFIG } from '@/lib/constants'

// ==================== Types ====================

export interface EnhancedRAGConfig extends RAGConfig {
  useCache: boolean
  useQueryExpansion: boolean
  useHybridSearch: boolean
  maxConversationTurns: number
  confidenceThreshold: number
  streamingEnabled: boolean
}

export interface RAGPipelineResult {
  response: ChatResponse
  metadata: {
    processedQuery: ProcessedQuery
    retrievalTime: number
    generationTime: number
    totalTime: number
    cachedResponse: boolean
    documentCount: number
    confidence: number
  }
}

export interface StreamChunk {
  type: 'text' | 'source' | 'done' | 'error'
  content?: string
  sources?: SourceReference[]
  error?: string
}

export interface ConversationContext {
  sessionId: string
  messages: Array<{
    role: MessageRole
    content: string
    timestamp: Date
  }>
  documentIds?: string[]
}

// ==================== Default Configuration ====================

const DEFAULT_ENHANCED_CONFIG: EnhancedRAGConfig = {
  ...RAG_CONFIG,
  useCache: true,
  useQueryExpansion: true,
  useHybridSearch: true,
  maxConversationTurns: 10,
  confidenceThreshold: 0.6,
  streamingEnabled: true
}

// ==================== Enhanced RAG Service ====================

export class EnhancedRAGService {
  private config: EnhancedRAGConfig

  constructor(config?: Partial<EnhancedRAGConfig>) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config }
  }

  // ==================== Main Query Processing ====================

  /**
   * Process a chat request with full RAG pipeline
   */
  async processQuery(request: ChatRequest): Promise<RAGPipelineResult> {
    const startTime = Date.now()
    let retrievalTime = 0
    let generationTime = 0
    const cachedResponse = false

    try {

      // Step 1: Preprocess query
      const processedQuery = queryProcessorService.processQuery(request.message)
      
      // Check scope
      const scopeCheck = queryProcessorService.isWithinScope(request.message)
      if (!scopeCheck.inScope) {
        return this.createOutOfScopeResponse(scopeCheck.reason || 'Out of scope', startTime, processedQuery)
      }

      // Step 2: Check cache
      const cacheKey = responseCacheService.generateKey({
        query: processedQuery.cleaned,
        audience: request.audience,
        category: processedQuery.category || undefined
      })

      if (this.config.useCache) {
        const cached = responseCacheService.get(cacheKey)
        if (cached) {
          return {
            response: cached,
            metadata: {
              processedQuery,
              retrievalTime: 0,
              generationTime: 0,
              totalTime: Date.now() - startTime,
              cachedResponse: true,
              documentCount: 0,
              confidence: 1.0
            }
          }
        }
      }

      // Step 3: Retrieve relevant documents
      const retrievalStart = Date.now()
      const retrievalResult = await advancedEmbeddingService.retrieveRelevantChunks(
        this.config.useQueryExpansion ? processedQuery.expanded : processedQuery.cleaned,
        this.config.defaultTopK,
        this.config.similarityThreshold,
        {
          category: processedQuery.suggestedFilters.category,
          useHybrid: this.config.useHybridSearch
        }
      )
      retrievalTime = Date.now() - retrievalStart

      // Step 4: Build context and prompt
      const context = this.buildEnhancedContext(retrievalResult.chunks, processedQuery)
      const conversationHistory = await this.getConversationHistory(request.sessionId)
      const systemPrompt = this.buildEnhancedSystemPrompt(
        request.audience || 'General Public',
        context,
        conversationHistory,
        processedQuery
      )

      // Step 5: Generate response
      const generationStart = Date.now()
      const llmResult = await llmProviderRegistry.chatCompletion({
        messages: this.buildMessages(systemPrompt, conversationHistory, request.message),
        temperature: 0.7,
        max_tokens: this.config.maxContextTokens
      })
      generationTime = Date.now() - generationStart

      const assistantResponse = llmResult.response?.choices[0]?.message?.content ||
        'I apologize, but I was unable to generate a response. Please try again.'

      // Step 6: Calculate confidence and format sources
      const confidence = this.calculateConfidence(retrievalResult.scores, retrievalResult.chunks.length)
      const sources = await this.formatEnhancedSources(retrievalResult.chunks, retrievalResult.scores)

      // Step 7: Save to session
      const sessionId = request.sessionId
      let messageId: string | undefined

      if (sessionId) {
        messageId = await this.saveMessages(
          sessionId,
          request.message,
          assistantResponse,
          sources
        )
      }

      // Step 8: Build response
      const response: ChatResponse = {
        success: true,
        response: assistantResponse,
        sources,
        sessionId,
        messageId,
        timestamp: new Date(),
        confidence
      }

      // Step 9: Cache response
      if (this.config.useCache && confidence >= this.config.confidenceThreshold) {
        responseCacheService.set(cacheKey, response, {
          query: processedQuery.cleaned,
          audience: request.audience || 'General Public',
          category: processedQuery.category || undefined,
          documentCount: retrievalResult.chunks.length
        })
      }

      return {
        response,
        metadata: {
          processedQuery,
          retrievalTime,
          generationTime,
          totalTime: Date.now() - startTime,
          cachedResponse,
          documentCount: retrievalResult.chunks.length,
          confidence
        }
      }
    } catch (error) {
      console.error('Enhanced RAG error:', error)
      return this.createErrorResponse(error as Error, startTime)
    }
  }

  // ==================== Streaming Support ====================

  /**
   * Process query with streaming response
   */
  async *processQueryStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      // Preprocess query
      const processedQuery = queryProcessorService.processQuery(request.message)
      
      // Check scope
      const scopeCheck = queryProcessorService.isWithinScope(request.message)
      if (!scopeCheck.inScope) {
        yield { type: 'text', content: scopeCheck.reason }
        yield { type: 'done' }
        return
      }

      // Retrieve documents
      const retrievalResult = await advancedEmbeddingService.retrieveRelevantChunks(
        processedQuery.expanded,
        this.config.defaultTopK,
        this.config.similarityThreshold,
        { useHybrid: this.config.useHybridSearch }
      )

      // Build context and prompt
      const context = this.buildEnhancedContext(retrievalResult.chunks, processedQuery)
      const conversationHistory = await this.getConversationHistory(request.sessionId)
      const systemPrompt = this.buildEnhancedSystemPrompt(
        request.audience || 'General Public',
        context,
        conversationHistory,
        processedQuery
      )

      // Native provider streaming is not wired through the registry yet,
      // so the current fallback streams the completed response in word chunks.
      const llmResult = await llmProviderRegistry.chatCompletion({
        messages: this.buildMessages(systemPrompt, conversationHistory, request.message),
        temperature: 0.7,
        max_tokens: this.config.maxContextTokens
      })

      const fullResponse = llmResult.response?.choices[0]?.message?.content || ''
      
      // Yield response in chunks (simulated streaming)
      const words = fullResponse.split(' ')
      let currentChunk = ''
      
      for (const word of words) {
        currentChunk += (currentChunk ? ' ' : '') + word
        
        // Yield every 5-10 words
        if (currentChunk.split(' ').length >= 5 + Math.floor(Math.random() * 5)) {
          yield { type: 'text', content: currentChunk }
          currentChunk = ''
        }
      }
      
      // Yield remaining text
      if (currentChunk) {
        yield { type: 'text', content: currentChunk }
      }

      // Yield sources
      const sources = await this.formatEnhancedSources(retrievalResult.chunks, retrievalResult.scores)
      yield { type: 'source', sources }

      // Save messages
      if (request.sessionId) {
        await this.saveMessages(
          request.sessionId,
          request.message,
          fullResponse,
          sources
        )
      }

      yield { type: 'done' }
    } catch (error) {
      yield { type: 'error', error: (error as Error).message }
    }
  }

  // ==================== Context Building ====================

  private buildEnhancedContext(
    chunks: Array<{ content: string; documentId?: string; id: string }>,
    processedQuery: ProcessedQuery
  ): string {
    if (chunks.length === 0) {
      return `No specific documents were found in the knowledge base for the query: "${processedQuery.cleaned}"

Please provide general environmental information relevant to Punjab, Pakistan, while noting that specific data from the knowledge base was not available for this query.`
    }

    const contextParts = chunks.map((chunk, index) => {
      return `[Source ${index + 1}]\n${chunk.content}`
    })

    // Add query context
    let contextHeader = '## Retrieved Context\n\n'
    
    if (processedQuery.entities.locations.length > 0) {
      contextHeader += `**Locations mentioned:** ${processedQuery.entities.locations.join(', ')}\n`
    }
    if (processedQuery.entities.years.length > 0) {
      contextHeader += `**Years mentioned:** ${processedQuery.entities.years.join(', ')}\n`
    }
    if (processedQuery.category) {
      contextHeader += `**Detected category:** ${processedQuery.category}\n`
    }
    contextHeader += '\n---\n\n'

    return contextHeader + contextParts.join('\n\n---\n\n')
  }

  private buildEnhancedSystemPrompt(
    audience: string,
    context: string,
    conversationHistory: Array<{ role: MessageRole; content: string }>,
    processedQuery: ProcessedQuery
  ): string {
    const audienceConfig = this.getAudienceConfig(audience)
    
    let prompt = `You are EPA Punjab's Environmental Knowledge Assistant, an AI-powered tool designed to help citizens, researchers, and policymakers access environmental information about Punjab, Pakistan.

## Identity & Role
- You are a helpful environmental knowledge assistant
- You provide accurate, science-based environmental information
- You cite sources from the knowledge base when available
- You prioritize Punjab-specific information
- You admit when information is uncertain or not available

## Audience: ${audience}
${audienceConfig.instructions}

## Current Context
${context}

## Query Intent
The user's question appears to be: ${processedQuery.intent.type} (${Math.round(processedQuery.intent.confidence * 100)}% confidence)

## Response Guidelines
1. **Be Accurate**: Only state facts that are supported by the context or general knowledge
2. **Cite Sources**: When using information from the context, mention "according to the knowledge base" or reference specific sources
3. **Be Honest**: If the context doesn't contain relevant information, clearly state that
4. **Be Relevant**: Focus on Punjab and Pakistan when discussing environmental issues
5. **Be Helpful**: Provide actionable advice when appropriate
6. **Use Clear Language**: Adjust complexity based on audience level

## Formatting
- Use markdown for structure (headers, lists, emphasis)
- Include specific data and measurements when available
- Break long responses into sections for readability

## Topics You Can Discuss
- Air quality (smog, PM2.5, vehicular emissions, industrial pollution)
- Water resources (rivers, groundwater, water quality standards)
- Biodiversity and conservation (protected areas, species)
- Climate change (impacts, adaptation, mitigation strategies)
- Waste management (solid waste, hazardous waste, recycling)
- Environmental regulations (PEPA 1997, NEQS, EIA process)
- EPA Punjab initiatives and programs

## Out of Scope
Politely decline questions about politics, religion, sports, entertainment, or other non-environmental topics.`

    // Add conversation context if available
    if (conversationHistory.length > 0) {
      prompt += `\n\n## Previous Conversation\nThe user has been asking about related topics. Maintain context from the conversation history.`
    }

    return prompt
  }

  private getAudienceConfig(audience: string): { instructions: string } {
    const configs: Record<string, { instructions: string }> = {
      'General Public': {
        instructions: `- Explain concepts in simple, easy-to-understand language
- Use everyday examples and analogies
- Avoid technical jargon; define terms when necessary
- Focus on practical implications for citizens
- Keep responses conversational and accessible
- Provide actionable advice for individuals`
      },
      'Technical': {
        instructions: `- Provide detailed technical information with scientific precision
- Include specific data, metrics, and measurements with units
- Reference methodology and data sources
- Discuss technical challenges and solutions
- Use appropriate technical terminology
- Include relevant standards and thresholds
- Mention uncertainties and limitations in data`
      },
      'Policy Maker': {
        instructions: `- Focus on policy implications and recommendations
- Include cost-benefit analysis where relevant
- Discuss implementation strategies and challenges
- Reference regulations, acts, and compliance requirements
- Provide actionable policy recommendations
- Consider multi-stakeholder perspectives
- Highlight enforcement and monitoring aspects`
      }
    }

    return configs[audience] || configs['General Public']
  }

  private buildMessages(
    systemPrompt: string,
    conversationHistory: Array<{ role: MessageRole; content: string }>,
    currentMessage: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history (limited)
    const recentHistory = conversationHistory.slice(-this.config.maxConversationTurns * 2)
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // Add current message
    messages.push({ role: 'user', content: currentMessage })

    return messages
  }

  // ==================== Helper Methods ====================

  private async getConversationHistory(sessionId?: string): Promise<Array<{ role: MessageRole; content: string }>> {
    if (!sessionId) return []

    try {
      const messages = await db.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: this.config.maxConversationTurns * 2
      })

      return messages.map(msg => ({
        role: msg.role as MessageRole,
        content: msg.content,
        timestamp: msg.createdAt
      }))
    } catch {
      return []
    }
  }

  private calculateConfidence(scores: number[], documentCount: number): number {
    if (documentCount === 0) return 0.3 // Low confidence for no documents
    if (scores.length === 0) return 0.4

    // Weight by average score and document count
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const countBonus = Math.min(documentCount / 5, 1) * 0.1 // Bonus for more documents

    return Math.min(avgScore + countBonus, 1)
  }

  private async formatEnhancedSources(
    chunks: Array<{ id: string; documentId?: string; content: string }>,
    scores: number[]
  ): Promise<SourceReference[]> {
    const orderedDocuments: Array<{ documentId: string; score: number; content: string }> = []
    const seenDocuments = new Set<string>()

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (!chunk.documentId || seenDocuments.has(chunk.documentId)) continue

      seenDocuments.add(chunk.documentId)
      orderedDocuments.push({
        documentId: chunk.documentId,
        score: scores[i] || 0,
        content: chunk.content,
      })

      if (orderedDocuments.length >= 5) break
    }

    if (orderedDocuments.length === 0) {
      return []
    }

    const documents = await db.document.findMany({
      where: {
        id: {
          in: orderedDocuments.map((item) => item.documentId),
        },
      },
      select: {
        id: true,
        title: true,
        category: true,
        year: true,
        source: true,
      },
    })

    const documentsById = new Map(documents.map((document) => [document.id, document]))

    return orderedDocuments.flatMap((item) => {
      const document = documentsById.get(item.documentId)
      if (!document) return []

      return [{
        id: document.id,
        documentId: document.id,
        title: document.title,
        category: document.category || undefined,
        relevanceScore: item.score,
        excerpt: item.content.slice(0, 200) + (item.content.length > 200 ? '...' : ''),
        year: document.year || undefined,
        source: document.source || undefined,
      }]
    })
  }

  private async saveMessages(
    sessionId: string,
    userMessage: string,
    assistantResponse: string,
    sources: SourceReference[]
  ): Promise<string> {
    try {
      // Save user message
      await db.chatMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: userMessage
        }
      })

      // Save assistant response
      const message = await db.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: assistantResponse,
          sources: JSON.stringify(sources)
        }
      })

      // Update session title if first message
      const existingMessages = await db.chatMessage.count({
        where: { sessionId }
      })

      if (existingMessages === 2) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '')
        await db.chatSession.update({
          where: { id: sessionId },
          data: { title }
        })
      }

      return message.id
    } catch (error) {
      console.error('Failed to save messages:', error)
      return ''
    }
  }

  private createOutOfScopeResponse(
    reason: string,
    startTime: number,
    processedQuery: ProcessedQuery
  ): RAGPipelineResult {
    return {
      response: {
        success: true,
        response: reason,
        sources: [],
        timestamp: new Date(),
        confidence: 1.0
      },
      metadata: {
        processedQuery,
        retrievalTime: 0,
        generationTime: 0,
        totalTime: Date.now() - startTime,
        cachedResponse: false,
        documentCount: 0,
        confidence: 1.0
      }
    }
  }

  private createErrorResponse(error: Error, startTime: number): RAGPipelineResult {
    return {
      response: {
        success: false,
        error: 'Failed to process your query. Please try again.',
        timestamp: new Date()
      },
      metadata: {
        processedQuery: {
          original: '',
          cleaned: '',
          expanded: '',
          keywords: [],
          entities: {
            locations: [],
            parameters: [],
            years: [],
            organizations: [],
            measurements: []
          },
          intent: { type: 'unknown', confidence: 0 },
          category: null,
          suggestedFilters: {}
        },
        retrievalTime: 0,
        generationTime: 0,
        totalTime: Date.now() - startTime,
        cachedResponse: false,
        documentCount: 0,
        confidence: 0
      }
    }
  }

  // ==================== Configuration ====================

  updateConfig(newConfig: Partial<EnhancedRAGConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): EnhancedRAGConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const enhancedRAGService = new EnhancedRAGService()

