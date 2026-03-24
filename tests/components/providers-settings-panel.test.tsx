import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProvidersSettingsPanel } from '@/components/admin/providers-settings-panel'

const fetchMock = global.fetch as jest.Mock

jest.mock('@/components/ui/dialog', () => {
  const React = require('react')
  const DialogContext = React.createContext({
    open: false,
    onOpenChange: (_open: boolean) => {},
  })

  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    DialogTrigger: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) => {
      const context = React.useContext(DialogContext)
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          onClick: (event: React.MouseEvent) => {
            children.props.onClick?.(event)
            context.onOpenChange(true)
          },
        })
      }

      return <button type="button" onClick={() => context.onOpenChange(true)}>{children}</button>
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(DialogContext)
      return context.open ? <div>{children}</div> : null
    },
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  }
})

jest.mock('@/components/ui/select', () => {
  const React = require('react')
  const SelectContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

  return {
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const context = React.useContext(SelectContext)
      return <span>{context.value || placeholder}</span>
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const context = React.useContext(SelectContext)
      return <button type="button" onClick={() => context.onValueChange?.(value)}>{children}</button>
    },
  }
})

const baseProvider = {
  id: 'provider-1',
  name: 'openai-primary',
  displayName: 'OpenAI Primary',
  providerType: 'openai_compat',
  baseUrl: 'https://api.example.com',
  modelId: 'gpt-4o-mini',
  role: 'primary',
  priority: 10,
  isActive: true,
  healthStatus: 'healthy',
  requestCount: 120,
  errorCount: 2,
  avgLatencyMs: 180,
  hasApiKey: true,
  apiKeyEnvVar: 'OPENAI_API_KEY',
  timeoutSeconds: 120,
  maxTokens: 1024,
  temperature: 0.1,
  notes: 'Primary provider',
}

const baseStats = {
  totalProviders: 1,
  activeProviders: 1,
  healthyProviders: 1,
  primaryProvider: 'OpenAI Primary',
  totalRequests: 120,
  totalErrors: 2,
}

function queueInitialFetches({ providers = [baseProvider], stats = baseStats }: { providers?: unknown[]; stats?: typeof baseStats } = {}) {
  fetchMock
    .mockResolvedValueOnce({ json: async () => ({ success: true, providers }) })
    .mockResolvedValueOnce({ json: async () => ({ success: true, stats }) })
}

describe('ProvidersSettingsPanel', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('shows the loading state while providers are still being fetched', async () => {
    let resolveProviders: ((value: unknown) => void) | undefined
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveProviders = resolve
      }))
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ProvidersSettingsPanel />)

    expect(screen.getByText('Loading providers...')).toBeInTheDocument()

    resolveProviders?.({ json: async () => ({ success: true, providers: [baseProvider] }) })

    expect(await screen.findByText('OpenAI Primary')).toBeInTheDocument()
  })

  it('renders provider metrics, the provider table, and the empty state when no providers exist', async () => {
    queueInitialFetches({ providers: [], stats: { ...baseStats, totalProviders: 0, activeProviders: 0, healthyProviders: 0, totalRequests: 0 } })

    render(<ProvidersSettingsPanel />)

    expect(await screen.findByText('No providers configured. Add one to get started.')).toBeInTheDocument()
    expect(screen.getByText('Total Providers')).toBeInTheDocument()
  })

  it('renders provider rows and shows test results after a successful provider probe', async () => {
    queueInitialFetches()
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        result: {
          success: true,
          latencyMs: 42,
          error: null,
        },
      }),
    })

    render(<ProvidersSettingsPanel />)

    expect(await screen.findByText('OpenAI Primary')).toBeInTheDocument()
    expect(screen.getAllByText('120')).toHaveLength(2)
    expect(screen.getByText('180ms')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /test openai primary/i }))

    expect(await screen.findByText(/Test passed/i)).toBeInTheDocument()
    expect(screen.getByText(/42ms/i)).toBeInTheDocument()
  })

  it('shows a user-visible error when the providers list fails to load', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ProvidersSettingsPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load providers')
  })

  it('submits a new provider, refreshes the panel, and renders the saved provider', async () => {
    queueInitialFetches({ providers: [], stats: { ...baseStats, totalProviders: 0, activeProviders: 0, healthyProviders: 0, totalRequests: 0 } })
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, providers: [baseProvider] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ProvidersSettingsPanel />)

    expect(await screen.findByText('No providers configured. Add one to get started.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await userEvent.type(screen.getByLabelText(/name \(unique id\)/i), 'openai-primary')
    await userEvent.type(screen.getByLabelText(/display name/i), 'OpenAI Primary')
    await userEvent.type(screen.getByLabelText(/base url/i), 'https://api.example.com')
    await userEvent.type(screen.getByLabelText(/model id/i), 'gpt-4o-mini')

    const submitButtons = screen.getAllByRole('button', { name: /^add provider$/i })
    await userEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/providers', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })))

    const postCall = fetchMock.mock.calls.find(([url, options]) => url === '/api/admin/providers' && options?.method === 'POST')
    const body = JSON.parse(postCall?.[1]?.body as string)

    expect(body).toMatchObject({
      name: 'openai-primary',
      displayName: 'OpenAI Primary',
      baseUrl: 'https://api.example.com',
      modelId: 'gpt-4o-mini',
      providerType: 'openai_compat',
      role: 'available',
    })

    expect(await screen.findByText('OpenAI Primary')).toBeInTheDocument()
  })

  it('disables provider submission while a save is in flight and prevents duplicate POSTs', async () => {
    queueInitialFetches({ providers: [], stats: { ...baseStats, totalProviders: 0, activeProviders: 0, healthyProviders: 0, totalRequests: 0 } })

    let resolveSave: ((value: unknown) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve
    }))

    render(<ProvidersSettingsPanel />)

    expect(await screen.findByText('No providers configured. Add one to get started.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add provider/i }))
    await userEvent.type(screen.getByLabelText(/name \(unique id\)/i), 'single-submit-provider')
    await userEvent.type(screen.getByLabelText(/display name/i), 'Single Submit Provider')
    await userEvent.type(screen.getByLabelText(/base url/i), 'https://api.example.com')
    await userEvent.type(screen.getByLabelText(/model id/i), 'gpt-4o-mini')

    const submitButton = screen.getAllByRole('button', { name: /^add provider$/i }).at(-1)
    expect(submitButton).toBeDefined()

    await userEvent.click(submitButton!)

    const savingButton = await screen.findByRole('button', { name: /saving/i })
    expect(savingButton).toBeDisabled()

    fireEvent.click(savingButton)

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(([url, options]) => (
        url === '/api/admin/providers' && options?.method === 'POST'
      ))
      expect(postCalls).toHaveLength(1)
    })

    resolveSave?.({ json: async () => ({ success: true }) })
  })
})
