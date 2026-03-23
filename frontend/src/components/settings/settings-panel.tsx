'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Settings, 
  Moon, 
  Sun, 
  Download, 
  Trash2, 
  Database,
  Check
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { AppSettings, defaultAppSettings, useAppSettingsStore } from '@/lib/app-settings'

export function SettingsPanel() {
  const persistedSettings = useAppSettingsStore((state) => state.settings)
  const setPersistedSettings = useAppSettingsStore((state) => state.setSettings)
  const resetPersistedSettings = useAppSettingsStore((state) => state.resetSettings)
  const [settings, setSettings] = useState<AppSettings>(persistedSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(persistedSettings)
  }, [persistedSettings])

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      setPersistedSettings(settings)
      setSaved(true)
      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated.'
      })
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Update setting
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Export data
  const exportData = async () => {
    try {
      const response = await fetch('/api/export?type=stats&format=json')
      if (!response.ok) {
        throw new Error('Failed to export data')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `epa-stats-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Export complete',
        description: 'Your data has been downloaded.'
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not export data',
        variant: 'destructive'
      })
    }
  }

  // Clear all data
  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.removeItem('epa-settings')
      localStorage.removeItem('epa-chat-storage')
      localStorage.removeItem('epa-ui-storage')
      localStorage.removeItem('epa-document-storage')
      resetPersistedSettings()
      setSettings(defaultAppSettings)
      toast({
        title: 'Data cleared',
        description: 'All local data has been removed.'
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-gray-500">Manage your preferences and application settings</p>
        </div>
        <Button 
          onClick={saveSettings} 
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : isSaving ? (
            'Saving...'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {settings.theme === 'dark' ? (
              <Moon className="w-5 h-5 text-blue-600" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how the application looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select 
              value={settings.theme} 
              onValueChange={(val) => updateSetting('theme', val as 'light' | 'dark' | 'system')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Chat Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Chat & History
          </CardTitle>
          <CardDescription>
            Configure behavior that the app applies immediately
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Sources</Label>
              <p className="text-sm text-gray-500">
                Display document sources with AI responses
              </p>
            </div>
            <Switch 
              checked={settings.showSources}
              onCheckedChange={(checked) => updateSetting('showSources', checked)}
            />
          </div>
          
          <Separator />

          <div className="space-y-2">
            <Label>Maximum History Items</Label>
            <Input
              type="number"
              value={settings.maxHistoryItems}
              onChange={(e) => updateSetting('maxHistoryItems', Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
              min={1}
              max={50}
            />
            <p className="text-sm text-gray-500">
              Limits how many recent sessions the sidebar loads and displays.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-red-500" />
            Data Management
          </CardTitle>
          <CardDescription>
            Export or clear your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Export Statistics</Label>
              <p className="text-sm text-gray-500">
                Download your usage statistics as JSON
              </p>
            </div>
            <Button variant="outline" onClick={exportData}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Clear All Data</Label>
              <p className="text-sm text-gray-500">
                Remove all locally stored data
              </p>
            </div>
            <Button variant="destructive" onClick={clearAllData}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Version Info */}
      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>EPA Punjab EnvironmentGPT</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">v2.0.0</Badge>
              <Badge className="bg-green-100 text-green-700">Phase 6-7</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
