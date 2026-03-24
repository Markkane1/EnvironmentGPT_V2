import { useChatStore, useDocumentStore, useUIStore } from '@/lib/store'
import type { ChatSession, Document } from '@/types'

const documentFixture: Document = {
  id: 'doc-1',
  title: 'Punjab Air Quality Annual Review',
  content: 'Content',
  category: 'Air Quality',
  audience: 'Policy Maker',
  tags: ['air'],
  isActive: true,
  language: 'en',
  createdAt: new Date('2026-03-20T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
}

const sessionFixture: ChatSession = {
  id: 'session-1',
  title: 'Annual review',
  metadata: {
    totalMessages: 2,
  },
  createdAt: new Date('2026-03-20T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
  messages: [
    {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'Summarize it',
      createdAt: new Date('2026-03-20T00:00:00.000Z'),
    },
    {
      id: 'message-2',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'Here is the summary',
      sources: [
        {
          id: 'source-1',
          documentId: 'doc-1',
          title: 'Punjab Air Quality Annual Review',
          relevanceScore: 0.95,
        },
      ],
      createdAt: new Date('2026-03-20T00:01:00.000Z'),
    },
  ],
}

describe('chat store', () => {
  beforeEach(() => {
    useChatStore.setState(useChatStore.getInitialState(), true)
    jest.spyOn(global.crypto, 'randomUUID').mockReturnValue('uuid-1')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should add and update chat messages while tracking loading and session state', () => {
    const messageId = useChatStore.getState().addMessage({
      role: 'user',
      content: 'What is the air quality status?',
    })

    useChatStore.getState().updateMessageContent(messageId, 'Updated question')
    useChatStore.getState().updateMessage(messageId, {
      sources: [
        {
          id: 'source-1',
          documentId: 'doc-1',
          title: 'Punjab Air Quality Annual Review',
          relevanceScore: 0.9,
        },
      ],
      backendMessageId: 'backend-1',
    })
    useChatStore.getState().setLoading(true)
    useChatStore.getState().setCurrentSession('session-1')

    const state = useChatStore.getState()
    expect(messageId).toBe('uuid-1')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({
      id: 'uuid-1',
      content: 'Updated question',
      backendMessageId: 'backend-1',
    })
    expect(state.isLoading).toBe(true)
    expect(state.currentSessionId).toBe('session-1')
  })

  it('should load an existing session, manage filters, and remove sessions', () => {
    useChatStore.getState().loadSession(sessionFixture)
    useChatStore.getState().setSelectedDocuments(['doc-1'])
    useChatStore.getState().setSelectedAudience('Technical')
    useChatStore.getState().setSelectedCategory('Air Quality')
    useChatStore.getState().setRecentSessions([sessionFixture])
    useChatStore.getState().toggleSidebar()
    useChatStore.getState().removeSession('session-1')

    const state = useChatStore.getState()
    expect(state.currentSessionId).toBe('session-1')
    expect(state.messages[1]).toMatchObject({
      id: 'message-2',
      backendMessageId: 'message-2',
    })
    expect(state.selectedDocuments).toEqual(['doc-1'])
    expect(state.selectedAudience).toBe('Technical')
    expect(state.selectedCategory).toBe('Air Quality')
    expect(state.sidebarOpen).toBe(false)
    expect(state.recentSessions).toEqual([])
  })

  it('should clear messages and reset the active session id', () => {
    useChatStore.setState({
      messages: [{ id: 'message-1', role: 'user', content: 'Hello', timestamp: new Date() }],
      currentSessionId: 'session-1',
    })

    useChatStore.getState().clearMessages()

    expect(useChatStore.getState().messages).toEqual([])
    expect(useChatStore.getState().currentSessionId).toBeNull()
  })
})

describe('document store', () => {
  beforeEach(() => {
    useDocumentStore.setState(useDocumentStore.getInitialState(), true)
  })

  it('should update documents, pagination, loading state, and reset filters', () => {
    useDocumentStore.getState().setDocuments([documentFixture])
    useDocumentStore.getState().setSelectedDocument(documentFixture)
    useDocumentStore.getState().setLoading(true)
    useDocumentStore.getState().setPagination(25, 3, 20)
    useDocumentStore.getState().setFilters({
      category: 'Air Quality',
      searchQuery: 'Punjab',
    })

    expect(useDocumentStore.getState()).toMatchObject({
      documents: [documentFixture],
      selectedDocument: documentFixture,
      isLoading: true,
      totalCount: 25,
      currentPage: 3,
      pageSize: 20,
      filters: {
        category: 'Air Quality',
        searchQuery: 'Punjab',
      },
    })

    useDocumentStore.getState().resetFilters()
    expect(useDocumentStore.getState().filters).toEqual(useDocumentStore.getInitialState().filters)
  })
})

describe('ui store', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState(), true)
    jest.spyOn(global.crypto, 'randomUUID').mockReturnValue('toast-1')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should toggle modal state and add or remove toasts', () => {
    useUIStore.getState().toggleDarkMode()
    useUIStore.getState().setShowFeedbackModal(true, 'message-1')
    useUIStore.getState().setShowDocumentModal(true)
    useUIStore.getState().setShowSettingsModal(true)
    useUIStore.getState().addToast({
      type: 'success',
      title: 'Saved',
      message: 'Provider saved successfully',
    })

    expect(useUIStore.getState()).toMatchObject({
      isDarkMode: true,
      showFeedbackModal: true,
      feedbackMessageId: 'message-1',
      showDocumentModal: true,
      showSettingsModal: true,
      toasts: [
        {
          id: 'toast-1',
          type: 'success',
          title: 'Saved',
        },
      ],
    })

    useUIStore.getState().removeToast('toast-1')
    expect(useUIStore.getState().toasts).toEqual([])
  })
})
