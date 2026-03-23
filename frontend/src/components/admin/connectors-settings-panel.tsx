'use client'
// =====================================================
// EPA Punjab EnvironmentGPT - Connectors Settings Panel
// Admin UI for managing data connectors (AQI, weather, etc.)
// =====================================================

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

const CONNECTOR_TYPES = [
  { value: 'aqi', label: 'Air Quality Index (AQI)', icon: Wind },
  { value: 'weather', label: 'Weather Data', icon: Cloud },
  { value: 'water_quality', label: 'Water Quality', icon: Droplets },
  { value: 'custom_api', label: 'Custom API', icon: Database },
]

const INJECTION_METHODS = [
  { value: 'system_context', label: 'System Context', description: 'Prepends to system prompt' },
  { value: 'user_context', label: 'User Context', description: 'Appends to user message' },
  { value: 'post_retrieval', label: 'Post-Retrieval', description: 'After document retrieval' },
]

const TOPIC_OPTIONS = [
  { value: 'air_quality', label: 'Air Quality' },
  { value: 'water', label: 'Water Resources' },
  { value: 'climate', label: 'Climate' },
  { value: 'waste', label: 'Waste Management' },
  { value: 'biodiversity', label: 'Biodiversity' },
  { value: 'policy', label: 'Policy & Regulation' },
  { value: 'all', label: 'All Topics' },
]

