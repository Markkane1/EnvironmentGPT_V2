// =====================================================
// EPA Punjab EnvironmentGPT - Test Fixtures
// Phase 8: Test Data and Mocks
// =====================================================

import { Document, DocumentChunk, ChatSession, ChatMessage, SourceReference } from '@/types'

// ==================== Document Fixtures ====================

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    title: 'Air Quality Report 2024',
    content: 'Air quality in Punjab has been monitored through a network of stations. The PM2.5 levels in Lahore often exceed WHO guidelines during winter months due to smog conditions.',
    category: 'Air Quality',
    audience: 'General Public',
    tags: ['air', 'pollution', 'Lahore', 'PM2.5'],
    isActive: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'doc-2',
    title: 'Water Quality Standards NEQS',
    content: 'National Environmental Quality Standards (NEQS) for water specify the acceptable limits for various parameters including pH (6.5-8.5), TDS (<1000 mg/L), and BOD (<80 mg/L).',
    category: 'Water Resources',
    audience: 'Technical',
    tags: ['water', 'NEQS', 'standards', 'quality'],
    isActive: true,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-10'),
  },
  {
    id: 'doc-3',
    title: 'Punjab Climate Change Policy',
    content: 'Punjab Climate Change Policy outlines strategies for adaptation and mitigation, including water resource management, agricultural adaptation, and renewable energy transition.',
    category: 'Climate Change',
    audience: 'Policy Maker',
    tags: ['climate', 'policy', 'adaptation', 'mitigation'],
    isActive: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
]

export const mockDocumentChunks: DocumentChunk[] = [
  {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Air quality in Punjab has been monitored through a network of stations.',
    chunkIndex: 0,
    metadata: { wordCount: 10 },
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'chunk-2',
    documentId: 'doc-1',
    content: 'The PM2.5 levels in Lahore often exceed WHO guidelines during winter months.',
    chunkIndex: 1,
    metadata: { wordCount: 12 },
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'chunk-3',
    documentId: 'doc-2',
    content: 'National Environmental Quality Standards (NEQS) for water specify acceptable limits.',
    chunkIndex: 0,
    metadata: { wordCount: 10 },
    createdAt: new Date('2024-02-10'),
  },
]

// ==================== Chat Fixtures ====================

export const mockChatSessions: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Air Quality Inquiry',
    createdAt: new Date('2024-03-15T10:00:00Z'),
    updatedAt: new Date('2024-03-15T10:30:00Z'),
  },
  {
    id: 'session-2',
    title: 'Water Standards Discussion',
    createdAt: new Date('2024-03-14T14:00:00Z'),
    updatedAt: new Date('2024-03-14T14:15:00Z'),
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'What is the air quality situation in Lahore?',
    createdAt: new Date('2024-03-15T10:00:00Z'),
  },
  {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'Based on the available data, Lahore experiences significant air quality challenges, particularly during the winter months when PM2.5 levels often exceed WHO guidelines.',
    sources: [],
    createdAt: new Date('2024-03-15T10:00:30Z'),
  },
]

// ==================== Source Fixtures ====================

export const mockSources: SourceReference[] = [
  {
    id: 'source-1',
    documentId: 'doc-1',
    title: 'Air Quality Report 2024',
    category: 'Air Quality',
    relevanceScore: 0.95,
    excerpt: 'Air quality in Punjab has been monitored through a network of stations...',
  },
  {
    id: 'source-2',
    documentId: 'doc-2',
    title: 'Water Quality Standards NEQS',
    category: 'Water Resources',
    relevanceScore: 0.85,
    excerpt: 'National Environmental Quality Standards (NEQS) for water...',
  },
]

// ==================== API Response Fixtures ====================

export const mockChatAPIResponse = {
  success: true,
  response: 'Based on the available data, Lahore experiences significant air quality challenges.',
  sources: mockSources,
  sessionId: 'session-1',
  messageId: 'msg-3',
  confidence: 0.85,
  timestamp: new Date().toISOString(),
}

export const mockDocumentsAPIResponse = {
  success: true,
  documents: mockDocuments,
  total: 3,
  page: 1,
  pageSize: 10,
  hasMore: false,
}

export const mockStatsAPIResponse = {
  success: true,
  statistics: {
    documents: 3,
    sessions: 2,
    messages: 10,
    feedback: 5,
  },
}

// ==================== Mock Functions ====================

export const mockPrisma = {
  document: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  documentChunk: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  chatSession: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  feedback: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
}

// Reset mocks between tests
export const resetMocks = () => {
  Object.values(mockPrisma).forEach(model => {
    Object.values(model).forEach(fn => {
      if (jest.isMockFunction(fn)) {
        fn.mockReset()
      }
    })
  })
}
