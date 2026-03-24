import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EnhancedAdminDashboard } from '@/components/admin/enhanced-dashboard'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

jest.mock('@/components/admin/providers-settings-panel', () => ({
  ProvidersSettingsPanel: () => <div>Providers panel</div>,
}))

jest.mock('@/components/admin/connectors-settings-panel', () => ({
  ConnectorsSettingsPanel: () => <div>Connectors panel</div>,
}))

jest.mock('@/components/documents/document-upload-modal', () => ({
  DocumentUploadModal: ({ open }: { open: boolean }) => open ? <div>Upload modal open</div> : null,
}))

const fetchMock = global.fetch as jest.Mock

function mockDashboardFetches() {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statistics: { documents: 4, sessions: 3, messages: 20, feedback: 2 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statistics: { sessionsToday: 2, sessionsWeek: 3, totalQueries: 20, avgResponseTime: 188 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statistics: {
          total: 4,
          byCategory: { 'Air Quality': 3, 'Water Resources': 1 },
          byYear: { 2024: 2, 2023: 2 },
          recentlyAdded: [
            {
              id: 'doc-1',
              title: 'Punjab Air Quality Report',
              category: 'Air Quality',
              year: 2024,
              createdAt: '2026-03-20T00:00:00.000Z',
            },
          ],
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statistics: {
          total: 2,
          avgRating: 4.5,
          ratingDistribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
          positiveRate: 100,
          recentFeedback: [
            {
              id: 'feedback-1',
              rating: 5,
              comment: 'Helpful and grounded',
              createdAt: '2026-03-22T00:00:00.000Z',
            },
          ],
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        health: {
          status: 'healthy',
          uptime: 3600,
          services: [{ name: 'database', status: 'up', latency: 4 }],
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stats: { totalEntries: 1, hitRate: 0.5, memoryUsageMB: 1.2 },
      }),
    })
}

describe('EnhancedAdminDashboard', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('renders recent documents and response latency from the stats API contract', async () => {
    mockDashboardFetches()

    render(<EnhancedAdminDashboard />)

    await waitFor(() => expect(screen.getByText('Punjab Air Quality Report')).toBeInTheDocument())
    expect(screen.getByText('188ms avg')).toBeInTheDocument()
  })

  it('replaces analytics placeholders with live summaries', async () => {
    mockDashboardFetches()

    render(<EnhancedAdminDashboard initialTab="analytics" />)

    expect(await screen.findByText('Operational Summary')).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('opens the real upload modal from document management', async () => {
    mockDashboardFetches()

    render(<EnhancedAdminDashboard initialTab="documents" />)

    fireEvent.click(await screen.findByRole('button', { name: /^upload$/i }))

    expect(screen.getByText('Upload modal open')).toBeInTheDocument()
  })

  it('loads a document preview when viewing a managed document', async () => {
    mockDashboardFetches()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        document: {
          id: 'doc-1',
          title: 'Punjab Air Quality Report',
          content: 'Detailed report content',
          category: 'Air Quality',
          audience: 'General Public',
          tags: [],
          isActive: true,
          language: 'en',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        },
      }),
    })

    render(<EnhancedAdminDashboard initialTab="documents" />)

    fireEvent.click(await screen.findByRole('button', { name: /view document punjab air quality report/i }))

    expect(await screen.findByText('Detailed report content')).toBeInTheDocument()
  })

  it('downloads document content from the management table', async () => {
    mockDashboardFetches()
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn().mockReturnValue('blob:test-url'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    })
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        document: {
          id: 'doc-1',
          title: 'Punjab Air Quality Report',
          content: 'Detailed report content',
          category: 'Air Quality',
          audience: 'General Public',
          tags: [],
          isActive: true,
          language: 'en',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        },
      }),
    })

    render(<EnhancedAdminDashboard initialTab="documents" />)

    fireEvent.click(await screen.findByRole('button', { name: /download document punjab air quality report/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/documents?id=doc-1'))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it('deletes a managed document through the existing API and refreshes stats', async () => {
    mockDashboardFetches()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statistics: { documents: 3, sessions: 3, messages: 20, feedback: 2 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statistics: { sessionsToday: 2, sessionsWeek: 3, totalQueries: 20, avgResponseTime: 188 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statistics: {
            total: 3,
            byCategory: { 'Air Quality': 2, 'Water Resources': 1 },
            byYear: { 2024: 2, 2023: 1 },
            recentlyAdded: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          statistics: {
            total: 2,
            avgRating: 4.5,
            ratingDistribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
            positiveRate: 100,
            recentFeedback: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: {
            status: 'healthy',
            uptime: 3600,
            services: [{ name: 'database', status: 'up', latency: 4 }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stats: { totalEntries: 1, hitRate: 0.5, memoryUsageMB: 1.2 },
        }),
      })

    render(<EnhancedAdminDashboard initialTab="documents" />)

    fireEvent.click(await screen.findByRole('button', { name: /delete document punjab air quality report/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/documents?id=doc-1', { method: 'DELETE' })
    )

    confirmSpy.mockRestore()
  })

  it('shows a visible dashboard alert when stats refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Stats unavailable' }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

    render(<EnhancedAdminDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to refresh dashboard statistics/i)
  })
})
