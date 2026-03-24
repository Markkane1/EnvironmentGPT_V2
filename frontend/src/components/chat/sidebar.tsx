'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useChatStore } from '@/lib/store'
import { useAppSettingsStore } from '@/lib/app-settings'
import { APP_CONFIG, AUDIENCE_TYPES, DOCUMENT_CATEGORIES } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Settings,
  HelpCircle,
  Trash2,
  Clock,
  Search,
  Upload,
  Database,
  History
} from 'lucide-react'
import { ChatSession } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { DocumentList } from '@/components/documents/document-list'

export function Sidebar({ initialTab = 'filters' }: { initialTab?: 'filters' | 'documents' | 'history' }) {
  const {
    sidebarOpen,
    toggleSidebar,
    selectedAudience,
    setSelectedAudience,
    selectedCategory,
    setSelectedCategory,
    clearMessages,
    recentSessions,
    setRecentSessions,
    loadSession,
    removeSession,
    currentSessionId
  } = useChatStore()
  const maxHistoryItems = useAppSettingsStore((state) => state.settings.maxHistoryItems)

  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [kbStats, setKbStats] = useState<{ documents: number; chunks: number } | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [kbStatsError, setKbStatsError] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (activeTab !== 'history') {
      return
    }

    const fetchSessions = async () => {
      setIsLoadingSessions(true)
      try {
        const response = await fetch(`/api/sessions?limit=${maxHistoryItems}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load sessions')
        }

        setRecentSessions(data.sessions || [])
        setSessionsError(null)
      } catch (error) {
        setRecentSessions([])
        setSessionsError(error instanceof Error ? error.message : 'Failed to load sessions')
      } finally {
        setIsLoadingSessions(false)
      }
    }

    fetchSessions()
  }, [activeTab, maxHistoryItems, setRecentSessions])

  useEffect(() => {
    if (activeTab !== 'documents') {
      return
    }

    const fetchKbStats = async () => {
      try {
        const [overviewRes, chunksRes] = await Promise.all([
          fetch('/api/stats?type=overview'),
          fetch('/api/stats?type=documents'),
        ])

        if (!overviewRes.ok || !chunksRes.ok) {
          throw new Error('Failed to load knowledge base statistics')
        }

        const [overview, docs] = await Promise.all([overviewRes.json(), chunksRes.json()])
        setKbStats({
          documents: overview?.statistics?.documents ?? 0,
          chunks: docs?.statistics?.totalChunks ?? docs?.statistics?.chunks ?? 0,
        })
        setKbStatsError(null)
      } catch (error) {
        setKbStats(null)
        setKbStatsError(
          error instanceof Error ? error.message : 'Failed to load knowledge base statistics'
        )
      }
    }

    fetchKbStats()
  }, [activeTab])

  const handleSessionClick = async (session: ChatSession) => {
    try {
      const response = await fetch(`/api/sessions?id=${session.id}`)
      const data = await response.json()

      if (!response.ok || !data.success || !data.session) {
        throw new Error(data.error || 'Failed to load session')
      }

      loadSession(data.session)
      setSessionsError(null)
    } catch (error) {
      toast({
        title: 'Session unavailable',
        description: error instanceof Error ? error.message : 'Failed to load session',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()

    try {
      const response = await fetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete session')
      }

      removeSession(sessionId)
      if (currentSessionId === sessionId) {
        clearMessages()
      }

      setSessionsError(null)
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete session',
        variant: 'destructive'
      })
    }
  }

  const handleUploadComplete = () => {
    setShowUploadModal(false)
    setActiveTab('documents')
  }

  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r bg-white flex flex-col items-center py-3 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 mb-2"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearMessages}
            title="New chat"
            aria-label="Start new chat"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              toggleSidebar()
              setActiveTab('documents')
            }}
            title="Documents"
            aria-label="Open documents"
          >
            <Database className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              toggleSidebar()
              setShowUploadModal(true)
            }}
            title="Upload document"
            aria-label="Upload document"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Settings" aria-label="Open settings" asChild>
            <Link href="/settings">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center shadow-sm">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-gray-900">EPA Punjab</h2>
                <span className="text-xs text-gray-500">Environment GPT</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800"
            onClick={clearMessages}
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <Separator />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pt-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="filters" className="text-xs">
                <Search className="w-3 h-3 mr-1" />
                Filters
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                Docs
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <History className="w-3 h-3 mr-1" />
                History
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="filters" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Select Audience</Label>
                  <Select value={selectedAudience} onValueChange={setSelectedAudience}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_TYPES.map((audience) => (
                        <SelectItem key={audience.value} value={audience.value}>
                          <div>
                            <span>{audience.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Filter by Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {DOCUMENT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Knowledge Base Stats</Label>
                  {kbStatsError ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {kbStatsError}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded-lg border text-center">
                      <p className="text-lg font-semibold text-teal-700">
                        {kbStats ? kbStats.documents : '-'}
                      </p>
                      <p className="text-xs text-gray-500">Documents</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border text-center">
                      <p className="text-lg font-semibold text-teal-700">
                        {kbStats ? kbStats.chunks : '-'}
                      </p>
                      <p className="text-xs text-gray-500">Chunks</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="documents" className="flex-1 m-0">
            {kbStatsError ? (
              <div className="px-3 pt-3">
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {kbStatsError}
                </p>
              </div>
            ) : null}
            <DocumentList onUploadClick={() => setShowUploadModal(true)} />
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {sessionsError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {sessionsError}
                  </div>
                ) : null}
                {isLoadingSessions ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : recentSessions.length > 0 ? (
                  recentSessions.slice(0, maxHistoryItems).map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSessionClick(session)}
                      className={cn(
                        'p-2 rounded-md bg-white border text-xs cursor-pointer transition-colors group',
                        currentSessionId === session.id
                          ? 'border-green-300 bg-green-50'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">
                            {session.title || 'Untitled Chat'}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(session.updatedAt, 'relative')}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(event) => handleDeleteSession(session.id, event)}
                          aria-label={`Delete session ${session.title || 'Untitled Chat'}`}
                        >
                          <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No recent chats
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="p-3 border-t bg-white">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700" asChild>
              <a href={APP_CONFIG.organizationUrl} target="_blank" rel="noopener noreferrer">
                <HelpCircle className="w-3 h-3 mr-1" />
                EPA Punjab
              </a>
            </Button>
            <span className="text-xs text-gray-400">v2.0.0-beta</span>
          </div>
        </div>
      </div>

      <DocumentUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadComplete={handleUploadComplete}
      />
    </>
  )
}

function Leaf({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}
