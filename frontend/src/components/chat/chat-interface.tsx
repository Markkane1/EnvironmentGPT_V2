'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  BookOpen,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAppSettingsStore } from '@/lib/app-settings'
import { Message } from '@/types'
import { SUGGESTED_QUESTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { SimpleMarkdown } from '@/components/ui/simple-markdown'

export function ChatInterface() {
  const { 
    messages, 
    isLoading, 
    addMessage, 
    setLoading, 
    selectedAudience,
    selectedCategory,
    currentSessionId,
    setCurrentSession
  } = useChatStore()
  const showSources = useAppSettingsStore((state) => state.settings.showSources)
  
  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, number>>({})
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle chat submission
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userMessage })
    setLoading(true)

    try {
      const requestBody = {
        message: userMessage,
        audience: selectedAudience,
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        ...(selectedCategory !== 'all' ? { filters: { category: selectedCategory } } : {}),
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (data.success) {
        // Update session ID if new session was created
        if (data.sessionId && !currentSessionId) {
          setCurrentSession(data.sessionId)
        }
        
        addMessage({ 
          role: 'assistant', 
          content: data.response,
          sources: data.sources,
          backendMessageId: data.messageId
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to get response',
          variant: 'destructive'
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, addMessage, setLoading, selectedAudience, selectedCategory, currentSessionId, setCurrentSession])

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    textareaRef.current?.focus()
  }

  // Copy message to clipboard
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(messageId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy message',
        variant: 'destructive'
      })
    }
  }

  // Regenerate response
  const regenerateResponse = async (messageIndex: number) => {
    if (messageIndex < 1) return
    
    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return
    
    // Remove the last assistant message
    // Then resend the query
    setLoading(true)
    try {
      const requestBody = {
        message: userMessage.content,
        audience: selectedAudience,
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        ...(selectedCategory !== 'all' ? { filters: { category: selectedCategory } } : {}),
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (data.success) {
        addMessage({ 
          role: 'assistant', 
          content: data.response,
          sources: data.sources,
          backendMessageId: data.messageId
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to regenerate response',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const submitFeedback = useCallback(async (message: Message, rating: number) => {
    const messageId = message.backendMessageId || message.id

    setSubmittingFeedbackId(message.id)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setFeedbackByMessage((current) => ({
        ...current,
        [message.id]: rating
      }))

      toast({
        title: 'Feedback saved',
        description: rating >= 4 ? 'Marked response as helpful.' : 'Marked response as not helpful.'
      })
    } catch (error) {
      toast({
        title: 'Feedback failed',
        description: error instanceof Error ? error.message : 'Failed to submit feedback',
        variant: 'destructive'
      })
    } finally {
      setSubmittingFeedbackId(null)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Welcome section when no messages */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-gray-900">EPA Punjab</h1>
              <p className="text-gray-600">Environmental Knowledge Assistant</p>
            </div>
          </div>
          
          <div className="max-w-xl mb-8">
            <p className="text-gray-600 mb-2">
              Ask questions about environmental issues in Punjab, Pakistan. 
              Get information on air quality, water resources, biodiversity, 
              climate change, and environmental regulations.
            </p>
            <Badge variant="secondary" className="text-xs">
              Beta Version - Powered by RAG Technology
            </Badge>
          </div>
          
          {/* Suggested Questions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl w-full">
            {SUGGESTED_QUESTIONS.map((category, catIndex) => (
              category.questions.slice(0, 2).map((question, qIndex) => (
                <Button
                  key={`${catIndex}-${qIndex}`}
                  variant="outline"
                  className="h-auto py-3 px-4 text-left justify-start hover:bg-green-50 hover:border-green-300 transition-colors"
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  <Sparkles className="w-4 h-4 mr-2 text-green-600 shrink-0" />
                  <span className="text-sm line-clamp-2">{question}</span>
                </Button>
              ))
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      {messages.length > 0 && (
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <MessageBubble 
                key={message.id} 
                message={message}
                isLast={index === messages.length - 1}
                onCopy={() => copyToClipboard(message.content, message.id)}
                onRegenerate={() => regenerateResponse(index)}
                onFeedback={(rating) => submitFeedback(message, rating)}
                feedbackRating={feedbackByMessage[message.id]}
                feedbackLoading={submittingFeedbackId === message.id}
                showSources={showSources}
                copied={copiedId === message.id}
              />
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-2 text-gray-500 bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Searching knowledge base...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <div className="border-t bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about environmental issues in Punjab..."
              className="min-h-[44px] max-h-32 resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={1}
              disabled={isLoading}
            />
            <Button 
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="bg-green-600 hover:bg-green-700 shrink-0 h-11 min-w-11 px-4"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              EPA Punjab Environmental Assistant uses RAG technology to provide accurate, 
              source-backed information.
            </p>
            <p className="text-xs text-gray-400">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== Message Bubble Component ====================

interface MessageBubbleProps {
  message: Message
  isLast: boolean
  onCopy: () => void
  onRegenerate: () => void
  onFeedback: (rating: number) => void
  feedbackRating?: number
  feedbackLoading: boolean
  showSources: boolean
  copied: boolean
}

function MessageBubble({ 
  message, 
  isLast, 
  onCopy, 
  onRegenerate, 
  onFeedback, 
  feedbackRating,
  feedbackLoading,
  showSources,
  copied 
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const helpfulSelected = feedbackRating !== undefined && feedbackRating >= 4
  const notHelpfulSelected = feedbackRating !== undefined && feedbackRating <= 2
  const feedbackSubmitted = feedbackRating !== undefined

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isUser 
          ? 'bg-gray-200' 
          : 'bg-gradient-to-br from-green-500 to-emerald-600'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-gray-600" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* Message Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'text-right')}>
        <div className={cn(
          'inline-block rounded-2xl px-4 py-3 text-sm',
          isUser 
            ? 'bg-green-600 text-white rounded-tr-none' 
            : 'bg-gray-100 text-gray-800 rounded-tl-none'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1">
              <SimpleMarkdown>{message.content}</SimpleMarkdown>
            </div>
          )}
        </div>
        
        {/* Sources */}
        {!isUser && showSources && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-left">
            <p className="text-xs text-gray-500 mb-1">Sources:</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((source, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  {source.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Action Buttons for Assistant Messages */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={onCopy}
            >
              {copied ? (
                <Check className="w-3 h-3 mr-1 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            
            {isLast && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                  onClick={onRegenerate}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Regenerate
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    'h-6 px-2 text-xs',
                    helpfulSelected ? 'bg-green-50 text-green-700 hover:text-green-700' : 'text-gray-500 hover:text-green-600'
                  )}
                  onClick={() => onFeedback(5)}
                  disabled={feedbackLoading || feedbackSubmitted}
                  aria-label="Mark response as helpful"
                >
                  <ThumbsUp className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    'h-6 px-2 text-xs',
                    notHelpfulSelected ? 'bg-red-50 text-red-700 hover:text-red-700' : 'text-gray-500 hover:text-red-600'
                  )}
                  onClick={() => onFeedback(1)}
                  disabled={feedbackLoading || feedbackSubmitted}
                  aria-label="Mark response as not helpful"
                >
                  <ThumbsDown className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Leaf icon component
function Leaf({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}
