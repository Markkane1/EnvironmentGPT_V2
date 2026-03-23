// =====================================================
// EPA Punjab EnvironmentGPT - Conversation Memory Tests
// Phase 8: Unit Tests for conversation-memory.ts
// =====================================================

import { ConversationMemoryService, ConversationMessage } from '@/lib/services/conversation-memory'

jest.mock('@/lib/db', () => ({
  db: {
    chatSession: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'

describe('ConversationMemoryService', () => {
  let memoryService: ConversationMemoryService

  const conversationMessages = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user' as const,
      content: 'What is the air quality in Lahore?',
      sources: JSON.stringify([{ documentId: 'doc-1' }]),
      metadata: JSON.stringify({ confidence: 0.7 }),
      createdAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'assistant' as const,
      content: 'Lahore has seasonal smog issues.',
      sources: JSON.stringify([{ documentId: 'doc-1' }]),
      metadata: JSON.stringify({ responseTime: 120 }),
      createdAt: new Date('2024-01-01T10:01:00Z'),
    },
    {
      id: 'msg-3',
      sessionId: 'session-1',
      role: 'user' as const,
      content: 'What about PM2.5 levels?',
      sources: null,
      metadata: '{bad json',
      createdAt: new Date('2024-01-01T10:02:00Z'),
    },
  ]

  beforeEach(() => {
    memoryService = new ConversationMemoryService()
    jest.clearAllMocks()
  })

  describe('getSessionMessages()', () => {
    it('returns messages in chronological order and parses metadata safely', async () => {
      ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue([...conversationMessages].reverse())

      const messages = await memoryService.getSessionMessages('session-1')

      expect(messages).toHaveLength(3)
      expect(messages[0].id).toBe('msg-1')
      expect(messages[0].metadata).toEqual({ confidence: 0.7 })
      expect(messages[2].metadata).toBeUndefined()
    })
  })

  describe('addMessage()', () => {
    it('creates a message and serializes metadata', async () => {
      ;(db.chatMessage.create as jest.Mock).mockResolvedValue({
        id: 'msg-new',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Stored response',
        sources: JSON.stringify([{ documentId: 'doc-2' }]),
        createdAt: new Date('2024-01-01T10:03:00Z'),
      })

      const result = await memoryService.addMessage(
        'session-1',
        'assistant',
        'Stored response',
        JSON.stringify([{ documentId: 'doc-2' }]),
        { confidence: 0.95 }
      )

      expect(result?.id).toBe('msg-new')
      expect(db.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: JSON.stringify({ confidence: 0.95 }),
          }),
        })
      )
    })
  })

  describe('getConversationSummary()', () => {
    it('summarizes a session with entities and topics', async () => {
      ;(db.chatSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        title: 'Air Quality Discussion',
        summary: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        messages: conversationMessages,
      })

      const summary = await memoryService.getConversationSummary('session-1')

      expect(summary?.title).toBe('Air Quality Discussion')
      expect(summary?.messageCount).toBe(3)
      expect(summary?.topics).toContain('Air Pollution')
      expect(summary?.entities.locations).toContain('Lahore')
    })
  })

  describe('generateSummary()', () => {
    it('returns null until the summary threshold is reached', async () => {
      ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue(conversationMessages.slice(0, 2))

      await expect(memoryService.generateSummary('session-1')).resolves.toBeNull()
    })

    it('persists a generated summary once enough messages exist', async () => {
      const enoughMessages = Array.from({ length: 10 }, (_, index) => ({
        id: `msg-${index}`,
        sessionId: 'session-1',
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: index % 2 === 0 ? 'What is the air quality?' : 'Air quality is degraded.',
        sources: null,
        metadata: null,
        createdAt: new Date(`2024-01-01T10:${String(index).padStart(2, '0')}:00Z`),
      }))

      ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue(enoughMessages)
      ;(db.chatSession.update as jest.Mock).mockResolvedValue({ id: 'session-1' })

      const summary = await memoryService.generateSummary('session-1')

      expect(summary).toContain('Conversation about')
      expect(db.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({ summary }),
        })
      )
    })
  })

  describe('getRecentConversations()', () => {
    it('returns a compact preview for recent sessions', async () => {
      ;(db.chatSession.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'session-1',
          title: 'Air Quality Discussion',
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          messages: [{ content: 'Latest question about Lahore', createdAt: new Date('2024-01-01T11:00:00Z') }],
          _count: { messages: 2 },
        },
      ])

      const sessions = await memoryService.getRecentConversations(5)

      expect(sessions).toHaveLength(1)
      expect(sessions[0].preview).toContain('Latest question')
    })
  })

  describe('searchConversations()', () => {
    it('returns matching messages with session titles', async () => {
      ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue([
        {
          sessionId: 'session-1',
          content: 'Air quality in Lahore is poor',
          createdAt: new Date('2024-01-01T12:00:00Z'),
          session: { title: 'Air Quality Discussion' },
        },
      ])

      const results = await memoryService.searchConversations('Lahore')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Air Quality Discussion')
    })
  })

  describe('conversation management', () => {
    it('deletes a conversation and its messages', async () => {
      ;(db.chatMessage.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
      ;(db.chatSession.delete as jest.Mock).mockResolvedValue({ id: 'session-1' })

      await expect(memoryService.deleteConversation('session-1')).resolves.toBe(true)
      expect(db.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 'session-1' } })
      expect(db.chatSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
    })

    it('clears a conversation without deleting the session', async () => {
      ;(db.chatMessage.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
      ;(db.chatSession.update as jest.Mock).mockResolvedValue({ id: 'session-1' })

      await expect(memoryService.clearConversation('session-1')).resolves.toBe(true)
      expect(db.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            title: 'New Conversation',
            summary: null,
          }),
        })
      )
    })
  })

  describe('buildContextString()', () => {
    it('renders recent conversation turns', () => {
      const context = memoryService.buildContextString(
        [
          { id: '1', sessionId: 's', role: 'user', content: 'Hello', timestamp: new Date() },
          { id: '2', sessionId: 's', role: 'assistant', content: 'Hi', timestamp: new Date() },
        ],
        5
      )

      expect(context).toContain('User: Hello')
      expect(context).toContain('Assistant: Hi')
    })
  })

  describe('getConversationStats()', () => {
    it('reports basic message statistics', async () => {
      ;(db.chatMessage.findMany as jest.Mock).mockResolvedValue(conversationMessages)

      const stats = await memoryService.getConversationStats('session-1')

      expect(stats.messageCount).toBe(3)
      expect(stats.userMessageCount).toBe(2)
      expect(stats.assistantMessageCount).toBe(1)
      expect(stats.avgMessageLength).toBeGreaterThan(0)
      expect(stats.topTopics.length).toBeGreaterThan(0)
    })
  })
})
