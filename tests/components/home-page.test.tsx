import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'
import { useChatStore } from '@/lib/store'

jest.mock('@/components/chat/sidebar', () => ({
  Sidebar: () => <aside>Sidebar stub</aside>,
}))

jest.mock('@/components/chat/enhanced-chat-interface', () => ({
  EnhancedChatInterface: () => <div>Enhanced chat stub</div>,
}))

describe('Home page accessibility', () => {
  it('exposes the sidebar toggle with an accessible name', () => {
    useChatStore.setState({
      sidebarOpen: false,
    })

    render(<Home />)

    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument()
  })
})
