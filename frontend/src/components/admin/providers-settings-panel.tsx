// frontend/src/components/admin/providers-settings-panel.tsx
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
  Zap,
  Activity,
  Server
} from 'lucide-react'
import { getApiErrorMessage } from '@/lib/api-errors'

interface LLMProvider {
  id: string
  name: string
  displayName: string
  providerType: string
  baseUrl: string
  modelId: string
  role: string
  priority: number
  isActive: boolean
  healthStatus: string
  requestCount: number
  errorCount: number
  avgLatencyMs: number | null
  hasApiKey: boolean
  apiKeyEnvVar?: string | null
  timeoutSeconds?: number
  maxTokens?: number
  temperature?: number
  notes?: string | null
}

interface ProviderStats {
  totalProviders: number
  activeProviders: number
  healthyProviders: number
  primaryProvider: string | null
  totalRequests: number
  totalErrors: number
}

const ROLE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'fallback_1', label: 'Fallback 1' },
  { value: 'fallback_2', label: 'Fallback 2' },
  { value: 'available', label: 'Available' }
]

const PROVIDER_TYPES = [
  { value: 'openai_compat', label: 'OpenAI Compatible (vLLM, DeepSeek, etc.)' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'azure', label: 'Azure OpenAI' }
]

const defaultFormData = {
  name: '',
  displayName: '',
  providerType: 'openai_compat',
  baseUrl: '',
  apiKeyEnvVar: '',
  modelId: '',
  role: 'available',
  priority: 100,
  timeoutSeconds: 120,
  maxTokens: 1024,
  temperature: 0.1,
  notes: ''
}

