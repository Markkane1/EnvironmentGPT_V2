'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useChatStore } from '@/lib/store'
import { useAppSettingsStore } from '@/lib/app-settings'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
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
import { DOCUMENT_CATEGORIES, REPORT_SERIES, AUDIENCE_TYPES } from '@/lib/constants'
import { ChatSession } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { DocumentList } from '@/components/documents/document-list'

export function Sidebar() {
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
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [selectedReportSeries, setSelectedReportSeries] = useState('all')
  const [activeTab, setActiveTab] = useState('filters')
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Load recent sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true)
      try {
        const response = await fetch(`/api/sessions?limit=${maxHistoryItems}`)
        const data = await response.json()
        if (data.success && data.sessions) {
          setRecentSessions(data.sessions)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoadingSessions(false)
      }
    }
    
    fetchSessions()
  }, [maxHistoryItems, setRecentSessions])

  // Handle session click
  const handleSessionClick = async (session: ChatSession) => {
    try {
      const response = await fetch(`/api/sessions?id=${session.id}`)
      const data = await response.json()
      if (data.success && data.session) {
        loadSession(data.session)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  // Handle session delete
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' })
      removeSession(sessionId)
      if (currentSessionId === sessionId) {
        clearMessages()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  // Handle document upload complete
  const handleUploadComplete = () => {
    setShowUploadModal(false)
    // Optionally switch to documents tab
    setActiveTab('documents')
  }

  // Collapsed sidebar
  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r bg-gray-50 flex flex-col items-center py-4 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mb-4"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col items-center gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearMessages}
            title="New chat"
            aria-label="Start new chat"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
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
            onClick={() => {
              toggleSidebar()
              setShowUploadModal(true)
            }}
            title="Upload document"
            aria-label="Upload document"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Settings" aria-label="Open settings" asChild>
            <Link href="/settings">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Expanded sidebar
  return (
    <>
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">EPA Punjab</h2>
                <span className="text-xs text-gray-500">Environment GPT</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <Badge variant="secondary" className="mt-2 text-xs bg-green-100 text-green-700">
            Beta v2.0 - Phase 6-7
          </Badge>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 border-green-200 hover:bg-green-50 hover:border-green-300"
            onClick={clearMessages}
          >
            <MessageSquarePlus className="w-4 h-4 text-green-600" />
            New Chat
          </Button>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-3 mt-3">
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

          {/* Filters Tab */}
          <TabsContent value="filters" className="flex-1 m-0">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* Audience Selection */}
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

                {/* Category Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Filter by Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Series Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Filter by Report Series</Label>
                  <Select value={selectedReportSeries} onValueChange={setSelectedReportSeries}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="All reports" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reports</SelectItem>
                      {REPORT_SERIES.map((series) => (
                        <SelectItem key={series.value} value={series.value}>
                          {series.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Search */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Search Documents</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Search by title..." 
                      className="bg-white pl-9 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Quick Stats */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Knowledge Base Stats</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded border text-center">
                      <p className="text-lg font-semibold text-green-600">--</p>
                      <p className="text-xs text-gray-500">Documents</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <p className="text-lg font-semibold text-blue-600">--</p>
                      <p className="text-xs text-gray-500">Chunks</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="flex-1 m-0">
            <DocumentList 
              onUploadClick={() => setShowUploadModal(true)}
              onSelectDocument={() => {}}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
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
                          onClick={(e) => handleDeleteSession(session.id, e)}
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

        {/* Footer */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <HelpCircle className="w-3 h-3 mr-1" />
              Help
            </Button>
            <span>v2.0.0-beta</span>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadComplete={handleUploadComplete}
      />
    </>
  )
}

// Leaf icon component
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
