// =====================================================
// EPA Punjab EnvironmentGPT - Conversation Memory Service
// Phase 5: Multi-turn Conversation Context Management
// =====================================================

import { db } from '@/lib/db'
import { MessageRole } from '@/types'

// ==================== Types ====================

export interface ConversationMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  sources?: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface ConversationSummary {
  sessionId: string
  title: string
  messageCount: number
  firstMessage: Date
  lastMessage: Date
  topics: string[]
  entities: ExtractedEntities
  summary?: string
}

export interface ExtractedEntities {
  locations: string[]
  categories: string[]
  years: number[]
  parameters: string[]
}

export interface ConversationContext {
  sessionId: string
  messages: ConversationMessage[]
  summary: ConversationSummary | null
  relevantDocumentIds: string[]
  topicEvolution: TopicEvolution[]
}

export interface TopicEvolution {
  messageIndex: number
  topic: string
  confidence: number
}

// ==================== Conversation Memory Service ====================

export class ConversationMemoryService {
  private readonly MAX_CONTEXT_MESSAGES = 20
  private readonly SUMMARY_THRESHOLD = 10

  /**
   * Get conversation context for a session
   */
  async getConversationContext(sessionId: string): Promise<ConversationContext> {
    const messages = await this.getSessionMessages(sessionId)
    const summary = await this.getConversationSummary(sessionId)
    const relevantDocumentIds = await this.extractRelevantDocumentIds(messages)
    const topicEvolution = this.analyzeTopicEvolution(messages)

    return {
      sessionId,
      messages,
      summary,
      relevantDocumentIds,
      topicEvolution
    }
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(
    sessionId: string,
    limit: number = this.MAX_CONTEXT_MESSAGES
  ): Promise<ConversationMessage[]> {
    try {
      const messages = await db.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return messages.reverse().map(msg => ({
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as MessageRole,
        content: msg.content,
        sources: msg.sources || undefined,
        timestamp: msg.createdAt,
        metadata: this.parseMetadata(msg.metadata)
      }))
    } catch (error) {
      console.error('Failed to get session messages:', error)
      return []
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    sources?: string,
    metadata?: Record<string, unknown>
  ): Promise<ConversationMessage | null> {
    try {
      const message = await db.chatMessage.create({
        data: {
          sessionId,
          role,
          content,
          sources,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        }
      })

      return {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role as MessageRole,
        content: message.content,
        sources: message.sources || undefined,
        timestamp: message.createdAt
      }
    } catch (error) {
      console.error('Failed to add message:', error)
      return null
    }
  }

  /**
   * Get or create conversation summary
   */
  async getConversationSummary(sessionId: string): Promise<ConversationSummary | null> {
    try {
      const session = await db.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      if (!session) return null

      const messages = session.messages
      const entities = this.extractEntities(messages.map(m => m.content))
      const topics = this.extractTopics(messages.map(m => m.content))

      return {
        sessionId,
        title: session.title || 'New Conversation',
        messageCount: messages.length,
        firstMessage: messages[0]?.createdAt || session.createdAt,
        lastMessage: messages[messages.length - 1]?.createdAt || session.createdAt,
        topics,
        entities,
        summary: session.summary || undefined
      }
    } catch (error) {
      console.error('Failed to get conversation summary:', error)
      return null
    }
  }

  /**
   * Generate and save conversation summary
   */
  async generateSummary(sessionId: string): Promise<string | null> {
    try {
      const messages = await this.getSessionMessages(sessionId, 50)
      
      if (messages.length < this.SUMMARY_THRESHOLD) {
        return null
      }

      // Generate summary from messages
      const summary = this.createSummary(messages)
      
      // Save to database
      await db.chatSession.update({
        where: { id: sessionId },
        data: { summary }
      })

      return summary
    } catch (error) {
      console.error('Failed to generate summary:', error)
      return null
    }
  }

  /**
   * Get recent conversations for a user
   */
  async getRecentConversations(
    limit: number = 10
  ): Promise<Array<{
    id: string
    title: string
    messageCount: number
    lastMessage: Date
    preview: string
  }>> {
    try {
      const sessions = await db.chatSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              createdAt: true
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      })

      return sessions.map(session => ({
        id: session.id,
        title: session.title || 'New Conversation',
        messageCount: session._count.messages,
        lastMessage: session.messages[0]?.createdAt || session.updatedAt,
        preview: session.messages[0]?.content.slice(0, 100) || ''
      }))
    } catch (error) {
      console.error('Failed to get recent conversations:', error)
      return []
    }
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    query: string,
    limit: number = 10
  ): Promise<Array<{
    sessionId: string
    title: string
    matchedMessage: string
    timestamp: Date
  }>> {
    try {
      const messages = await db.chatMessage.findMany({
        where: {
          content: {
            contains: query
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          session: {
            select: { title: true }
          }
        }
      })

      return messages.map(msg => ({
        sessionId: msg.sessionId,
        title: msg.session.title || 'New Conversation',
        matchedMessage: msg.content.slice(0, 200),
        timestamp: msg.createdAt
      }))
    } catch (error) {
      console.error('Failed to search conversations:', error)
      return []
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(sessionId: string): Promise<boolean> {
    try {
      // Delete messages first
      await db.chatMessage.deleteMany({
        where: { sessionId }
      })

      // Delete session
      await db.chatSession.delete({
        where: { id: sessionId }
      })

      return true
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      return false
    }
  }

  /**
   * Clear all messages in a conversation
   */
  async clearConversation(sessionId: string): Promise<boolean> {
    try {
      await db.chatMessage.deleteMany({
        where: { sessionId }
      })

      await db.chatSession.update({
        where: { id: sessionId },
        data: { title: 'New Conversation', summary: null }
      })

      return true
    } catch (error) {
      console.error('Failed to clear conversation:', error)
      return false
    }
  }

  // ==================== Context Building ====================

  /**
   * Build context string for LLM
   */
  buildContextString(messages: ConversationMessage[], maxMessages: number = 10): string {
    const recentMessages = messages.slice(-maxMessages)
    
    if (recentMessages.length === 0) return ''

    return recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')
  }

  /**
   * Parse message metadata safely
   */
  private parseMetadata(metadata?: string): Record<string, unknown> | undefined {
    if (!metadata) return undefined

    try {
      return JSON.parse(metadata) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  /**
   * Extract relevant document IDs from conversation
   */
  private async extractRelevantDocumentIds(
    messages: ConversationMessage[]
  ): Promise<string[]> {
    const documentIds = new Set<string>()

    for (const msg of messages) {
      if (msg.sources) {
        try {
          const sources = JSON.parse(msg.sources)
          for (const source of sources) {
            if (source.documentId) {
              documentIds.add(source.documentId)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return Array.from(documentIds)
  }

  /**
   * Analyze how topics evolved through conversation
   */
  private analyzeTopicEvolution(messages: ConversationMessage[]): TopicEvolution[] {
    const evolution: TopicEvolution[] = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role === 'user') {
        const topic = this.detectTopic(msg.content)
        evolution.push({
          messageIndex: i,
          topic: topic.topic,
          confidence: topic.confidence
        })
      }
    }

    return evolution
  }

  // ==================== Entity Extraction ====================

  private extractEntities(messages: string[]): ExtractedEntities {
    const allText = messages.join(' ').toLowerCase()
    
    const punjabLocations = [
      'lahore', 'faisalabad', 'rawalpindi', 'multan', 'gujranwala',
      'sialkot', 'sargodha', 'bahawalpur', 'sheikhupura', 'kasur'
    ]
    
    const locations: string[] = []
    for (const loc of punjabLocations) {
      if (allText.includes(loc)) {
        locations.push(loc.charAt(0).toUpperCase() + loc.slice(1))
      }
    }

    const categories = [
      'Air Quality', 'Water Resources', 'Climate Change', 
      'Waste Management', 'Biodiversity', 'Policy & Regulation'
    ]
    
    const detectedCategories: string[] = []
    const categoryKeywords: Record<string, string[]> = {
      'Air Quality': ['air', 'smog', 'pollution', 'pm2.5', 'emission'],
      'Water Resources': ['water', 'river', 'groundwater', 'drinking'],
      'Climate Change': ['climate', 'weather', 'temperature', 'global warming'],
      'Waste Management': ['waste', 'garbage', 'recycling', 'landfill'],
      'Biodiversity': ['biodiversity', 'species', 'wildlife', 'habitat'],
      'Policy & Regulation': ['law', 'regulation', 'policy', 'act', 'pepa']
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => allText.includes(kw))) {
        detectedCategories.push(category)
      }
    }

    const yearPattern = /\b(19|20)\d{2}\b/g
    const years = [...new Set(allText.match(yearPattern)?.map(y => parseInt(y)) || [])]

    const parameters: string[] = []
    const paramList = ['pm2.5', 'pm10', 'o3', 'no2', 'so2', 'co', 'ph', 'tds', 'bod', 'cod']
    for (const param of paramList) {
      if (allText.includes(param)) {
        parameters.push(param.toUpperCase())
      }
    }

    return {
      locations: [...new Set(locations)],
      categories: [...new Set(detectedCategories)],
      years,
      parameters: [...new Set(parameters)]
    }
  }

  private extractTopics(messages: string[]): string[] {
    const topics: string[] = []
    const allText = messages.join(' ')

    const topicKeywords: Record<string, string[]> = {
      'Air Pollution': ['air', 'pollution', 'smog', 'pm2.5', 'pm10', 'emission'],
      'Water Quality': ['water', 'river', 'groundwater', 'contamination'],
      'Climate Action': ['climate', 'adaptation', 'mitigation', 'carbon'],
      'Environmental Compliance': ['compliance', 'regulation', 'standard', 'permit'],
      'Waste Disposal': ['waste', 'disposal', 'recycling', 'landfill'],
      'Conservation': ['conservation', 'biodiversity', 'wildlife', 'protected']
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const count = keywords.filter(kw => 
        allText.toLowerCase().includes(kw)
      ).length
      
      if (count >= 2) {
        topics.push(topic)
      }
    }

    return topics.slice(0, 3)
  }

  private detectTopic(content: string): { topic: string; confidence: number } {
    const contentLower = content.toLowerCase()
    
    const topicPatterns: Record<string, string[]> = {
      'Air Quality': ['air', 'smog', 'pollution', 'pm2.5', 'pm10', 'breathing'],
      'Water': ['water', 'river', 'drinking', 'groundwater', 'aquifer'],
      'Climate': ['climate', 'weather', 'temperature', 'global warming'],
      'Waste': ['waste', 'garbage', 'recycling', 'disposal'],
      'Regulation': ['law', 'act', 'regulation', 'policy', 'compliance'],
      'General': []
    }

    for (const [topic, keywords] of Object.entries(topicPatterns)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          return { topic, confidence: 0.8 }
        }
      }
    }

    return { topic: 'General', confidence: 0.3 }
  }

  private createSummary(messages: ConversationMessage[]): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const topics = this.extractTopics(userMessages.map(m => m.content))
    const entities = this.extractEntities(messages.map(m => m.content))

    let summary = 'Conversation about'
    
    if (topics.length > 0) {
      summary += ` ${topics.join(', ')}`
    }
    
    if (entities.locations.length > 0) {
      summary += ` with focus on ${entities.locations.slice(0, 2).join(' and ')}`
    }
    
    summary += `. ${userMessages.length} questions asked.`

    return summary
  }

  // ==================== Statistics ====================

  /**
   * Get conversation statistics
   */
  async getConversationStats(sessionId: string): Promise<{
    messageCount: number
    userMessageCount: number
    assistantMessageCount: number
    avgMessageLength: number
    topTopics: string[]
    duration: number
  }> {
    const messages = await this.getSessionMessages(sessionId, 100)
    
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0)
    const avgLength = messages.length > 0 ? totalLength / messages.length : 0

    const topics = this.extractTopics(messages.map(m => m.content))

    let duration = 0
    if (messages.length >= 2) {
      duration = messages[messages.length - 1].timestamp.getTime() - 
                 messages[0].timestamp.getTime()
    }

    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      avgMessageLength: Math.round(avgLength),
      topTopics: topics,
      duration
    }
  }
}

// Export singleton instance
export const conversationMemoryService = new ConversationMemoryService()
