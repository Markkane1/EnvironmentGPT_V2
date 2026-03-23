'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Activity,
  Clock,
  ThumbsUp,
  AlertCircle,
  Database
} from 'lucide-react'

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
  }
  documents: {
    total: number
    byCategory: Record<string, number>
    byYear: Record<number, number>
  }
  feedback: {
    total: number
    avgRating: number
    ratingDistribution: Record<number, number>
    positiveRate: number
  }
  health: {
    status: string
    uptime: number
    services: Array<{ name: string; status: string; latency?: number }>
  }
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const [overviewRes, chatRes, docsRes, feedbackRes, healthRes] = await Promise.all([
        fetch('/api/stats?type=overview'),
        fetch('/api/stats?type=chat'),
        fetch('/api/stats?type=documents'),
        fetch('/api/stats?type=feedback'),
        fetch('/api/stats?type=health')
      ])

      const [overview, chat, documents, feedback, health] = await Promise.all([
        overviewRes.json(),
        chatRes.json(),
        docsRes.json(),
        feedbackRes.json(),
        healthRes.json()
      ])

      setStats({
        overview: overview.statistics || {},
        chat: chat.statistics || {},
        documents: documents.statistics || {},
        feedback: feedback.statistics || {},
        health: health.health || {}
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
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
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">System overview and analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge 
            variant={stats?.health?.status === 'healthy' ? 'default' : 'destructive'}
            className="bg-green-100 text-green-700"
          >
            <Activity className="w-3 h-3 mr-1" />
            {stats?.health?.status || 'Unknown'}
          </Badge>
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {stats?.overview?.documents || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.documents?.total || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat Sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {stats?.overview?.sessions || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.chat?.sessionsToday || 0} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">
              {stats?.chat?.totalQueries || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.chat?.sessionsWeek || 0} sessions this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4" />
              Avg Rating
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">
              {stats?.feedback?.avgRating?.toFixed(1) || '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.feedback?.positiveRate || 0}% positive
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Categories */}
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

        {/* Feedback Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Feedback Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.feedback?.ratingDistribution ? (
                Object.entries(stats.feedback.ratingDistribution)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([rating, count]) => (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-20">
                        <span className="text-sm font-medium">{rating}</span>
                        <ThumbsUp className={`w-4 h-4 ${
                          Number(rating) >= 4 ? 'text-green-500' : 
                          Number(rating) >= 3 ? 'text-yellow-500' : 'text-red-500'
                        }`} />
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            Number(rating) >= 4 ? 'bg-green-500' : 
                            Number(rating) >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${(count / (stats.feedback.total || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                    </div>
                  ))
              ) : (
                <p className="text-gray-500 text-center py-4">No feedback yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Uptime</p>
                <p className="font-medium">{formatUptime(stats?.health?.uptime || 0)}</p>
              </div>
            </div>
            
            {stats?.health?.services?.map((service, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {service.status === 'up' ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm text-gray-500">{service.name}</p>
                  <p className="font-medium capitalize">{service.status}</p>
                  {service.latency && (
                    <p className="text-xs text-gray-400">{service.latency}ms</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
