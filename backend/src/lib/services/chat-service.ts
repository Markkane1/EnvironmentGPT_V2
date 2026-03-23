// =====================================================
// EPA Punjab EnvironmentGPT - Enhanced Chat Service
// Phase 2: RAG with Vector Search Integration
// =====================================================

import { db } from '@/lib/db'
import { 
  ChatSession, 
  ChatRequest, 
  ChatResponse,
  SourceReference,
  MessageRole 
} from '@/types'
import { vectorStoreService } from './vector-store-service'
import ZAI from 'z-ai-web-dev-sdk'

// ==================== Chat Service Class ====================

export class ChatService {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null

  async initialize() {
    if (!this.zai) {
      this.zai = await ZAI.create()
    }
    return this.zai
  }

  /**
   * Process a chat message and return AI response with RAG
   */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      await this.initialize()
      
      // Create or get session
      let sessionId = request.sessionId
      if (!sessionId) {
        const session = await this.createSession()
        sessionId = session.id
      }

      // Retrieve relevant documents using vector search
      const searchResults = await vectorStoreService.hybridSearch(request.message, {
        topK: 5,
        category: request.filters?.category,
        documentIds: request.documentIds,
        keywordWeight: 0.3
      })

      // Build context from retrieved documents
      const context = searchResults.length > 0
        ? searchResults.map(result => 
            `[${result.metadata.title}${result.metadata.category ? ` - ${result.metadata.category}` : ''}]\n${result.content}`
          ).join('\n\n---\n\n')
        : await this.getFallbackContext()

      // Build the system prompt based on audience
      const systemPrompt = this.buildSystemPrompt(request.audience || 'General Public', context)

      // Call the LLM
      const completion = await this.zai!.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.message }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      const assistantResponse = completion.choices[0]?.message?.content || 
        'I apologize, but I was unable to generate a response. Please try again.'

      // Format sources
      const sources: SourceReference[] = searchResults.length > 0
        ? vectorStoreService.resultsToSources(searchResults)
        : []

      // Save messages to database
      const messageId = await this.saveMessages(
        sessionId, 
        request.message, 
        assistantResponse, 
        sources
      )

      return {
        success: true,
        response: assistantResponse,
        sources,
        sessionId,
        messageId,
        timestamp: new Date(),
      }

    } catch (error) {
      console.error('Chat service error:', error)
      return {
        success: false,
        error: 'Failed to process your request. Please try again.',
        timestamp: new Date(),
      }
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(title?: string, documentId?: string): Promise<ChatSession> {
    return this.createOwnedSession(undefined, title, documentId)
  }

  async createOwnedSession(userId?: string, title?: string, documentId?: string): Promise<ChatSession> {
    const session = await db.chatSession.create({
      data: {
        userId,
        title: title || 'New Chat',
        documentId,
      }
    })

    return {
      id: session.id,
      title: session.title || undefined,
      userId: session.userId || undefined,
      documentId: session.documentId || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: [],
      metadata: {
        totalMessages: 0,
      }
    }
  }

  /**
   * Get session with messages
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!session) return null

    return {
      id: session.id,
      title: session.title || undefined,
      userId: session.userId || undefined,
      documentId: session.documentId || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(msg => ({
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as MessageRole,
        content: msg.content,
        sources: msg.sources ? JSON.parse(msg.sources) : undefined,
        createdAt: msg.createdAt,
      })),
      metadata: {
        totalMessages: session.messages.length,
      }
    }
  }

  /**
   * Get recent sessions
   */
  async getRecentSessions(limit: number = 10, userId?: string): Promise<ChatSession[]> {
    const sessions = await db.chatSession.findMany({
      where: userId ? { userId } : undefined,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    return sessions.map(session => ({
      id: session.id,
      title: session.title || 'Untitled Chat',
      userId: session.userId || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: [],
      metadata: {
        totalMessages: session.messages.length,
      }
    }))
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await db.chatSession.delete({
        where: { id: sessionId }
      })
      return true
    } catch {
      return false
    }
  }

  // ==================== Private Methods ====================

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(audience: string, context: string): string {
    const audiencePrompts: Record<string, string> = {
      'General Public': 'Explain concepts in simple, easy-to-understand language. Use everyday examples and avoid technical jargon. Focus on practical implications for citizens.',
      'Technical': 'Provide detailed technical information with scientific references, methodology details, data sources, and quantitative metrics. Include relevant standards and specifications.',
      'Policy Maker': 'Focus on policy implications, recommendations, cost-benefit analysis, implementation strategies, and regulatory frameworks. Highlight actionable insights for decision-making.'
    }

    return `You are EPA Punjab's Environmental Knowledge Assistant, an AI-powered tool designed to help citizens, researchers, and policymakers access environmental information about Punjab, Pakistan.

Your role:
- Provide accurate, science-based environmental information
- Cite specific sources from the knowledge base when answering questions
- Be helpful, informative, and transparent about information sources
- Admit when you don't have sufficient information in the knowledge base
- Tailor your responses to the audience type

${audiencePrompts[audience] || audiencePrompts['General Public']}

---
KNOWLEDGE BASE CONTEXT:
${context || 'No specific documents found in the knowledge base for this query. Use general knowledge about environmental issues in Punjab, Pakistan.'}
---

Important guidelines:
1. When information comes from the knowledge base, cite the source document name
2. If information is not in the knowledge base, clearly state this
3. Provide specific, actionable information when possible
4. Include relevant data, statistics, and standards when available
5. Consider the environmental context of Punjab, Pakistan:
   - Air quality challenges (smog, vehicular emissions, industrial pollution, stubble burning)
   - Water resources (rivers Ravi, Sutlej, Chenab; groundwater depletion)
   - Climate change impacts (temperature rise, changing precipitation)
   - Biodiversity (protected areas, threatened species)
   - Waste management (solid waste, healthcare waste)
   - Environmental regulations (PEPA 1997, NEQS)`
  }

  /**
   * Get fallback context when vector search returns no results
   */
  private async getFallbackContext(): Promise<string> {
    // Use simple keyword matching as fallback
    const documents = await db.document.findMany({
      where: { isActive: true },
      take: 3
    })

    if (documents.length === 0) {
      return ''
    }

    return documents.map(doc => `[${doc.title}]\n${doc.content.slice(0, 500)}...`).join('\n\n---\n\n')
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
          content: userMessage,
        }
      })
      
      // Save assistant response
      const assistantMsg = await db.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: assistantResponse,
          sources: JSON.stringify(sources)
        }
      })
      
      // Update session title if it's the first message
      const existingMessages = await db.chatMessage.count({
        where: { sessionId }
      })
      
      if (existingMessages === 2) { // Just saved 2 messages (user + assistant)
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '')
        await db.chatSession.update({
          where: { id: sessionId },
          data: { title }
        })
      }

      return assistantMsg.id
    } catch (error) {
      console.error('Failed to save messages:', error)
      return ''
    }
  }
}

// Export singleton instance
export const chatService = new ChatService()
