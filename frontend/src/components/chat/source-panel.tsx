'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  X, 
  ExternalLink, 
  FileText, 
  Calendar,
  Quote,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertCircle
} from 'lucide-react'
import { SourceReference } from '@/types'
import { cn } from '@/lib/utils'

interface SourcePanelProps {
  sources: SourceReference[]
  confidence?: number
  onClose?: () => void
  onSelectSource?: (source: SourceReference) => void
}

export function SourcePanel({ 
  sources, 
  confidence = 0, 
  onClose, 
  onSelectSource 
}: SourcePanelProps) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null)

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-teal-700 bg-teal-50 border-teal-200'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return 'High confidence'
    if (score >= 0.6) return 'Medium confidence'
    return 'Low confidence'
  }

  if (sources.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Sources</h3>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sources panel">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No sources available</p>
            <p className="text-xs mt-1">Sources will appear when documents are referenced</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Sources</h3>
            <p className="text-xs text-gray-500 mt-1">
              {sources.length} document{sources.length !== 1 ? 's' : ''} referenced
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sources panel">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* Confidence indicator */}
        <div className={cn(
          'mt-3 px-3 py-2 rounded-md border text-sm flex items-center gap-2',
          getConfidenceColor(confidence)
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full',
            confidence >= 0.8 ? 'bg-teal-500' :
            confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
          )} />
          <span className="font-medium">{getConfidenceLabel(confidence)}</span>
          <span className="ml-auto text-xs opacity-75">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Sources list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sources.map((source, index) => (
            <Card 
              key={source.id || index}
              className={cn(
                'cursor-pointer transition-all',
                expandedSource === source.id
                  ? 'ring-2 ring-teal-500'
                  : 'hover:shadow-md'
              )}
              onClick={() => setExpandedSource(
                expandedSource === source.id ? null : source.id
              )}
            >
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {source.title}
                      </CardTitle>
                      {source.category && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {source.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge 
                      variant="secondary"
                      className="text-xs font-mono"
                    >
                      {Math.round((source.relevanceScore || 0) * 100)}% match
                    </Badge>
                    {expandedSource === source.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {expandedSource === source.id && (
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Excerpt */}
                  {source.excerpt && (
                    <div className="bg-gray-50 rounded-md p-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Quote className="w-3 h-3" />
                        Excerpt
                      </div>
                      <p className="text-sm text-gray-700 italic">
                        &ldquo;{source.excerpt}&rdquo;
                      </p>
                    </div>
                  )}
                  
                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {source.year && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {source.year}
                      </span>
                    )}
                    {source.source && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {source.source}
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectSource?.(source)
                      }}
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      View Document
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Copy citation
                        navigator.clipboard.writeText(source.title)
                      }}
                    >
                      Copy Citation
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
      
      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
        Sources are ranked by relevance to your query
      </div>
    </div>
  )
}
