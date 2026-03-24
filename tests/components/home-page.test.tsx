import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Home from '@/app/page'
import { APP_CONFIG } from '@/lib/constants'
import { useChatStore } from '@/lib/store'

jest.mock('@/components/chat/sidebar', () => ({
  Sidebar: () => <aside>Sidebar stub</aside>,
}))

jest.mock('@/components/chat/enhanced-chat-interface', () => ({
  EnhancedChatInterface: () => <div>Enhanced chat stub</div>,
}))

const fetchMock = global.fetch as jest.Mock

describe('Home page accessibility', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('exposes the sidebar toggle with an accessible name', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: false,
        role: null,
      }),
    })

    useChatStore.setState({
      sidebarOpen: false,
    })

    render(<Home />)

    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument()
  })

  it('shows the admin link only for authenticated administrators', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        role: 'admin',
      }),
    })

    useChatStore.setState({
      sidebarOpen: true,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
    })
  })

  it('uses the shared organization URL for the EPA Punjab external link', () => {
    useChatStore.setState({
      sidebarOpen: true,
    })

    render(<Home />)

    expect(screen.getByRole('link', { name: /epa punjab/i })).toHaveAttribute('href', APP_CONFIG.organizationUrl)
  })
})
