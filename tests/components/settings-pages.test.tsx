import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '@/components/chat/sidebar'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { AppSettingsProvider } from '@/components/settings/app-settings-provider'
import { defaultAppSettings, useAppSettingsStore } from '@/lib/app-settings'
import { useChatStore } from '@/lib/store'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock('@/components/documents/document-upload-modal', () => ({
  DocumentUploadModal: () => null,
}))

jest.mock('@/components/documents/document-list', () => ({
  DocumentList: () => <div>Document list</div>,
}))

const fetchMock = global.fetch as jest.Mock

beforeEach(() => {
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
  fetchMock.mockReset()
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.theme
})

describe('SettingsPanel', () => {
  it('removes only app storage keys when clearing local data', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('epa-settings')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('epa-chat-storage')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('epa-ui-storage')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('epa-document-storage')
    expect(window.localStorage.clear).not.toHaveBeenCalled()
    expect(window.sessionStorage.clear).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('uses the saved history limit when loading sidebar sessions', async () => {
    render(<SettingsPanel />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(useAppSettingsStore.getState().settings.maxHistoryItems).toBe(5)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, sessions: [] }),
    })

    render(<Sidebar initialTab="history" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sessions?limit=5'))
  })

  it('hides source badges after saving show sources off', () => {
    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    useChatStore.setState({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Grounded answer',
          timestamp: new Date(),
          sources: [
            {
              id: 'source-1',
              documentId: 'doc-1',
              title: 'Punjab Air Quality Report',
              relevanceScore: 0.9,
            },
          ],
        },
      ],
    })

    render(<EnhancedChatInterface />)

    expect(screen.queryByRole('button', { name: /source/i })).not.toBeInTheDocument()
  })

  it('applies the saved theme to the document root', async () => {
    useAppSettingsStore.setState({
      settings: {
        ...defaultAppSettings,
        theme: 'dark',
      },
    })

    render(<AppSettingsProvider />)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })

  it('shows an exporting state while the export request is in flight', async () => {
    let resolveExport: ((value: unknown) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveExport = resolve
    }))

    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: /^export$/i }))

    expect(await screen.findByRole('button', { name: /exporting/i })).toBeDisabled()

    resolveExport?.({
      ok: true,
      blob: async () => new Blob(['{}'], { type: 'application/json' }),
    })

    await waitFor(() => expect(screen.getByRole('button', { name: /^export$/i })).toBeEnabled())
  })
})
