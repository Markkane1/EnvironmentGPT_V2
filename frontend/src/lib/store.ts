// =====================================================
// EPA Punjab EnvironmentGPT - Global State Store
// Phase 1: Enhanced State Management with Zustand
// =====================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Message, Document, ChatSession, DocumentFilter } from '@/types'

// ==================== Chat Store ====================

interface ChatState {
  // State
  messages: Message[]
  isLoading: boolean
  currentSessionId: string | null
  recentSessions: ChatSession[]
  
  // Filters
  selectedDocuments: string[]
  selectedAudience: string
  selectedCategory: string
  sidebarOpen: boolean
  
  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  setLoading: (loading: boolean) => void
  setCurrentSession: (sessionId: string | null) => void
  loadSession: (session: ChatSession) => void
  clearMessages: () => void
  
  // Filter Actions
  setSelectedDocuments: (docs: string[]) => void
  setSelectedAudience: (audience: string) => void
  setSelectedCategory: (category: string) => void
  toggleSidebar: () => void
  
  // Session Actions
  setRecentSessions: (sessions: ChatSession[]) => void
  removeSession: (sessionId: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial State
      messages: [],
      isLoading: false,
      currentSessionId: null,
      recentSessions: [],
      
      selectedDocuments: [],
      selectedAudience: 'General Public',
      selectedCategory: 'all',
      sidebarOpen: true,
      
      // Message Actions
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date()
        }]
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
      
      loadSession: (session) => set({
        currentSessionId: session.id,
        messages: session.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          sources: message.sources,
          timestamp: new Date(message.createdAt),
          backendMessageId: message.role === 'assistant' ? message.id : undefined,
        }))
      }),
      
      clearMessages: () => set({ 
        messages: [], 
        currentSessionId: null 
      }),
      
      // Filter Actions
      setSelectedDocuments: (docs) => set({ selectedDocuments: docs }),
      
      setSelectedAudience: (audience) => set({ selectedAudience: audience }),
      
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Session Actions
      setRecentSessions: (sessions) => set({ recentSessions: sessions }),
      
      removeSession: (sessionId) => set((state) => ({
        recentSessions: state.recentSessions.filter(s => s.id !== sessionId)
      })),
    }),
    {
      name: 'epa-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedAudience: state.selectedAudience,
        selectedCategory: state.selectedCategory,
        sidebarOpen: state.sidebarOpen,
        recentSessions: state.recentSessions,
      }),
    }
  )
)

// ==================== Document Store ====================

interface DocumentState {
  // State
  documents: Document[]
  selectedDocument: Document | null
  isLoading: boolean
  totalCount: number
  currentPage: number
  pageSize: number
  
  // Filters
  filters: DocumentFilter
  
  // Actions
  setDocuments: (documents: Document[]) => void
  setSelectedDocument: (document: Document | null) => void
  setLoading: (loading: boolean) => void
  setPagination: (total: number, page: number, pageSize: number) => void
  setFilters: (filters: Partial<DocumentFilter>) => void
  resetFilters: () => void
}

const defaultFilters: DocumentFilter = {
  category: undefined,
  reportSeries: undefined,
  yearFrom: undefined,
  yearTo: undefined,
  audience: undefined,
  tags: undefined,
  searchQuery: undefined,
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      // Initial State
      documents: [],
      selectedDocument: null,
      isLoading: false,
      totalCount: 0,
      currentPage: 1,
      pageSize: 10,
      filters: defaultFilters,
      
      // Actions
      setDocuments: (documents) => set({ documents }),
      
      setSelectedDocument: (document) => set({ selectedDocument: document }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setPagination: (total, page, pageSize) => set({
        totalCount: total,
        currentPage: page,
        pageSize: pageSize
      }),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      resetFilters: () => set({ filters: defaultFilters }),
    }),
    {
      name: 'epa-document-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: state.filters,
        pageSize: state.pageSize,
      }),
    }
  )
)

// ==================== UI Store ====================

interface UIState {
  // State
  isDarkMode: boolean
  showFeedbackModal: boolean
  feedbackMessageId: string | null
  showDocumentModal: boolean
  showSettingsModal: boolean
  toasts: Toast[]
  
  // Actions
  toggleDarkMode: () => void
  setShowFeedbackModal: (show: boolean, messageId?: string) => void
  setShowDocumentModal: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial State
      isDarkMode: false,
      showFeedbackModal: false,
      feedbackMessageId: null,
      showDocumentModal: false,
      showSettingsModal: false,
      toasts: [],
      
      // Actions
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      
      setShowFeedbackModal: (show, messageId) => set({
        showFeedbackModal: show,
        feedbackMessageId: messageId || null
      }),
      
      setShowDocumentModal: (show) => set({ showDocumentModal: show }),
      
      setShowSettingsModal: (show) => set({ showSettingsModal: show }),
      
      addToast: (toast) => set((state) => ({
        toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }]
      })),
      
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),
    }),
    {
      name: 'epa-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
      }),
    }
  )
)
