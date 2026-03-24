'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquare, 
  FileText, 
  Activity,
  Clock,
  ThumbsUp,
  Database,
  Upload,
  Trash2,
  Eye,
  RefreshCw,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  CheckCircle,
  XCircle,
  Search,
  Download
} from 'lucide-react'
import { DOCUMENT_CATEGORIES } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Document } from '@/types'
import { ProvidersSettingsPanel } from './providers-settings-panel'
import { ConnectorsSettingsPanel } from './connectors-settings-panel'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'

interface DashboardStats {
  overview: {
    documents: number
    sessions: number
    messages: number
    feedback: number
  }
  chat: {
    sessionsToday: number
    sessionsWeek: number
    totalQueries: number
    avgResponseTime: number
  }
  documents: {
    total: number
    byCategory: Record<string, number>
    byYear: Record<number, number>
    recentlyAdded: Array<{ id: string; title: string; category: string; year?: number; createdAt: string }>
  }
  feedback: {
    total: number
    avgRating: number
    ratingDistribution: Record<number, number>
    positiveRate: number
    recentFeedback: Array<{ id: string; rating: number; comment: string; createdAt: string }>
  }
  health: {
    status: string
    uptime: number
    services: Array<{ name: string; status: string; latency?: number }>
  }
  cache: {
    totalEntries: number
    hitRate: number
    memoryUsageMB: number
  }
}

