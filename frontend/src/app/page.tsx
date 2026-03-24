'use client'

import { Sidebar } from '@/components/chat/sidebar'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'
import { useChatStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, ExternalLink } from 'lucide-react'

export default function Home() {
  const { toggleSidebar, sidebarOpen } = useChatStore()

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label="Toggle sidebar"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Model:</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  RAG + LLM
                </Badge>
              </div>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                Phase 6 Complete
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://epunjab.gov.pk/epa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  EPA Punjab
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin" className="gap-1">
                  Admin
                </a>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <EnhancedChatInterface />
        </main>
      </div>
    </div>
  )
}
