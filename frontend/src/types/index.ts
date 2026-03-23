// =====================================================
// EPA Punjab EnvironmentGPT - Type Definitions
// Phase 1: Core Type System
// =====================================================

// ==================== User & Auth Types ====================

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  createdAt: Date
  updatedAt: Date
}

export type UserRole = 'admin' | 'analyst' | 'viewer' | 'guest'

export interface UserSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
}

// ==================== Document Types ====================

export interface Document {
  id: string
  title: string
  content: string
  summary?: string
  source?: string
  sourceUrl?: string
  category: DocumentCategory
  reportSeries?: string
  year?: number
  audience: AudienceType
  author?: string
  tags: string[]
  isActive: boolean
  fileSize?: number
  fileType?: string
  language: string
  createdAt: Date
  updatedAt: Date
  chunks?: DocumentChunk[]
}

export type DocumentCategory = 
  | 'Air Quality'
  | 'Water Resources'
  | 'Biodiversity'
  | 'Climate Change'
  | 'Waste Management'
  | 'Policy & Regulation'
  | 'Environmental Impact Assessment'
  | 'Industrial Pollution'
  | 'Agricultural Environment'
  | 'Urban Environment'

export type AudienceType = 'General Public' | 'Technical' | 'Policy Maker'

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  embedding?: number[]
  metadata: ChunkMetadata
  createdAt: Date
}

export interface ChunkMetadata {
  pageNumber?: number
  section?: string
  startPosition: number
  endPosition: number
  wordCount: number
}

export interface DocumentFilter {
  category?: DocumentCategory
  reportSeries?: string
  yearFrom?: number
  yearTo?: number
  audience?: AudienceType
  tags?: string[]
  searchQuery?: string
}

// ==================== Chat Types ====================

export interface ChatSession {
  id: string
  title?: string
  userId?: string
  documentId?: string
  metadata: SessionMetadata
  createdAt: Date
  updatedAt: Date
  messages: ChatMessage[]
}

export interface SessionMetadata {
  totalMessages: number
  lastQuery?: string
  avgResponseTime?: number
  feedbackScore?: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  sources?: SourceReference[]
  metadata?: MessageMetadata
  createdAt: Date
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  sources?: SourceReference[]
  timestamp: Date
  backendMessageId?: string
}

export interface SourceReference {
  id: string
  documentId: string
  title: string
  category?: string
  relevanceScore: number
  excerpt?: string
  pageNumber?: number
  source?: string
  year?: number
}

export interface MessageMetadata {
  responseTime?: number
  tokenCount?: number
  model?: string
  temperature?: number
}

export interface ChatRequest {
  message: string
  sessionId?: string
  documentIds?: string[]
  audience?: AudienceType
  filters?: DocumentFilter
  stream?: boolean
}

export interface ChatResponse {
  success: boolean
  response?: string
  sources?: SourceReference[]
  sessionId?: string
  messageId?: string
  confidence?: number
  metadata?: Record<string, unknown>
  timestamp: Date
  error?: string
}

// ==================== RAG Types ====================

export interface RAGConfig {
  embeddingModel: string
  llmModel: string
  defaultChunkSize: number
  chunkOverlap: number
  defaultTopK: number
  similarityThreshold: number
  maxContextTokens: number
  embeddingDimension: number
}

export interface RetrievalResult {
  chunks: DocumentChunk[]
  scores: number[]
  totalTokens: number
  retrievalTime: number
}

export interface EmbeddingVector {
  id: string
  documentId: string
  chunkId: string
  vector: number[]
  createdAt: Date
}

// ==================== Search Types ====================

export interface SearchRequest {
  query: string
  filters?: DocumentFilter
  limit?: number
  offset?: number
  sortBy?: 'relevance' | 'date' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResult {
  documents: Document[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ==================== Analytics Types ====================

export interface UsageAnalytics {
  totalQueries: number
  uniqueUsers: number
  avgResponseTime: number
  topCategories: CategoryUsage[]
  topQueries: QueryCount[]
  feedbackStats: FeedbackStatistics
  period: DateRange
}

export interface CategoryUsage {
  category: DocumentCategory
  count: number
  percentage: number
}

export interface QueryCount {
  query: string
  count: number
  avgRating?: number
}

export interface FeedbackStatistics {
  totalFeedback: number
  avgRating: number
  ratingDistribution: Record<number, number>
}

export interface DateRange {
  start: Date
  end: Date
}

// ==================== Feedback Types ====================

export interface Feedback {
  id: string
  messageId: string
  rating: number // 1-5
  comment?: string
  userId?: string
  createdAt: Date
}

export interface FeedbackRequest {
  messageId: string
  rating: number
  comment?: string
}

// ==================== System Types ====================

export interface SystemConfig {
  appName: string
  version: string
  environment: 'development' | 'staging' | 'production'
  features: FeatureFlags
  limits: SystemLimits
}

export interface FeatureFlags {
  chatEnabled: boolean
  documentUploadEnabled: boolean
  analyticsEnabled: boolean
  feedbackEnabled: boolean
  multiLanguageEnabled: boolean
  voiceInputEnabled: boolean
  exportEnabled: boolean
}

export interface SystemLimits {
  maxFileSize: number // bytes
  maxDocumentsPerQuery: number
  maxSessionMessages: number
  rateLimitPerMinute: number
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  services: ServiceStatus[]
}

export interface ServiceStatus {
  name: string
  status: 'up' | 'down'
  latency?: number
  message?: string
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ResponseMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ResponseMeta {
  timestamp: Date
  requestId: string
  duration?: number
}

// ==================== Pagination Types ====================

export interface PaginatedRequest {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

// ==================== File Upload Types ====================

export interface UploadRequest {
  file: File
  category: DocumentCategory
  audience: AudienceType
  tags?: string[]
}

export interface UploadResult {
  documentId: string
  status: 'success' | 'pending' | 'failed'
  message: string
  chunksCreated?: number
}

export interface UploadProgress {
  documentId: string
  status: 'uploading' | 'processing' | 'chunking' | 'embedding' | 'complete' | 'error'
  progress: number // 0-100
  message: string
}
