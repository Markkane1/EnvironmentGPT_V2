'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  Activity,
  Database,
  Cloud,
  Wind,
  Droplets,
  TestTube,
  XCircle
} from 'lucide-react'
import { getApiErrorMessage } from '@/lib/api-errors'
import { toast } from '@/hooks/use-toast'

interface DataConnector {
  id: string
  name: string
  displayName: string
  connectorType: string
  endpointUrl: string
  injectAs: string
  isActive: boolean
  cacheEnabled: boolean
  lastFetchedAt: string | null
  lastFetchStatus: string | null
  requestCount: number
  errorCount: number
  topicMappings: Array<{ topic: string; priority: number }>
  hasApiKey: boolean
}

interface ConnectorStats {
  totalConnectors: number
  activeConnectors: number
  connectorsByType: Record<string, number>
  totalRequests: number
  totalErrors: number
}

const getDefaultFormData = () => ({
  name: '',
  displayName: '',
  connectorType: 'aqi',
  endpointUrl: '',
  apiKeyEnvVar: '',
  authMethod: 'none',
  requestMethod: 'GET',
  responseMapping: '',
  injectAs: 'system_context',
  injectionTemplate: '',
  cacheEnabled: true,
  cacheTtlSec: 300,
  topics: [{ topic: 'air_quality', priority: 100 }]
})

