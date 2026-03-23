'use client'
// =====================================================
// EPA Punjab EnvironmentGPT - Providers Settings Panel
// Admin UI for managing LLM providers
// =====================================================

import React, { useState, useEffect } from 'react'
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
  apiKeyEnvVar?: string
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
  { value: 'primary', label: 'Primary', description: 'Main LLM provider' },
  { value: 'fallback_1', label: 'Fallback 1', description: 'First backup' },
  { value: 'fallback_2', label: 'Fallback 2', description: 'Second backup' },
  { value: 'available', label: 'Available', description: 'Can be used but not in fallback chain' }
]

const PROVIDER_TYPES = [
  { value: 'openai_compat', label: 'OpenAI Compatible (vLLM, DeepSeek, etc.)' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'azure', label: 'Azure OpenAI' }
]

export function ProvidersSettingsPanel() {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ProviderStats | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    providerType: 'openai_compat',
    baseUrl: '',
    apiKeyEnvVar: '',
    modelId: '',
    role: 'available',
    priority: 100
  })

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/providers')
      const data = await response.json()
      if (data.success) {
        setProviders(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
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
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(() => {
    fetchProviders()
    fetchStats()
  }, [])

  const handleHealthCheck = async () => {
    try {
      await fetch('/api/admin/providers?action=health')
      fetchProviders()
      fetchStats()
    } catch (error) {
      console.error('Health check failed:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      const url = '/api/admin/providers'
      const method = editingProvider ? 'PUT' : 'POST'
      const body = editingProvider
        ? { id: editingProvider.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        setEditingProvider(null)
        resetForm()
        fetchProviders()
      }
    } catch (error) {
      console.error('Failed to save provider:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return

    try {
      const response = await fetch(`/api/admin/providers?id=${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        fetchProviders()
      }
    } catch (error) {
      console.error('Failed to delete provider:', error)
    }
  }

  const handleToggleActive = async (provider: LLMProvider) => {
    try {
      await fetch('/api/admin/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, isActive: !provider.isActive })
      })
      fetchProviders()
    } catch (error) {
      console.error('Failed to toggle provider:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      providerType: 'openai_compat',
      baseUrl: '',
      apiKeyEnvVar: '',
      modelId: '',
      role: 'available',
      priority: 100
    })
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
      priority: provider.priority
    })
    setDialogOpen(true)
  }

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>
      case 'unhealthy':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Unhealthy</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'primary':
        return <Badge className="bg-blue-100 text-blue-800"><Zap className="w-3 h-3 mr-1" />Primary</Badge>
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <p className="text-2xl font-bold text-green-600">{stats?.activeProviders || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
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

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">LLM Providers</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchProviders(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleHealthCheck}>
            <Activity className="w-4 h-4 mr-2" />
            Health Check
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingProvider(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
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
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!!editingProvider}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="OpenAI GPT-4"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="providerType">Provider Type</Label>
                  <Select value={formData.providerType} onValueChange={(v) => setFormData({ ...formData, providerType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.openai.com/v1"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The base URL for the API. For Ollama, use http://localhost:11434/v1
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelId">Model ID</Label>
                    <Input
                      id="modelId"
                      placeholder="gpt-4o"
                      value={formData.modelId}
                      onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyEnvVar">API Key Env Variable</Label>
                    <Input
                      id="apiKeyEnvVar"
                      placeholder="OPENAI_API_KEY"
                      value={formData.apiKeyEnvVar}
                      onChange={(e) => setFormData({ ...formData, apiKeyEnvVar: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Optional for local providers</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
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
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                    />
                    <p className="text-xs text-muted-foreground">Lower = higher priority</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>
                  {editingProvider ? 'Update' : 'Add'} Provider
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Providers Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading providers...</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No providers configured. Add one to get started.
            </div>
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
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{provider.displayName}</p>
                          <p className="text-xs text-muted-foreground">{provider.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{provider.modelId}</code>
                    </TableCell>
                    <TableCell>{getRoleBadge(provider.role)}</TableCell>
                    <TableCell>{getHealthBadge(provider.healthStatus)}</TableCell>
                    <TableCell>
                      {provider.hasApiKey ? (
                        <Badge className="bg-green-100 text-green-800">Configured</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>{provider.requestCount}</TableCell>
                    <TableCell>
                      {provider.avgLatencyMs ? `${Math.round(provider.avgLatencyMs)}ms` : '-'}
                    </TableCell>
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

      {/* Fallback Chain Info */}
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
            <span>→</span>
            <Badge className="bg-yellow-100 text-yellow-800">Fallback 1</Badge>
            <span>→</span>
            <Badge className="bg-orange-100 text-orange-800">Fallback 2</Badge>
            <span>→</span>
            <Badge className="bg-gray-100 text-gray-800">Available</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
