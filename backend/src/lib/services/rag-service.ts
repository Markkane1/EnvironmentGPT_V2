// =====================================================
// EPA Punjab EnvironmentGPT - RAG Service
// Phase 2: Retrieval-Augmented Generation Pipeline
// Internal compatibility layer retained outside the public services barrel
// =====================================================

import { db } from '@/lib/db'
import { embeddingService } from './embedding-service'
import { llmProviderRegistry } from './llm-provider-registry'
import { 
  ChatRequest, 
  ChatResponse, 
  SourceReference, 
  RAGConfig 
} from '@/types'
import { RAG_CONFIG } from '@/lib/constants'

// ==================== RAG Service Class ====================

export class RAGService {
  private config: RAGConfig

  constructor(config?: Partial<RAGConfig>) {
    this.config = { ...RAG_CONFIG, ...config }
  }

  /**
   * Process a chat request using RAG
   */
  async processQuery(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Step 1: Retrieve relevant documents
      const retrievalResult = await embeddingService.retrieveRelevantChunks(
        request.message,
        this.config.defaultTopK,
        this.config.similarityThreshold
      )

      // Step 2: Build context from retrieved chunks
      const context = this.buildContext(retrievalResult.chunks)

      // Step 3: Build system prompt
      const systemPrompt = this.buildSystemPrompt(
        request.audience || 'General Public',
        context
      )

      // Step 4: Generate response using LLM
      let assistantResponse: string
      try {
        const { content } = await llmProviderRegistry.chat(
          systemPrompt,
          request.message,
          { temperature: 0.7, maxTokens: this.config.maxContextTokens }
        )
        assistantResponse = content || 'I apologize, but I was unable to generate a response. Please try again.'
      } catch {
        assistantResponse = 'I apologize, but I was unable to generate a response. Please try again.'
      }

      // Step 5: Format sources
      const sources = await this.formatSources(retrievalResult.chunks, retrievalResult.scores)

      // Step 6: Save to session if provided
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

      return {
        success: true,
        response: assistantResponse,
        sources,
        sessionId,
        messageId,
        timestamp: new Date()
      }
    } catch (error) {
      console.error('RAG query error:', error)
      return {
        success: false,
        error: 'Failed to process query. Please try again.',
        timestamp: new Date()
      }
    }
  }

  /**
   * Build context string from chunks
   */
  private buildContext(chunks: Array<{ content: string; documentId?: string }>): string {
    if (chunks.length === 0) {
      return 'No relevant documents found in the knowledge base.'
    }

    return chunks
      .map((chunk, index) => `[Document ${index + 1}]\n${chunk.content}`)
      .join('\n\n---\n\n')
  }

  /**
   * Build system prompt based on audience
   */
  private buildSystemPrompt(audience: string, context: string): string {
    const audienceInstructions: Record<string, string> = {
      'General Public': `
- Explain concepts in simple, easy-to-understand language
- Use everyday examples and analogies
- Avoid technical jargon; define terms when necessary
- Focus on practical implications for citizens
- Keep responses conversational and accessible`,
      
      'Technical': `
- Provide detailed technical information with scientific precision
- Include specific data, metrics, and measurements
- Reference methodology and data sources
- Discuss technical challenges and solutions
- Use appropriate technical terminology`,
      
      'Policy Maker': `
- Focus on policy implications and recommendations
- Include cost-benefit analysis where relevant
- Discuss implementation strategies
- Reference regulations and compliance requirements
- Provide actionable recommendations`
    }

    return `You are EPA Punjab's Environmental Knowledge Assistant, an AI-powered tool designed to help citizens, researchers, and policymakers access environmental information about Punjab, Pakistan.

## Your Role
- Provide accurate, science-based environmental information
- Cite sources from the knowledge base when possible
- Be helpful, informative, and objective
- Admit when you don't know something or when information is uncertain
- Prioritize Punjab-specific information when available

## Response Guidelines
${audienceInstructions[audience] || audienceInstructions['General Public']}

## Context from Knowledge Base
${context}

## Important Instructions
1. Always indicate when information comes from the knowledge base vs. general knowledge
2. If citing specific documents, mention the document title
3. If information is not available in the knowledge base, clearly state that
4. For environmental data, include units and time periods when available
5. When discussing regulations, reference specific acts or standards

## Topics You Can Discuss
- Air quality (smog, PM2.5, vehicular emissions, industrial pollution)
- Water resources (rivers, groundwater, water quality)
- Biodiversity and conservation (protected areas, species)
- Climate change (impacts, adaptation, mitigation)
- Waste management (solid waste, recycling, landfill)
- Environmental regulations (PEPA 1997, NEQS, EIA process)
- EPA Punjab initiatives and programs`
  }

  /**
   * Format sources for response
   */
  private async formatSources(
    chunks: Array<{ id: string; documentId?: string; content: string }>,
    scores: number[]
  ): Promise<SourceReference[]> {
    const sources: SourceReference[] = []
    const seenDocuments = new Set<string>()
    const rankedChunks = chunks
      .map((chunk, index) => ({ chunk, index }))
      .filter(({ chunk }) => !!chunk.documentId)

    const uniqueDocumentIds = Array.from(new Set(
      rankedChunks
        .map(({ chunk }) => chunk.documentId)
        .filter((documentId): documentId is string => typeof documentId === 'string')
    )).slice(0, 5)

    if (uniqueDocumentIds.length === 0) {
      return sources
    }

    let documentsById = new Map<string, { id: string; title: string; category: string | null }>()

    try {
      const documents = await db.document.findMany({
        where: { id: { in: uniqueDocumentIds } },
        select: { id: true, title: true, category: true }
      })

      documentsById = new Map(documents.map((document) => [document.id, document]))
    } catch (error) {
      console.error('Failed to fetch source documents:', error)
      return sources
    }

    for (const { chunk, index } of rankedChunks) {
      if (!chunk.documentId || seenDocuments.has(chunk.documentId)) continue

      const document = documentsById.get(chunk.documentId)
      if (document) {
        seenDocuments.add(chunk.documentId)
        sources.push({
          id: document.id,
          documentId: document.id,
          title: document.title,
          category: document.category || undefined,
          relevanceScore: scores[index] || 0,
          excerpt: chunk.content.slice(0, 200) + '...'
        })
      }

      if (sources.length >= 5) break // Limit to 5 sources
    }

    return sources
  }

  /**
   * Save messages to database
   */
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

  /**
   * Get similar questions based on query
   */
  async getSimilarQuestions(query: string, limit: number = 5): Promise<string[]> {
    // This would use the embedding service to find similar queries
    // For now, return suggested questions based on keywords
    const queryLower = query.toLowerCase()
    
    const suggestions: Record<string, string[]> = {
      'air': [
        'What is the current air quality in Lahore?',
        'How can I reduce my exposure to air pollution?',
        'What are the main causes of smog in Punjab?'
      ],
      'water': [
        'Is the drinking water safe in Punjab?',
        'How does EPA monitor river water quality?',
        'What are the water quality standards?'
      ],
      'climate': [
        'How is climate change affecting Punjab?',
        'What is Punjab doing about climate change?',
        'What are the projected climate impacts?'
      ],
      'waste': [
        'How should I dispose of hazardous waste?',
        'What is the waste management system in Punjab?',
        'How can I recycle in my area?'
      ],
      'law': [
        'What are the environmental laws in Punjab?',
        'How do I file an environmental complaint?',
        'What is the EIA process?'
      ]
    }

    for (const [keyword, questions] of Object.entries(suggestions)) {
      if (queryLower.includes(keyword)) {
        return questions.slice(0, limit)
      }
    }

    return [
      'What is the air quality situation in Punjab?',
      'How does climate change affect Punjab?',
      'What environmental laws apply in Punjab?'
    ]
  }
}

// Export singleton instance
export const ragService = new RAGService()
