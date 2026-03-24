import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/chat/sidebar'
import { APP_CONFIG } from '@/lib/constants'
import { defaultAppSettings, useAppSettingsStore } from '@/lib/app-settings'
import { useChatStore } from '@/lib/store'

const fetchMock = global.fetch as jest.Mock
const documentListMock = jest.fn(() => <div>Document list</div>)

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock('@/components/documents/document-upload-modal', () => ({
  DocumentUploadModal: () => null,
}))

jest.mock('@/components/documents/document-list', () => ({
  DocumentList: (props: unknown) => documentListMock(props),
}))

describe('Sidebar regressions', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    documentListMock.mockClear()

    useAppSettingsStore.setState({ settings: defaultAppSettings })
    useChatStore.setState({
      messages: [],
      isLoading: false,
      currentSessionId: 'session-123',
      recentSessions: [],
      selectedDocuments: [],
      selectedAudience: 'General Public',
      selectedCategory: 'all',
      sidebarOpen: true,
    })
  })

  it('removes fake document filter controls and passes no no-op document selection handler', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sessions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statistics: { documents: 4 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statistics: { totalChunks: 12 } }),
      })

    render(<Sidebar initialTab="documents" />)

    await waitFor(() => expect(documentListMock).toHaveBeenCalled())
    expect(screen.queryByText(/filter by report series/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/search documents/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /epa punjab/i })).toHaveAttribute('href', APP_CONFIG.organizationUrl)
    expect(documentListMock.mock.calls[0]?.[0]).toMatchObject({
      onUploadClick: expect.any(Function),
    })
    expect(documentListMock.mock.calls[0]?.[0]?.onSelectDocument).toBeUndefined()
  })

  it('shows visible session and knowledge-base errors instead of failing silently', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Stats unavailable'))
      .mockRejectedValueOnce(new Error('Stats unavailable'))
      .mockRejectedValueOnce(new Error('Session load failed'))

    render(<Sidebar initialTab="documents" />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText(/stats unavailable|failed to load knowledge base statistics/i)
    ).toBeInTheDocument()

    render(<Sidebar initialTab="history" />)
    expect(await screen.findByText(/session load failed/i)).toBeInTheDocument()
  })
})