function normalizeOptionalString(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function ProvidersSettingsPanel() {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ProviderStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, {
    success: boolean
    latencyMs: number
    error: string | null
  }>>({})
  const [formData, setFormData] = useState(defaultFormData)

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/providers')
      const data = await response.json()
      if (data.success) {
        setProviders(data.providers)
        setError(null)
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to load providers'))
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      setError('Failed to load providers')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/providers?action=stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to load provider statistics'))
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setError('Failed to load provider statistics')
    }
  }

  useEffect(() => {
    fetchProviders()
    fetchStats()
  }, [])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([fetchProviders(), fetchStats()])
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTestProvider = async (id: string) => {
    setTestingId(id)
    try {
      const response = await fetch(`/api/admin/providers?action=test&id=${id}`)
      const data = await response.json()
      if (data.success && data.result) {
        setTestResults((current) => ({ ...current, [id]: data.result }))
      }
    } catch {
      setTestResults((current) => ({
        ...current,
        [id]: {
          success: false,
          latencyMs: 0,
          error: 'Network error'
        }
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleHealthCheck = async () => {
    setIsRunningHealthCheck(true)
    try {
      await fetch('/api/admin/providers?action=health')
      setError(null)
      await Promise.all([fetchProviders(), fetchStats()])
    } catch (error) {
      console.error('Health check failed:', error)
      setError('Failed to run provider health check')
    } finally {
      setIsRunningHealthCheck(false)
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
        notes: normalizeOptionalString(formData.notes),
      }

      const response = await fetch('/api/admin/providers', {
        method: editingProvider ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProvider ? { id: editingProvider.id, ...payload } : payload)
      })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        setEditingProvider(null)
        setFormData(defaultFormData)
        setError(null)
        await Promise.all([fetchProviders(), fetchStats()])
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to save provider'))
      }
    } catch (error) {
      console.error('Failed to save provider:', error)
      setError('Failed to save provider')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return

    try {
      const response = await fetch(`/api/admin/providers?id=${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        setError(null)
        fetchProviders()
        fetchStats()
      } else {
        setError(getApiErrorMessage(data.error, 'Failed to delete provider'))
      }
    } catch (error) {
      console.error('Failed to delete provider:', error)
      setError('Failed to delete provider')
    }
  }

  const handleToggleActive = async (provider: LLMProvider) => {
    try {
      await fetch('/api/admin/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, isActive: !provider.isActive })
      })
      setError(null)
      fetchProviders()
      fetchStats()
    } catch (error) {
      console.error('Failed to toggle provider:', error)
      setError('Failed to update provider status')
    }
  }

  const resetForm = () => {
    setFormData(defaultFormData)
  }

  const openEditDialog = (provider: LLMProvider) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      displayName: provider.displayName,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKeyEnvVar: provider.apiKeyEnvVar || '',
      modelId: provider.modelId,
      role: provider.role,
      priority: provider.priority,
      timeoutSeconds: provider.timeoutSeconds || 120,
      maxTokens: provider.maxTokens || 1024,
      temperature: provider.temperature || 0.1,
      notes: provider.notes || ''
    })
    setDialogOpen(true)
  }

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline"><CheckCircle className="mr-1 h-3 w-3" />Healthy</Badge>
      case 'unhealthy':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="mr-1 h-3 w-3" />Unhealthy</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'primary':
        return <Badge className="bg-blue-100 text-blue-800"><Zap className="mr-1 h-3 w-3" />Primary</Badge>
      case 'fallback_1':
        return <Badge className="bg-yellow-100 text-yellow-800">Fallback 1</Badge>
      case 'fallback_2':
        return <Badge className="bg-orange-100 text-orange-800">Fallback 2</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Available</Badge>
    }
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
                <p className="text-sm text-muted-foreground">Total Providers</p>
                <p className="text-2xl font-bold">{stats?.totalProviders || 0}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-teal-700">{stats?.activeProviders || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-teal-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold">{stats?.healthyProviders || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
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
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">LLM Providers</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={isRefreshing || isRunningHealthCheck}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleHealthCheck} disabled={isRunningHealthCheck || isRefreshing}>
            <Activity className={`mr-2 h-4 w-4 ${isRunningHealthCheck ? 'animate-spin' : ''}`} />
            {isRunningHealthCheck ? 'Checking...' : 'Health Check'}
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingProvider(null)
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add New LLM Provider'}</DialogTitle>
                <DialogDescription>
                  Configure an OpenAI-compatible LLM provider. All providers use the same /v1/chat/completions interface.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name (Unique ID)</Label>
                    <Input
                      id="name"
                      placeholder="openai"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      disabled={!!editingProvider}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="OpenAI GPT-4"
                      value={formData.displayName}
                      onChange={(event) => setFormData({ ...formData, displayName: event.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="providerType">Provider Type</Label>
                  <Select value={formData.providerType} onValueChange={(value) => setFormData({ ...formData, providerType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.openai.com"
                    value={formData.baseUrl}
                    onChange={(event) => setFormData({ ...formData, baseUrl: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    For Ollama, use http://localhost:11434/v1. Dockerized vLLM uses http://vllm:8000.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelId">Model ID</Label>
                    <Input
                      id="modelId"
                      placeholder="qwen3-30b-a3b"
                      value={formData.modelId}
                      onChange={(event) => setFormData({ ...formData, modelId: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyEnvVar">API Key Env Variable</Label>
                    <Input
                      id="apiKeyEnvVar"
                      placeholder="VLLM_API_KEY"
                      value={formData.apiKeyEnvVar}
                      onChange={(event) => setFormData({ ...formData, apiKeyEnvVar: event.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Optional for local providers</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(event) => setFormData({ ...formData, priority: parseInt(event.target.value, 10) || 100 })}
                    />
                    <p className="text-xs text-muted-foreground">Lower numbers are preferred first.</p>
                  </div>
                </div>

                <div className="border-t pt-4 mt-2">
                  <p className="mb-3 text-sm font-medium">Advanced Settings</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timeoutSeconds">Timeout (seconds)</Label>
                      <Input
                        id="timeoutSeconds"
                        type="number"
                        min={1}
                        max={3600}
                        value={formData.timeoutSeconds}
                        onChange={(event) => setFormData({
                          ...formData,
                          timeoutSeconds: parseInt(event.target.value, 10) || 120
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">Max Tokens</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        min={1}
                        max={32768}
                        value={formData.maxTokens}
                        onChange={(event) => setFormData({
                          ...formData,
                          maxTokens: parseInt(event.target.value, 10) || 1024
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature</Label>
                      <Input
                        id="temperature"
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={formData.temperature}
                        onChange={(event) => setFormData({
                          ...formData,
                          temperature: parseFloat(event.target.value) || 0.1
                        })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      placeholder="Optional admin notes about this provider"
                      value={formData.notes}
                      onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? 'Saving...' : `${editingProvider ? 'Update' : 'Add'} Provider`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading providers...</div>
          ) : providers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No providers configured. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Avg Latency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{provider.displayName}</p>
                        <p className="text-xs text-muted-foreground">{provider.name}</p>
                        {testResults[provider.id] && (
                          <p className="mt-1 text-xs">
                            {testResults[provider.id].success ? (
                              <span className="text-teal-700">
                                Test passed — {testResults[provider.id].latencyMs}ms
                              </span>
                            ) : (
                              <span className="text-red-600">
                                {testResults[provider.id].error || 'Test failed'}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">{provider.modelId}</code>
                    </TableCell>
                    <TableCell>{getRoleBadge(provider.role)}</TableCell>
                    <TableCell>{getHealthBadge(provider.healthStatus)}</TableCell>
                    <TableCell>
                      {provider.hasApiKey ? (
                        <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline">Configured</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>{provider.requestCount}</TableCell>
                    <TableCell>{provider.avgLatencyMs ? `${Math.round(provider.avgLatencyMs)}ms` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={() => handleToggleActive(provider)}
                          aria-label={`Toggle ${provider.displayName}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestProvider(provider.id)}
                          disabled={testingId === provider.id}
                          title="Send test message to this provider"
                          aria-label={`Test ${provider.displayName}`}
                        >
                          {testingId === provider.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 text-amber-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(provider)}
                          aria-label={`Edit ${provider.displayName}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(provider.id)}
                          aria-label={`Delete ${provider.displayName}`}
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
          <CardTitle className="text-sm">Automatic Fallback Chain</CardTitle>
          <CardDescription>
            When the primary provider fails, the system automatically tries fallback providers in order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-blue-100 text-blue-800">Primary</Badge>
            <span>{'->'}</span>
            <Badge className="bg-yellow-100 text-yellow-800">Fallback 1</Badge>
            <span>{'->'}</span>
            <Badge className="bg-orange-100 text-orange-800">Fallback 2</Badge>
            <span>{'->'}</span>
            <Badge className="bg-gray-100 text-gray-800">Available</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
