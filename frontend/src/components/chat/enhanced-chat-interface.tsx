'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
  RotateCcw,
  MessageSquarePlus,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAppSettingsStore } from '@/lib/app-settings'
import { Message, SourceReference } from '@/types'
import { SUGGESTED_QUESTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { SourcePanel } from './source-panel'
import { SimpleMarkdown } from '@/components/ui/simple-markdown'

export function EnhancedChatInterface() {
  const {
    messages,
    isLoading,
    addMessage,
    updateMessageContent,
    updateMessage,
    setLoading,
    selectedAudience,
    selectedCategory,
    currentSessionId,
    setCurrentSession,
    clearMessages
  } = useChatStore()
  const showSources = useAppSettingsStore((state) => state.settings.showSources)

  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeSources, setActiveSources] = useState<SourceReference[]>([])
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [lastConfidence, setLastConfidence] = useState<number>(0)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, number>>({})
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!showSources) {
      setShowSourcePanel(false)
    }
  }, [showSources])

  const requestChatResponse = useCallback(async (userMessage: string) => {
    setLoading(true)
    setIsStreaming(false)

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
        body: JSON.stringify({ ...requestBody, stream: true })
      })

      if (response.ok === false) {
        throw new Error(`HTTP ${response.status}`)
      }

      const contentType = response.headers?.get?.('content-type') || ''

      if (contentType.includes('text/event-stream') && response.body && typeof response.body.getReader === 'function') {
        const assistantMessageId = addMessage({
          role: 'assistant',
          content: '',
          sources: []
        })

        const newSessionId = response.headers?.get?.('x-session-id')
        if (newSessionId && newSessionId !== 'new' && !currentSessionId) {
          setCurrentSession(newSessionId)
        }

        setActiveSources([])
        setLastConfidence(0)
        setIsStreaming(true)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'meta') {
                const streamedSources = Array.isArray(parsed.sources) ? parsed.sources : []
                updateMessage(assistantMessageId, {
                  sources: streamedSources,
                  backendMessageId: typeof parsed.messageId === 'string' ? parsed.messageId : undefined
                })

                if (parsed.sessionId && parsed.sessionId !== 'new' && !currentSessionId) {
                  setCurrentSession(parsed.sessionId)
                }

                if (showSources && streamedSources.length > 0) {
                  setActiveSources(streamedSources)
                  setLastConfidence(typeof parsed.confidence === 'number' ? parsed.confidence : 0.5)
                }

                continue
              }

              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                updateMessageContent(assistantMessageId, fullContent)
              }
            } catch {
              // Ignore malformed SSE chunks.
            }
          }
        }

        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'meta') {
                const streamedSources = Array.isArray(parsed.sources) ? parsed.sources : []
                updateMessage(assistantMessageId, {
                  sources: streamedSources,
                  backendMessageId: typeof parsed.messageId === 'string' ? parsed.messageId : undefined
                })

                if (parsed.sessionId && parsed.sessionId !== 'new' && !currentSessionId) {
                  setCurrentSession(parsed.sessionId)
                }

                if (showSources && streamedSources.length > 0) {
                  setActiveSources(streamedSources)
                  setLastConfidence(typeof parsed.confidence === 'number' ? parsed.confidence : 0.5)
                }

                continue
              }

              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                updateMessageContent(assistantMessageId, fullContent)
              }
            } catch {
              // Ignore malformed SSE chunks.
            }
          }
        }
      } else {
        const data = await response.json()
        if (data.success) {
          if (data.sessionId && !currentSessionId) {
            setCurrentSession(data.sessionId)
          }

          addMessage({
            role: 'assistant',
            content: data.response,
            sources: data.sources,
            backendMessageId: data.messageId
          })

          if (showSources && data.sources?.length > 0) {
            setActiveSources(data.sources)
            setLastConfidence(data.confidence || 0.5)
          } else {
            setActiveSources([])
            setLastConfidence(0)
          }
        } else {
          toast({
            title: 'Error',
            description: data.error || 'Failed to get response',
            variant: 'destructive'
          })
        }
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive'
      })
    } finally {
      setIsStreaming(false)
      setLoading(false)
    }
  }, [
    addMessage,
    currentSessionId,
    selectedAudience,
    selectedCategory,
    setCurrentSession,
    setLoading,
    showSources,
    updateMessage,
    updateMessageContent
  ])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userMessage })
    await requestChatResponse(userMessage)
  }, [addMessage, input, isLoading, requestChatResponse])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    textareaRef.current?.focus()
  }

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

  const regenerateResponse = async (messageIndex: number) => {
    if (messageIndex < 1) return

    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    await requestChatResponse(userMessage.content)
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
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900">EPA Punjab</h1>
                <p className="text-gray-600">Environmental Knowledge Assistant</p>
              </div>
            </div>

            <div className="mb-8 max-w-xl">
              <p className="mb-2 text-gray-600">
                Ask questions about environmental issues in Punjab, Pakistan.
                Get information on air quality, water resources, biodiversity,
                climate change, and environmental regulations.
              </p>
              <Badge variant="secondary" className="text-xs">
                Phase 6 - Enhanced RAG with Confidence Scoring
              </Badge>
            </div>

            <div className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((category, categoryIndex) => (
                category.questions.slice(0, 2).map((question, questionIndex) => (
                  <Button
                    key={`${categoryIndex}-${questionIndex}`}
                    variant="outline"
                    className="h-auto justify-start px-4 py-3 text-left transition-colors hover:border-green-300 hover:bg-green-50"
                    onClick={() => handleSuggestedQuestion(question)}
                  >
                    <Sparkles className="mr-2 h-4 w-4 shrink-0 text-green-600" />
                    <span className="line-clamp-2 text-sm">{question}</span>
                  </Button>
                ))
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="mx-auto max-w-4xl space-y-6">
              {messages.map((message, index) => (
                <EnhancedMessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  onCopy={() => copyToClipboard(message.content, message.id)}
                  onRegenerate={() => regenerateResponse(index)}
                  onFeedback={(rating) => submitFeedback(message, rating)}
                  feedbackRating={feedbackByMessage[message.id]}
                  feedbackLoading={submittingFeedbackId === message.id}
                  showSources={showSources}
                  onViewSources={() => {
                    setActiveSources(message.sources || [])
                    setShowSourcePanel(true)
                  }}
                  copied={copiedId === message.id}
                  showStreamingCursor={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                />
              ))}
              {isLoading && !isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-none bg-gray-100 px-4 py-3 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching knowledge base...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="border-t bg-white p-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about environmental issues in Punjab..."
                  className="min-h-[44px] max-h-32 resize-none pr-10 focus:border-transparent focus:ring-2 focus:ring-green-500"
                  rows={1}
                  disabled={isLoading}
                />
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                    onClick={() => {
                      clearMessages()
                      setActiveSources([])
                      setShowSourcePanel(false)
                      setLastConfidence(0)
                    }}
                    title="New chat"
                    aria-label="Start new chat"
                  >
                    <MessageSquarePlus className="h-4 w-4 text-gray-400" />
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="h-11 min-w-11 shrink-0 bg-green-600 px-4 hover:bg-green-700"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              {showSources && activeSources.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowSourcePanel(!showSourcePanel)}
                  className={cn('shrink-0', showSourcePanel && 'border-green-300 bg-green-50')}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Sources
                  <Badge variant="secondary" className="ml-2">
                    {activeSources.length}
                  </Badge>
                </Button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                EPA Punjab Environmental Assistant - RAG-powered responses with source attribution
              </p>
              <p className="text-xs text-gray-400">
                Enter to send - Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>

      {showSources && showSourcePanel && activeSources.length > 0 && (
        <div className="hidden w-80 border-l bg-white lg:block">
          <SourcePanel
            sources={activeSources}
            confidence={lastConfidence}
            onClose={() => setShowSourcePanel(false)}
          />
        </div>
      )}

      <Sheet open={showSources && showSourcePanel && activeSources.length > 0} onOpenChange={setShowSourcePanel}>
        <SheetContent side="right" className="w-80 p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Source Documents</SheetTitle>
          </SheetHeader>
          <SourcePanel
            sources={activeSources}
            confidence={lastConfidence}
            onClose={() => setShowSourcePanel(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  isLast: boolean
  onCopy: () => void
  onRegenerate: () => void
  onFeedback: (rating: number) => void
  feedbackRating?: number
  feedbackLoading: boolean
  showSources: boolean
  onViewSources: () => void
  copied: boolean
  showStreamingCursor: boolean
}

function EnhancedMessageBubble({
  message,
  isLast,
  onCopy,
  onRegenerate,
  onFeedback,
  feedbackRating,
  feedbackLoading,
  showSources,
  onViewSources,
  copied,
  showStreamingCursor
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasSources = !!message.sources?.length
  const helpfulSelected = feedbackRating !== undefined && feedbackRating >= 4
  const notHelpfulSelected = feedbackRating !== undefined && feedbackRating <= 2
  const feedbackSubmitted = feedbackRating !== undefined

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-gray-200' : 'bg-gradient-to-br from-green-500 to-emerald-600'
      )}>
        {isUser ? <User className="h-4 w-4 text-gray-600" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      <div className={cn('flex-1 max-w-[80%]', isUser && 'text-right')}>
        <div className={cn(
          'inline-block rounded-2xl px-4 py-3 text-sm',
          isUser ? 'rounded-tr-none bg-green-600 text-white' : 'rounded-tl-none bg-gray-100 text-gray-800'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:mb-1 prose-headings:mt-2">
              <SimpleMarkdown>{message.content}</SimpleMarkdown>
              {showStreamingCursor && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-green-600 align-middle" />
              )}
            </div>
          )}
        </div>

        {!isUser && showSources && hasSources && (
          <div className="mt-2 text-left">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-500 hover:text-green-600"
              onClick={onViewSources}
            >
              <BookOpen className="mr-1 h-3 w-3" />
              {message.sources!.length} source{message.sources!.length !== 1 ? 's' : ''}
              <Badge variant="outline" className="ml-2 text-xs">View</Badge>
            </Button>
          </div>
        )}

        {!isUser && (
          <div className="mt-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={onCopy}
            >
              {copied ? <Check className="mr-1 h-3 w-3 text-green-600" /> : <Copy className="mr-1 h-3 w-3" />}
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
                  <RotateCcw className="mr-1 h-3 w-3" />
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
                  <ThumbsUp className="h-3 w-3" />
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
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

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
