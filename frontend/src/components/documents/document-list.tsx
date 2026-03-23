'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  FileText, 
  Upload, 
  Calendar, 
  Tag,
  MoreVertical,
  Eye,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Document } from '@/types'
import { cn } from '@/lib/utils'

interface DocumentListProps {
  onUploadClick?: () => void
  onSelectDocument?: (doc: Document) => void
}

export function DocumentList({ onUploadClick, onSelectDocument }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalDocs, setTotalDocs] = useState(0)

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set('q', searchQuery)
        params.set('pageSize', '20')
        
        const response = await fetch(`/api/documents?${params}`)
        const data = await response.json()
        
        if (data.success) {
          setDocuments(data.documents || [])
          setTotalDocs(data.total || 0)
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchDocuments()
  }, [searchQuery])

  // Handle document delete
  const handleDelete = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents?id=${docId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setDocuments(docs => docs.filter(d => d.id !== docId))
        setTotalDocs(t => t - 1)
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  // Category colors
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Air Quality': 'bg-blue-100 text-blue-700',
      'Water Resources': 'bg-cyan-100 text-cyan-700',
      'Biodiversity': 'bg-green-100 text-green-700',
      'Climate Change': 'bg-orange-100 text-orange-700',
      'Waste Management': 'bg-amber-100 text-amber-700',
      'Policy & Regulation': 'bg-purple-100 text-purple-700',
    }
    return colors[category] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {totalDocs} Documents
          </span>
          {onUploadClick && (
            <Button 
              size="sm" 
              onClick={onUploadClick}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            className="pl-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Document List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : documents.length > 0 ? (
            documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  'p-3 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer',
                  'transition-colors group'
                )}
                onClick={() => onSelectDocument?.(doc)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <p className="font-medium text-sm text-gray-800 truncate">
                        {doc.title}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      {doc.category && (
                        <Badge 
                          variant="secondary" 
                          className={cn('text-xs', getCategoryColor(doc.category))}
                        >
                          {doc.category}
                        </Badge>
                      )}
                      {doc.year && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {doc.year}
                        </span>
                      )}
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 truncate">
                          {doc.tags.slice(0, 3).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelectDocument?.(doc)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(doc.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">No documents found</p>
              {onUploadClick && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onUploadClick}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Upload First Document
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
