import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SourcePanel } from '@/components/chat/source-panel'
import type { ChatResponse, SourceReference } from '@/types'

describe('shared chat/source contracts', () => {
  it('renders shared source metadata and confidence fields used by the chat UI', () => {
    const source: SourceReference = {
      id: 'source-1',
      documentId: 'doc-1',
      title: 'Punjab Air Quality Report',
      category: 'Air Quality',
      relevanceScore: 0.94,
      excerpt: 'AQI improved after rainfall.',
      source: 'EPA Punjab',
      year: 2024,
    }

    const response: ChatResponse = {
      success: true,
      response: 'AQI improved after rainfall.',
      sources: [source],
      confidence: 0.9,
      timestamp: new Date(),
    }

    render(<SourcePanel sources={response.sources || []} confidence={response.confidence} />)

    fireEvent.click(screen.getByText('Punjab Air Quality Report'))

    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('EPA Punjab')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })
})