export function ConnectorsSettingsPanel() {
  const [connectors, setConnectors] = useState<DataConnector[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<DataConnector | null>(null)
  const [testingConnector, setTestingConnector] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    connectorType: 'aqi',
    endpointUrl: '',
    apiKeyEnvVar: '',
    authMethod: 'none',
    requestMethod: 'GET',
    injectAs: 'system_context',
    cacheEnabled: true,
    cacheTtlSec: 300,
    topics: [{ topic: 'air_quality', priority: 100 }]
  })

  const fetchConnectors = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/connectors')
      const data = await response.json()
      if (data.success) {
        setConnectors(data.connectors)
      }
    } catch (error) {
      console.error('Failed to fetch connectors:', error)
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
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(() => {
    fetchConnectors()
    fetchStats()
  }, [])

  const handleTest = async (id: string) => {
    setTestingConnector(id)
    setTestResult(null)
    try {
      const response = await fetch(`/api/admin/connectors?action=test&id=${id}`)
      const data = await response.json()
      setTestResult(data.result)
    } catch (error) {
      console.error('Test failed:', error)
      setTestResult({ success: false, error: 'Test failed' })
    } finally {
      setTestingConnector(null)
    }
  }

  const handleClearCache = async () => {
    try {
      await fetch('/api/admin/connectors?action=clear-cache')
      alert('Cache cleared successfully')
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      const url = '/api/admin/connectors'
      const method = editingConnector ? 'PUT' : 'POST'
      const body = editingConnector
        ? { id: editingConnector.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        setEditingConnector(null)
        resetForm()
        fetchConnectors()
      }
    } catch (error) {
      console.error('Failed to save connector:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connector?')) return

    try {
      const response = await fetch(`/api/admin/connectors?id=${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        fetchConnectors()
      }
    } catch (error) {
      console.error('Failed to delete connector:', error)
    }
  }

  const handleToggleActive = async (connector: DataConnector) => {
    try {
      await fetch('/api/admin/connectors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: connector.id, isActive: !connector.isActive })
      })
      fetchConnectors()
    } catch (error) {
      console.error('Failed to toggle connector:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      connectorType: 'aqi',
      endpointUrl: '',
      apiKeyEnvVar: '',
      authMethod: 'none',
      requestMethod: 'GET',
      injectAs: 'system_context',
      cacheEnabled: true,
      cacheTtlSec: 300,
      topics: [{ topic: 'air_quality', priority: 100 }]
    })
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
      injectAs: connector.injectAs,
      cacheEnabled: connector.cacheEnabled,
      cacheTtlSec: 300,
      topics: connector.topicMappings.map(t => ({ topic: t.topic, priority: t.priority }))
    })
    setDialogOpen(true)
  }

  const getConnectorIcon = (type: string) => {
    const found = CONNECTOR_TYPES.find(t => t.value === type)
    const Icon = found?.icon || Database
    return <Icon className="h-4 w-4" />
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Error</Badge>
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
      topics: formData.topics.filter((_, i) => i !== index)
    })
  }

  const updateTopicMapping = (index: number, field: 'topic' | 'priority', value: string | number) => {
    const newTopics = [...formData.topics]
    newTopics[index] = { ...newTopics[index], [field]: value }
    setFormData({ ...formData, topics: newTopics })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <p className="text-2xl font-bold text-green-600">{stats?.activeConnectors || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
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

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Data Connectors</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchConnectors(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleClearCache}>
            Clear Cache
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingConnector(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
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
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name (Unique ID)</Label>
                    <Input
                      id="name"
                      placeholder="punjab_aqi"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!!editingConnector}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Punjab AQI"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connectorType">Connector Type</Label>
                  <Select value={formData.connectorType} onValueChange={(v) => setFormData({ ...formData, connectorType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONNECTOR_TYPES.map(type => (
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
                    placeholder="https://api.punjabsafetravel.com/aqi"
                    value={formData.endpointUrl}
                    onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyEnvVar">API Key Env Variable (Optional)</Label>
                    <Input
                      id="apiKeyEnvVar"
                      placeholder="AQI_API_KEY"
                      value={formData.apiKeyEnvVar}
                      onChange={(e) => setFormData({ ...formData, apiKeyEnvVar: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="injectAs">Injection Method</Label>
                    <Select value={formData.injectAs} onValueChange={(v) => setFormData({ ...formData, injectAs: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INJECTION_METHODS.map(method => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Topic Mappings</Label>
                  <p className="text-xs text-muted-foreground">
                    Only activate this connector for specific query topics.
                  </p>
                  {formData.topics.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={mapping.topic}
                        onValueChange={(v) => updateTopicMapping(index, 'topic', v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOPIC_OPTIONS.map(topic => (
                            <SelectItem key={topic.value} value={topic.value}>
                              {topic.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Priority"
                        className="w-24"
                        value={mapping.priority}
                        onChange={(e) => updateTopicMapping(index, 'priority', parseInt(e.target.value) || 100)}
                      />
                      {formData.topics.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeTopicMapping(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTopicMapping}>
                    <Plus className="h-4 w-4 mr-1" /> Add Topic
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.cacheEnabled}
                      onCheckedChange={(v) => setFormData({ ...formData, cacheEnabled: v })}
                    />
                    <Label>Enable Caching</Label>
                  </div>
                  {formData.cacheEnabled && (
                    <div className="flex items-center gap-2">
                      <Label>Cache TTL (sec)</Label>
                      <Input
                        type="number"
                        className="w-24"
                        value={formData.cacheTtlSec}
                        onChange={(e) => setFormData({ ...formData, cacheTtlSec: parseInt(e.target.value) || 300 })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>
                  {editingConnector ? 'Update' : 'Add'} Connector
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Test Result Dialog */}
      {testResult && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Test Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Success</span>
                  <span className="text-muted-foreground">({testResult.latencyMs}ms)</span>
                </div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{testResult.error}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setTestResult(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connectors Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading connectors...</div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
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
                        {connector.topicMappings.map((tm, i) => (
                          <Badge key={i} className="text-xs">
                            {tm.topic}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {connector.injectAs}
                      </code>
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
                          onClick={() => handleTest(connector.id)}
                          disabled={testingConnector === connector.id}
                          aria-label={`Test ${connector.displayName}`}
                        >
                          <TestTube className="h-4 w-4" />
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

      {/* Context Injection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Context Injection Methods</CardTitle>
          <CardDescription>
            Live data is injected into the RAG pipeline based on the configured method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 border rounded">
              <p className="font-medium">System Context</p>
              <p className="text-muted-foreground text-xs">
                Prepend to system prompt. Best for global context like current AQI.
              </p>
            </div>
            <div className="p-3 border rounded">
              <p className="font-medium">User Context</p>
              <p className="text-muted-foreground text-xs">
                Append to user query. Good for query-specific enrichment.
              </p>
            </div>
            <div className="p-3 border rounded">
              <p className="font-medium">Post-Retrieval</p>
              <p className="text-muted-foreground text-xs">
                After document search. Useful for comparing live vs historical data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
