import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'
import { useChatStore, useUIStore } from '@/lib/store'

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/chat/sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}))

const fetchMock = global.fetch as jest.Mock

function resetStores() {
  useChatStore.setState({
    messages: [],
    isLoading: false,
    currentSessionId: 'session-123',
    recentSessions: [],
    selectedDocuments: [],
    selectedAudience: 'Technical',
    selectedCategory: 'all',
    sidebarOpen: true,
  })

  useUIStore.setState({
    isDarkMode: false,
    showFeedbackModal: false,
    feedbackMessageId: null,
    showDocumentModal: false,
    showSettingsModal: false,
    toasts: [],
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  resetStores()
})

describe('EnhancedChatInterface regressions', () => {
  it('sends the current session and omits the all-category filter', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        response: 'OK',
        sources: [],
        sessionId: 'session-123',
        timestamp: new Date().toISOString(),
      }),
    })

    render(<EnhancedChatInterface />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What is the AQI?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body as string)

    expect(body).toMatchObject({
      message: 'What is the AQI?',
      audience: 'Technical',
      sessionId: 'session-123',
    })
    expect(body).not.toHaveProperty('filters')
  })

  it('reuses the current session when regenerating a response', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is PM2.5?',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'PM2.5 is fine particulate matter.',
          timestamp: new Date(),
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        response: 'PM2.5 is fine particulate matter.',
        sources: [],
        timestamp: new Date().toISOString(),
      }),
    })

    render(<EnhancedChatInterface />)

    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body as string)

    expect(body).toMatchObject({
      message: 'What is PM2.5?',
      audience: 'Technical',
      sessionId: 'session-123',
    })
    expect(body).not.toHaveProperty('filters')
  })

  it('submits assistant feedback with the backend message id', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'assistant-local-1',
          role: 'assistant',
          content: 'This is a grounded answer.',
          timestamp: new Date(),
          backendMessageId: 'db-message-123',
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        feedback: {
          id: 'feedback-1',
          messageId: 'db-message-123',
          rating: 5,
        },
      }),
    })

    render(<EnhancedChatInterface />)

    fireEvent.click(screen.getByRole('button', { name: /mark response as helpful/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body as string)

    expect(url).toBe('/api/feedback')
    expect(options.method).toBe('POST')
    expect(body).toEqual({
      messageId: 'db-message-123',
      rating: 5,
    })
  })

  it('clears stale sources when starting a new chat', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        response: 'Air quality varies across Punjab.',
        sources: [
          {
            id: 'source-1',
            documentId: 'doc-1',
            title: 'Air Quality Report 2024',
            relevanceScore: 0.95,
          },
        ],
        confidence: 0.9,
        sessionId: 'session-456',
        timestamp: new Date().toISOString(),
      }),
    })

    render(<EnhancedChatInterface />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tell me about air quality' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: /1 source/i }).length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: /start new chat/i }))

    expect(screen.queryAllByRole('button', { name: /1 source/i })).toHaveLength(0)
  })
})
