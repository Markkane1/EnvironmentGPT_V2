'use client'

import { Sidebar } from '@/components/chat/sidebar'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'
import { APP_CONFIG } from '@/lib/constants'
import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Menu, ExternalLink, ShieldCheck } from 'lucide-react'

export default function Home() {
  const { toggleSidebar, sidebarOpen } = useChatStore()

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-white px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <Menu className="h-4 w-4" />
              </Button>
              {!sidebarOpen && (
                <span className="hidden text-sm font-medium text-gray-700 sm:inline">
                  EPA Punjab · EnvironmentGPT
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                asChild
              >
                <a
                  href={APP_CONFIG.organizationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  EPA Punjab
                </a>
              </Button>
              <div className="h-4 w-px bg-gray-200" />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                asChild
              >
                <a href="/admin">
                  <ShieldCheck className="h-3.5 w-3.5" />
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
