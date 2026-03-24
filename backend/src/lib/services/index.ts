// =====================================================
// EPA Punjab EnvironmentGPT - Services Index
// Phase 2-5: Centralized Service Exports
// =====================================================

// Phase 2 Services
export { chatService } from './chat-service'
export { documentService } from './document-service'
export { documentIngestionService } from './document-ingestion-service'
export { vectorStoreService } from './vector-store-service'

// Phase 4 Services
// Public service exports prefer the advanced implementations. The legacy
// embedding/rag services remain available only via direct internal imports.
export { advancedEmbeddingService, AdvancedEmbeddingService } from './advanced-embedding-service'
export { queryProcessorService, QueryProcessorService } from './query-processor'
export { responseCacheService, ResponseCacheService } from './response-cache'

// Phase 5 Services
export { enhancedRAGService, EnhancedRAGService } from './advanced-rag-service'
export { promptTemplateService, PromptTemplateService } from './prompt-template-service'
export { conversationMemoryService, ConversationMemoryService } from './conversation-memory'

// Re-export types
export type { SearchResult, VectorDocument, IndexStats } from './vector-store-service'

// Phase 4 Types
export type { 
  EmbeddingOptions, 
  EmbeddingResult as AdvancedEmbeddingResult,
  BatchEmbeddingResult as AdvancedBatchEmbeddingResult,
  HybridSearchResult
} from './advanced-embedding-service'

export type {
  ProcessedQuery,
  ExtractedEntities,
  QueryIntent,
  QueryFilters,
  QueryExpansion
} from './query-processor'

export type {
  CacheEntry,
  CacheStats,
  CacheOptions
} from './response-cache'

// Phase 5 Types
export type {
  EnhancedRAGConfig,
  RAGPipelineResult,
  StreamChunk,
  ConversationContext
} from './advanced-rag-service'

export type {
  PromptTemplate,
  PromptExample,
  PromptVariables
} from './prompt-template-service'

export type {
  ConversationMessage,
  ConversationSummary,
  TopicEvolution
} from './conversation-memory'

// Phase 8+ Extensibility Services
export { llmProviderRegistry } from './llm-provider-registry'
export { dataConnectorService } from './data-connector-service'
export { llmRouter } from './llm-router-service'

// Extensibility Types
export type {
  LLMProviderConfig,
  ProviderRole,
  ProviderType,
  HealthStatus,
  ChatCompletionRequest,
  ChatCompletionResponse,
  LLMRequestResult
} from './llm-provider-registry'

export type {
  DataConnectorConfig,
  ConnectorType,
  AuthMethod,
  InjectionMethod,
  FetchStatus,
  ConnectorData,
  EnrichedContext
} from './data-connector-service'

export type {
  RouterRequest,
  RouterResponse,
  PipelineStats
} from './llm-router-service'