function normalizeOptionalString(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const CONNECTOR_TYPES = [
  { value: 'aqi', label: 'Air Quality Index (AQI)', icon: Wind },
  { value: 'weather', label: 'Weather Data', icon: Cloud },
  { value: 'water_quality', label: 'Water Quality', icon: Droplets },
  { value: 'custom_api', label: 'Custom API', icon: Database }
]

const INJECTION_METHODS = [
  { value: 'system_context', label: 'System Context' },
  { value: 'user_context', label: 'User Context' },
  { value: 'post_retrieval', label: 'Post-Retrieval' }
]

const TOPIC_OPTIONS = [
  { value: 'air_quality', label: 'Air Quality' },
  { value: 'water', label: 'Water Resources' },
  { value: 'climate', label: 'Climate' },
  { value: 'waste', label: 'Waste Management' },
  { value: 'biodiversity', label: 'Biodiversity' },
  { value: 'policy', label: 'Policy & Regulation' },
  { value: 'all', label: 'All Topics' }
]

export function ConnectorsSettingsPanel() {
  const [connectors, setConnectors] = useState<DataConnector[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ConnectorStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<DataConnector | null>(null)
  const [testingConnector, setTestingConnector] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testDetailResult, setTestDetailResult] = useState<{
    connectorName: string
    success: boolean
    data?: Record<string, unknown>
    error?: string
    latencyMs: number
  } | null>(null)
  const [formData, setFormData] = useState(getDefaultFormData())

  const fetchConnectors = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/connectors')
      const data = await response.json()
      if (data.success) {
        setConnectors(data.connectors)
        setError(null)
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to load connectors'))
      }
    } catch (error) {
      console.error('Failed to fetch connectors:', error)
      setError('Failed to load connectors')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/connectors?action=stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to load connector statistics'))
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setError('Failed to load connector statistics')
    }
  }

  useEffect(() => {
    fetchConnectors()
    fetchStats()
  }, [])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([fetchConnectors(), fetchStats()])
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTest = async (connector: DataConnector) => {
    setTestingConnector(connector.id)
    try {
      const response = await fetch(`/api/admin/connectors?action=test&id=${connector.id}`)
      const data = await response.json()
      setError(null)
      setTestDetailResult({
        connectorName: connector.displayName || connector.name,
        success: !!data.result?.success,
        data: data.result?.data as Record<string, unknown> | undefined,
        error: data.result?.error || data.error,
        latencyMs: typeof data.result?.latencyMs === 'number' ? data.result.latencyMs : 0
      })
    } catch (error) {
      console.error('Test failed:', error)
      setError('Failed to test connector')
      setTestDetailResult({
        connectorName: connector.displayName || connector.name,
        success: false,
        error: 'Connector test failed',
        latencyMs: 0
      })
    } finally {
      setTestingConnector(null)
    }
  }

  const handleClearCache = async () => {
    setIsClearingCache(true)
    try {
      await fetch('/api/admin/connectors?action=clear-cache')
      setError(null)
      toast({
        title: 'Cache cleared',
        description: 'Connector cache was cleared successfully.'
      })
    } catch (error) {
      console.error('Failed to clear cache:', error)
      setError('Failed to clear connector cache')
    } finally {
      setIsClearingCache(false)
    }
  }

  const handleSubmit = async () => {
    if (isSaving) {
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        apiKeyEnvVar: normalizeOptionalString(formData.apiKeyEnvVar),
        responseMapping: normalizeOptionalString(formData.responseMapping),
        injectionTemplate: normalizeOptionalString(formData.injectionTemplate),
      }

      const response = await fetch('/api/admin/connectors', {
        method: editingConnector ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConnector ? { id: editingConnector.id, ...payload } : payload)
      })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        setEditingConnector(null)
        setFormData(getDefaultFormData())
        setError(null)
        await Promise.all([fetchConnectors(), fetchStats()])
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to save connector'))
      }
    } catch (error) {
      console.error('Failed to save connector:', error)
      setError('Failed to save connector')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connector?')) return

    try {
      const response = await fetch(`/api/admin/connectors?id=${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        setError(null)
        fetchConnectors()
        fetchStats()
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to delete connector'))
      }
    } catch (error) {
      console.error('Failed to delete connector:', error)
      setError('Failed to delete connector')
    }
  }

  const handleToggleActive = async (connector: DataConnector) => {
    try {
      await fetch('/api/admin/connectors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: connector.id, isActive: !connector.isActive })
      })
      setError(null)
      fetchConnectors()
      fetchStats()
    } catch (error) {
      console.error('Failed to toggle connector:', error)
      setError('Failed to update connector status')
    }
  }

  const resetForm = () => {
    setFormData(getDefaultFormData())
  }

  const openEditDialog = (connector: DataConnector) => {
    setEditingConnector(connector)
    setFormData({
      name: connector.name,
      displayName: connector.displayName,
      connectorType: connector.connectorType,
      endpointUrl: connector.endpointUrl,
      apiKeyEnvVar: '',
      authMethod: 'none',
      requestMethod: 'GET',
      responseMapping: '',
      injectAs: connector.injectAs,
      injectionTemplate: '',
      cacheEnabled: connector.cacheEnabled,
      cacheTtlSec: 300,
      topics: connector.topicMappings.map((mapping) => ({ topic: mapping.topic, priority: mapping.priority }))
    })
    setDialogOpen(true)
  }

  const prefillAQIExample = () => {
    setFormData({
      ...getDefaultFormData(),
      name: 'punjab-aqi-live',
      displayName: 'Punjab AQI - Live Data',
      connectorType: 'aqi',
      endpointUrl: 'https://api.waqi.info/feed/lahore/?token={api_key}',
      apiKeyEnvVar: 'WAQI_API_KEY',
      authMethod: 'api_key',
      requestMethod: 'GET',
      responseMapping: 'data',
      injectAs: 'system_context',
      injectionTemplate: 'LIVE DATA - Current Lahore AQI: {{aqi}}. Dominant pollutant: {{dominentpol}}. Source: World Air Quality Index API, refreshed every 5 minutes. Use this for current air quality questions.',
      cacheTtlSec: 300,
      cacheEnabled: true,
      topics: [{ topic: 'air_quality', priority: 100 }]
    })
  }

  const getConnectorIcon = (type: string) => {
    const found = CONNECTOR_TYPES.find((connectorType) => connectorType.value === type)
    const Icon = found?.icon || Database
    return <Icon className="h-4 w-4" />
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline"><CheckCircle className="mr-1 h-3 w-3" />Success</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="mr-1 h-3 w-3" />Error</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Not Tested</Badge>
    }
  }

  const addTopicMapping = () => {
    setFormData({
      ...formData,
      topics: [...formData.topics, { topic: 'all', priority: 100 }]
    })
  }

  const removeTopicMapping = (index: number) => {
    setFormData({
      ...formData,
      topics: formData.topics.filter((_, topicIndex) => topicIndex !== index)
    })
  }

  const updateTopicMapping = (index: number, field: 'topic' | 'priority', value: string | number) => {
    const nextTopics = [...formData.topics]
    nextTopics[index] = { ...nextTopics[index], [field]: value }
    setFormData({ ...formData, topics: nextTopics })
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Connectors</p>
                <p className="text-2xl font-bold">{stats?.totalConnectors || 0}</p>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-teal-700">{stats?.activeConnectors || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AQI Connectors</p>
                <p className="text-2xl font-bold">{stats?.connectorsByType?.aqi || 0}</p>
              </div>
              <Wind className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats?.totalRequests || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Data Connectors</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={isRefreshing || isClearingCache}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleClearCache} disabled={isClearingCache || isRefreshing}>
            {isClearingCache ? 'Clearing...' : 'Clear Cache'}
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingConnector(null)
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Connector
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingConnector ? 'Edit Connector' : 'Add New Data Connector'}</DialogTitle>
                <DialogDescription>
                  Configure a data source to enrich RAG context with live data.
                </DialogDescription>
              </DialogHeader>
              {!editingConnector && (
                <Button variant="outline" size="sm" onClick={prefillAQIExample} className="mb-2">
                  <Wind className="mr-2 h-4 w-4" />
                  Pre-fill Punjab AQI Example
                </Button>
              )}
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name (Unique ID)</Label>
                    <Input
                      id="name"
                      placeholder="punjab_aqi"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      disabled={!!editingConnector}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Punjab AQI"
                      value={formData.displayName}
                      onChange={(event) => setFormData({ ...formData, displayName: event.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connectorType">Connector Type</Label>
                  <Select value={formData.connectorType} onValueChange={(value) => setFormData({ ...formData, connectorType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONNECTOR_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpointUrl">Endpoint URL</Label>
                  <Input
                    id="endpointUrl"
                    placeholder="https://api.waqi.info/feed/lahore/?token={api_key}"
                    value={formData.endpointUrl}
                    onChange={(event) => setFormData({ ...formData, endpointUrl: event.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyEnvVar">API Key Env Variable (Optional)</Label>
                    <Input
                      id="apiKeyEnvVar"
                      placeholder="WAQI_API_KEY"
                      value={formData.apiKeyEnvVar}
                      onChange={(event) => setFormData({ ...formData, apiKeyEnvVar: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="injectAs">Injection Method</Label>
                    <Select value={formData.injectAs} onValueChange={(value) => setFormData({ ...formData, injectAs: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INJECTION_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Topic Mappings</Label>
                  <p className="text-xs text-muted-foreground">Only activate this connector for specific query topics.</p>
                  {formData.topics.map((mapping, index) => (
                    <div key={`${mapping.topic}-${index}`} className="flex items-center gap-2">
                      <Select value={mapping.topic} onValueChange={(value) => updateTopicMapping(index, 'topic', value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOPIC_OPTIONS.map((topic) => (
                            <SelectItem key={topic.value} value={topic.value}>{topic.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-24"
                        value={mapping.priority}
                        onChange={(event) => updateTopicMapping(index, 'priority', parseInt(event.target.value, 10) || 100)}
                      />
                      {formData.topics.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeTopicMapping(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTopicMapping}>
                    <Plus className="mr-1 h-4 w-4" /> Add Topic
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.cacheEnabled} onCheckedChange={(value) => setFormData({ ...formData, cacheEnabled: value })} />
                    <Label>Enable Caching</Label>
                  </div>
                  {formData.cacheEnabled && (
                    <div className="flex items-center gap-2">
                      <Label>Cache TTL (sec)</Label>
                      <Input
                        type="number"
                        className="w-24"
                        value={formData.cacheTtlSec}
                        onChange={(event) => setFormData({ ...formData, cacheTtlSec: parseInt(event.target.value, 10) || 300 })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? 'Saving...' : `${editingConnector ? 'Update' : 'Add'} Connector`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!testDetailResult} onOpenChange={() => setTestDetailResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Test Result: {testDetailResult?.connectorName}</DialogTitle>
            <DialogDescription>
              {testDetailResult?.success ? 'Connector responded successfully' : 'Connector test failed'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {testDetailResult?.success ? (
                <CheckCircle className="h-5 w-5 text-teal-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">{testDetailResult?.success ? 'Success' : 'Failed'}</span>
              <Badge variant="outline">{testDetailResult?.latencyMs}ms</Badge>
            </div>

            {testDetailResult?.error && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-800">
                {testDetailResult.error}
              </div>
            )}

            {testDetailResult?.data && (
              <div>
                <Label className="text-xs text-muted-foreground">Raw API Response</Label>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(testDetailResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading connectors...</div>
          ) : connectors.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No connectors configured. Add one to enrich your RAG context with live data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Injection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getConnectorIcon(connector.connectorType)}
                        <div>
                          <p className="font-medium">{connector.displayName}</p>
                          <p className="text-xs text-muted-foreground">{connector.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{connector.connectorType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {connector.topicMappings.map((mapping, index) => (
                          <Badge key={`${mapping.topic}-${index}`} className="text-xs">{mapping.topic}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">{connector.injectAs}</code>
                    </TableCell>
                    <TableCell>{getStatusBadge(connector.lastFetchStatus)}</TableCell>
                    <TableCell>
                      {connector.cacheEnabled ? (
                        <Badge className="bg-blue-100 text-blue-800">Enabled</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>{connector.requestCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={connector.isActive}
                          onCheckedChange={() => handleToggleActive(connector)}
                          aria-label={`Toggle ${connector.displayName}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTest(connector)}
                          disabled={testingConnector === connector.id}
                          aria-label={`Test ${connector.displayName}`}
                        >
                          {testingConnector === connector.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(connector)}
                          aria-label={`Edit ${connector.displayName}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(connector.id)}
                          aria-label={`Delete ${connector.displayName}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Context Injection Methods</CardTitle>
          <CardDescription>
            Live data is injected into the RAG pipeline based on the configured method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded border p-3">
              <p className="font-medium">System Context</p>
              <p className="text-xs text-muted-foreground">Prepend to system prompt. Best for global context like current AQI.</p>
            </div>
            <div className="rounded border p-3">
              <p className="font-medium">User Context</p>
              <p className="text-xs text-muted-foreground">Append to user query. Good for query-specific enrichment.</p>
            </div>
            <div className="rounded border p-3">
              <p className="font-medium">Post-Retrieval</p>
              <p className="text-xs text-muted-foreground">After document search. Useful for comparing live vs historical data.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