export function EnhancedAdminDashboard({ initialTab = 'overview' }: { initialTab?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const recentDocuments = stats?.documents?.recentlyAdded || []
  const recentFeedback = stats?.feedback?.recentFeedback || []
  const categoryBreakdown = Object.entries(stats?.documents?.byCategory || {}).sort((a, b) => b[1] - a[1])
  const yearBreakdown = Object.entries(stats?.documents?.byYear || {}).sort((a, b) => Number(b[0]) - Number(a[0]))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredDocuments = recentDocuments.filter((doc) => {
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory
    const matchesSearch =
      !normalizedQuery ||
      doc.title.toLowerCase().includes(normalizedQuery) ||
      doc.category.toLowerCase().includes(normalizedQuery)

    return matchesCategory && matchesSearch
  })

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const [overviewRes, chatRes, docsRes, feedbackRes, healthRes, cacheRes] = await Promise.all([
        fetch('/api/stats?type=overview'),
        fetch('/api/stats?type=chat'),
        fetch('/api/stats?type=documents'),
        fetch('/api/stats?type=feedback'),
        fetch('/api/stats?type=health'),
        fetch('/api/cache')
      ])

      const [overview, chat, documents, feedback, health, cache] = await Promise.all([
        overviewRes.json(),
        chatRes.json(),
        docsRes.json(),
        feedbackRes.json(),
        healthRes.json(),
        cacheRes.json()
      ])

      setStats({
        overview: overview.statistics || { documents: 0, sessions: 0, messages: 0, feedback: 0 },
        chat: chat.statistics || { sessionsToday: 0, sessionsWeek: 0, totalQueries: 0, avgResponseTime: 0 },
        documents: documents.statistics || { total: 0, byCategory: {}, byYear: {}, recentlyAdded: [] },
        feedback: feedback.statistics || { total: 0, avgRating: 0, ratingDistribution: {}, positiveRate: 0, recentFeedback: [] },
        health: health.health || { status: 'unknown', uptime: 0, services: [] },
        cache: cache.stats || { totalEntries: 0, hitRate: 0, memoryUsageMB: 0 }
      })
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const clearCache = async () => {
    try {
      await fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      })
      fetchStats()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  const handleUploadComplete = async () => {
    setShowUploadModal(false)
    await fetchStats()
  }

  const handleViewDocument = async (documentId: string) => {
    setIsDocumentLoading(true)
    setDocumentDialogOpen(true)

    try {
      const response = await fetch(`/api/documents?id=${documentId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load document')
      }

      setSelectedDocument(data.document)
    } catch (error) {
      setDocumentDialogOpen(false)
      toast({
        title: 'Document unavailable',
        description: error instanceof Error ? error.message : 'Failed to load document',
        variant: 'destructive'
      })
    } finally {
      setIsDocumentLoading(false)
    }
  }

  const handleDownloadDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents?id=${documentId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to download document')
      }

      const document = data.document as Document
      const content = [
        document.title,
        `Category: ${document.category || 'Uncategorized'}`,
        `Audience: ${document.audience}`,
        document.year ? `Year: ${document.year}` : null,
        '',
        document.content,
      ].filter(Boolean).join('\n')

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${document.title.replace(/[^\w.-]+/g, '-').toLowerCase() || 'document'}.txt`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download document',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteDocument = async (documentId: string, title: string) => {
    if (!window.confirm(`Delete "${title}" from the knowledge base?`)) {
      return
    }

    try {
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete document')
      }

      if (selectedDocument?.id === documentId) {
        setDocumentDialogOpen(false)
        setSelectedDocument(null)
      }

      toast({
        title: 'Document deleted',
        description: `"${title}" was removed from the knowledge base.`
      })
      await fetchStats()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive'
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm">EPA Punjab EnvironmentGPT Management</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant={stats?.health?.status === 'healthy' ? 'default' : 'destructive'}
                className={stats?.health?.status === 'healthy' ? 'bg-green-100 text-green-700' : ''}
              >
                <Activity className="w-3 h-3 mr-1" />
                {stats?.health?.status || 'Unknown'}
              </Badge>
              <span className="text-sm text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <Button variant="outline" size="sm" onClick={fetchStats}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Documents"
            value={stats?.overview?.documents || 0}
            subtitle={`${stats?.documents?.total || 0} active`}
            icon={<FileText className="w-5 h-5" />}
            color="green"
          />
          <StatsCard
            title="Chat Sessions"
            value={stats?.overview?.sessions || 0}
            subtitle={`${stats?.chat?.sessionsToday || 0} today`}
            icon={<MessageSquare className="w-5 h-5" />}
            color="blue"
          />
          <StatsCard
            title="Total Queries"
            value={stats?.chat?.totalQueries || 0}
            subtitle={`${stats?.chat?.avgResponseTime || 0}ms avg`}
            icon={<Zap className="w-5 h-5" />}
            color="purple"
          />
          <StatsCard
            title="Avg Rating"
            value={stats?.feedback?.avgRating?.toFixed(1) || '-'}
            subtitle={`${stats?.feedback?.positiveRate || 0}% positive`}
            icon={<ThumbsUp className="w-5 h-5" />}
            color="amber"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="connectors" className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              Connectors
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Documents by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="w-5 h-5 text-green-600" />
                    Documents by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.documents?.byCategory && Object.entries(stats.documents.byCategory).length > 0 ? (
                      Object.entries(stats.documents.byCategory).map(([category, count]) => (
                        <div key={category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{category}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress 
                            value={(count / (stats.documents.total || 1)) * 100} 
                            className="h-2"
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No documents yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {filteredDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {filteredDocuments.map((doc, i) => (
                          <div key={doc.id || i} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.title}</p>
                              <p className="text-xs text-gray-500">{doc.category}</p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        {recentDocuments.length > 0 ? 'No matching documents' : 'No recent activity'}
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-600" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <HealthItem
                    icon={<Clock className="w-5 h-5" />}
                    label="Uptime"
                    value={formatUptime(stats?.health?.uptime || 0)}
                  />
                  <HealthItem
                    icon={<Cpu className="w-5 h-5" />}
                    label="Cache Hit Rate"
                    value={`${Math.round((stats?.cache?.hitRate || 0) * 100)}%`}
                  />
                  <HealthItem
                    icon={<HardDrive className="w-5 h-5" />}
                    label="Cache Memory"
                    value={`${stats?.cache?.memoryUsageMB?.toFixed(2) || 0} MB`}
                  />
                  <HealthItem
                    icon={<Wifi className="w-5 h-5" />}
                    label="API Latency"
                    value={`${stats?.chat?.avgResponseTime || 0}ms`}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Document Management</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        placeholder="Search documents..." 
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {DOCUMENT_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setShowUploadModal(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.length > 0 ? (
                      filteredDocuments.map((doc, i) => (
                        <TableRow key={doc.id || i}>
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.category}</Badge>
                          </TableCell>
                          <TableCell>{doc.year || '-'}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          </TableCell>
                          <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`View document ${doc.title}`}
                              onClick={() => handleViewDocument(doc.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Download document ${doc.title}`}
                              onClick={() => handleDownloadDocument(doc.id)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500"
                              aria-label={`Delete document ${doc.title}`}
                              onClick={() => handleDeleteDocument(doc.id, doc.title)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : recentDocuments.length > 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No matching documents
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No documents found. Upload documents to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700">Analytics Visualization</p>
              <p className="text-sm text-gray-500">Operational charts and document coverage summaries for the knowledge base.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Knowledge Base Mix</CardTitle>
                  <CardDescription>Live category distribution from indexed documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryBreakdown.length > 0 ? categoryBreakdown.map(([category, count]) => (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{category}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <Progress value={(count / (stats?.documents.total || 1)) * 100} className="h-2" />
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500">No indexed documents available yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Operational Summary</CardTitle>
                  <CardDescription>Current latency, feedback, and yearly coverage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-gray-500">Average Response</p>
                        <p className="text-lg font-semibold">{stats?.chat?.avgResponseTime || 0}ms</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-gray-500">Positive Feedback</p>
                        <p className="text-lg font-semibold">{stats?.feedback?.positiveRate || 0}%</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Documents by year</p>
                      {yearBreakdown.length > 0 ? yearBreakdown.slice(0, 5).map(([year, count]) => (
                        <div key={year} className="flex items-center justify-between text-sm text-gray-600">
                          <span>{year}</span>
                          <span>{count}</span>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500">No yearly metadata available yet.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Feedback</CardTitle>
                <CardDescription>
                  Total: {stats?.feedback?.total || 0} • Average Rating: {stats?.feedback?.avgRating?.toFixed(1) || '-'} ⭐
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.feedback?.ratingDistribution && Object.keys(stats.feedback.ratingDistribution).length > 0 ? (
                    Object.entries(stats.feedback.ratingDistribution)
                      .sort((a, b) => Number(b[0]) - Number(a[0]))
                      .map(([rating, count]) => (
                        <div key={rating} className="flex items-center gap-4">
                          <div className="flex items-center gap-1 w-16">
                            <span className="text-lg font-medium">{rating}</span>
                            <span className="text-yellow-500">⭐</span>
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div 
                              className={cn(
                                'h-full rounded-full',
                                Number(rating) >= 4 ? 'bg-green-500' : 
                                Number(rating) >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                              )}
                              style={{ 
                                width: `${(count / (stats.feedback.total || 1)) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No feedback received yet</p>
                  )}
                  {recentFeedback.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {recentFeedback.map((item) => (
                          <div key={item.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{item.rating}/5</span>
                              <span className="text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="mt-2 text-sm text-gray-600">
                              {item.comment || 'No comment provided.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" className="mt-6">
            <ProvidersSettingsPanel />
          </TabsContent>

          {/* Connectors Tab */}
          <TabsContent value="connectors" className="mt-6">
            <ConnectorsSettingsPanel />
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Services Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.health?.services?.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {service.status === 'up' ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className="font-medium">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {service.latency && (
                            <Badge variant="outline">{service.latency}ms</Badge>
                          )}
                          <Badge 
                            variant={service.status === 'up' ? 'default' : 'destructive'}
                            className={service.status === 'up' ? 'bg-green-100 text-green-700' : ''}
                          >
                            {service.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Cache Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats?.cache?.totalEntries || 0}</p>
                      <p className="text-xs text-gray-500">Cached Items</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{Math.round((stats?.cache?.hitRate || 0) * 100)}%</p>
                      <p className="text-xs text-gray-500">Hit Rate</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">{stats?.cache?.memoryUsageMB?.toFixed(2) || 0}</p>
                      <p className="text-xs text-gray-500">Memory (MB)</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={clearCache}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Cache
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={fetchStats}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Stats
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DocumentUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadComplete={handleUploadComplete}
      />

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title || 'Document preview'}</DialogTitle>
            <DialogDescription>
              {selectedDocument
                ? `${selectedDocument.category || 'Uncategorized'} • ${selectedDocument.audience}`
                : 'Loading document content from the knowledge base.'}
            </DialogDescription>
          </DialogHeader>
          {isDocumentLoading ? (
            <div className="py-8 text-sm text-gray-500">Loading document...</div>
          ) : selectedDocument ? (
            <ScrollArea className="max-h-[60vh] rounded-lg border p-4">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {selectedDocument.year && <Badge variant="outline">{selectedDocument.year}</Badge>}
                  {selectedDocument.fileType && <Badge variant="outline">{selectedDocument.fileType}</Badge>}
                  {selectedDocument.source && <Badge variant="outline">{selectedDocument.source}</Badge>}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {selectedDocument.content}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-sm text-gray-500">No document selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Stats Card Component
function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color 
}: { 
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'purple' | 'amber'
}) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <span className={colorClasses[color]}>{icon}</span>
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold', colorClasses[color])}>{value}</p>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

// Health Item Component
function HealthItem({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="text-gray-500">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  )
}
