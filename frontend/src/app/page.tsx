'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/chat/sidebar'
import { EnhancedChatInterface } from '@/components/chat/enhanced-chat-interface'
import { useChatStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, ExternalLink } from 'lucide-react'

export default function Home() {
  const { toggleSidebar, sidebarOpen } = useChatStore()
  const [showAdminLink, setShowAdminLink] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          if (active) {
            setShowAdminLink(false)
          }
          return
        }

        const payload = await response.json()

        if (active) {
          setShowAdminLink(payload.authenticated === true && payload.role === 'admin')
        }
      } catch {
        if (active) {
          setShowAdminLink(false)
        }
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
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
              {showAdminLink ? (
                <Button variant="outline" size="sm" asChild>
                  <a href="/admin" className="gap-1">
                    Admin
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {/* Chat Interface */}
        <main className="flex-1 overflow-hidden">
          <EnhancedChatInterface />
        </main>
      </div>
    </div>
  )
}
