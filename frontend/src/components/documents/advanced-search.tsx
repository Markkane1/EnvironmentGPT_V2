'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Search, 
  X, 
  Filter, 
  FileText, 
  Calendar,
  Tag,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, AUDIENCE_TYPES } from '@/lib/constants'
import { debounce, cn } from '@/lib/utils'
import { Document } from '@/types'

interface SearchFilters {
  category: string
  audience: string
  yearFrom: string
  yearTo: string
  hasEmbedding: boolean
}

interface AdvancedSearchProps {
  onDocumentSelect?: (doc: Document) => void
  placeholder?: string
}

type DebouncedSearch = (searchQuery: string, searchFilters: SearchFilters) => void

export function AdvancedSearch({ onDocumentSelect, placeholder }: AdvancedSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    category: 'all',
    audience: 'all',
    yearFrom: '',
    yearTo: '',
    hasEmbedding: false
  })
  const [totalResults, setTotalResults] = useState(0)
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Load search history
  useEffect(() => {
    const saved = localStorage.getItem('epa-search-history')
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved).slice(0, 10))
      } catch {
        console.error('Failed to load search history')
      }
    }
  }, [])

  // Debounced search function
  const performSearchFn = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
      if (!searchQuery.trim() && searchFilters.category === 'all') {
        setResults([])
        setTotalResults(0)
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set('q', searchQuery)
        if (searchFilters.category !== 'all') params.set('category', searchFilters.category)
        if (searchFilters.audience !== 'all') params.set('audience', searchFilters.audience)
        if (searchFilters.yearFrom) params.set('yearFrom', searchFilters.yearFrom)
        if (searchFilters.yearTo) params.set('yearTo', searchFilters.yearTo)
        params.set('pageSize', '20')

        const response = await fetch(`/api/documents?${params}`)
        const data = await response.json()

        if (data.success) {
          setResults(data.documents || [])
          setTotalResults(data.total || 0)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setIsLoading(false)
      }
    }, [])

  const performSearch = useMemo<DebouncedSearch>(
    () => debounce(performSearchFn, 300) as DebouncedSearch,
    [performSearchFn]
  )

  // Trigger search when query or filters change
  useEffect(() => {
    performSearch(query, filters)
  }, [query, filters, performSearch])

  // Update filter
  const updateFilter = (key: keyof SearchFilters, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      category: 'all',
      audience: 'all',
      yearFrom: '',
      yearTo: '',
      hasEmbedding: false
    })
    setQuery('')
  }

  // Save to search history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem('epa-search-history', JSON.stringify(newHistory))
  }

  // Handle search submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveToHistory(query)
    performSearch(query, filters)
  }

  // Check if any filters are active
  const hasActiveFilters = filters.category !== 'all' || 
    filters.audience !== 'all' || 
    filters.yearFrom || 
    filters.yearTo

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || "Search documents by title, content, or keywords..."}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => setQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3 mr-1" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-1 h-4 w-4 p-0 text-xs">!</Badge>
            )}
            {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </form>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Category</label>
                <Select 
                  value={filters.category} 
                  onValueChange={(val) => updateFilter('category', val)}
                >
                  <SelectTrigger className="h-8">
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

              {/* Audience Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Audience</label>
                <Select 
                  value={filters.audience} 
                  onValueChange={(val) => updateFilter('audience', val)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All audiences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Audiences</SelectItem>
                    {AUDIENCE_TYPES.map((aud) => (
                      <SelectItem key={aud.value} value={aud.value}>
                        {aud.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Range */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Year From</label>
                <Input
                  type="number"
                  placeholder="e.g., 2020"
                  value={filters.yearFrom}
                  onChange={(e) => updateFilter('yearFrom', e.target.value)}
                  className="h-8"
                  min={1990}
                  max={2030}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Year To</label>
                <Input
                  type="number"
                  placeholder="e.g., 2024"
                  value={filters.yearTo}
                  onChange={(e) => updateFilter('yearTo', e.target.value)}
                  className="h-8"
                  min={1990}
                  max={2030}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Active filters:</span>
                  {filters.category !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {filters.category}
                      <X 
                        className="w-3 h-3 ml-1 cursor-pointer" 
                        onClick={() => updateFilter('category', 'all')}
                      />
                    </Badge>
                  )}
                  {filters.audience !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {filters.audience}
                      <X 
                        className="w-3 h-3 ml-1 cursor-pointer" 
                        onClick={() => updateFilter('audience', 'all')}
                      />
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search History (when no query) */}
      {!query && searchHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Recent searches:</p>
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 5).map((item, index) => (
              <Badge 
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setQuery(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {(query || hasActiveFilters) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </span>
              ) : (
                `${totalResults} result${totalResults !== 1 ? 's' : ''} found`
              )}
            </p>
          </div>

          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {results.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    'p-3 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer',
                    'transition-colors'
                  )}
                  onClick={() => onDocumentSelect?.(doc)}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {doc.category && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.category}
                          </Badge>
                        )}
                        {doc.year && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {doc.year}
                          </span>
                        )}
                        {doc.tags && doc.tags.length > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {doc.tags.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {!isLoading && results.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No documents found</p>
                  <p className="text-xs mt-1">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
