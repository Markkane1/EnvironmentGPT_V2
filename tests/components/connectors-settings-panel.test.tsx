import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectorsSettingsPanel } from '@/components/admin/connectors-settings-panel'

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

const baseConnector = {
  id: 'connector-1',
  name: 'punjab-aqi-live',
  displayName: 'Punjab AQI - Live Data',
  connectorType: 'aqi',
  endpointUrl: 'https://api.waqi.info/feed/lahore/?token={api_key}',
  injectAs: 'system_context',
  isActive: true,
  cacheEnabled: true,
  lastFetchedAt: null,
  lastFetchStatus: 'success',
  requestCount: 55,
  errorCount: 1,
  topicMappings: [{ topic: 'air_quality', priority: 100 }],
  hasApiKey: true,
}

const baseStats = {
  totalConnectors: 1,
  activeConnectors: 1,
  connectorsByType: { aqi: 1 },
  totalRequests: 55,
  totalErrors: 1,
}

function queueInitialFetches({ connectors = [baseConnector], stats = baseStats }: { connectors?: unknown[]; stats?: typeof baseStats } = {}) {
  fetchMock
    .mockResolvedValueOnce({ json: async () => ({ success: true, connectors }) })
    .mockResolvedValueOnce({ json: async () => ({ success: true, stats }) })
}

describe('ConnectorsSettingsPanel', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    jest.spyOn(window, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    ;(window.alert as jest.Mock).mockRestore()
  })

  it('shows the loading state while connectors are still being fetched', async () => {
    let resolveConnectors: ((value: unknown) => void) | undefined
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveConnectors = resolve
      }))
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ConnectorsSettingsPanel />)

    expect(screen.getByText('Loading connectors...')).toBeInTheDocument()

    resolveConnectors?.({ json: async () => ({ success: true, connectors: [baseConnector] }) })

    expect(await screen.findByText('Punjab AQI - Live Data')).toBeInTheDocument()
  })

  it('renders the empty state when no connectors are configured', async () => {
    queueInitialFetches({ connectors: [], stats: { ...baseStats, totalConnectors: 0, activeConnectors: 0, connectorsByType: { aqi: 0 }, totalRequests: 0 } })

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByText(/no connectors configured/i)).toBeInTheDocument()
    expect(screen.getByText('Total Connectors')).toBeInTheDocument()
  })

  it('prefills the AQI example and supports adding another topic mapping in the connector form', async () => {
    queueInitialFetches({ connectors: [], stats: { ...baseStats, totalConnectors: 0, activeConnectors: 0, connectorsByType: { aqi: 0 }, totalRequests: 0 } })

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByText(/no connectors configured/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add connector/i }))
    await userEvent.click(screen.getByRole('button', { name: /pre-fill punjab aqi example/i }))

    expect(screen.getByLabelText(/name \(unique id\)/i)).toHaveValue('punjab-aqi-live')
    expect(screen.getByLabelText(/endpoint url/i)).toHaveValue('https://api.waqi.info/feed/lahore/?token={api_key}')
    expect(screen.getByLabelText(/api key env variable/i)).toHaveValue('WAQI_API_KEY')

    await userEvent.click(screen.getByRole('button', { name: /add topic/i }))

    expect(screen.getAllByRole('spinbutton')).toHaveLength(3)
  })

  it('shows a user-visible error when the connectors list fails to load', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load connectors')
  })

  it('shows connector test details after a failed connector probe', async () => {
    queueInitialFetches()
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        result: {
          success: false,
          error: 'Upstream timeout',
          latencyMs: 87,
        },
      }),
    })

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByText('Punjab AQI - Live Data')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /test punjab aqi - live data/i }))

    expect(await screen.findByText(/connector test failed/i)).toBeInTheDocument()
    expect(screen.getByText('Upstream timeout')).toBeInTheDocument()
    expect(screen.getByText('87ms')).toBeInTheDocument()
  })

  it('submits a new connector, refreshes the panel, and renders the saved connector', async () => {
    queueInitialFetches({ connectors: [], stats: { ...baseStats, totalConnectors: 0, activeConnectors: 0, connectorsByType: { aqi: 0 }, totalRequests: 0 } })
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, connectors: [baseConnector] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, stats: baseStats }) })

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByText(/no connectors configured/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add connector/i }))
    await userEvent.type(screen.getByLabelText(/name \(unique id\)/i), 'punjab-aqi-live')
    await userEvent.type(screen.getByLabelText(/display name/i), 'Punjab AQI - Live Data')
    fireEvent.change(screen.getByLabelText(/endpoint url/i), { target: { value: 'https://api.waqi.info/feed/lahore/?token={api_key}' } })

    const submitButtons = screen.getAllByRole('button', { name: /^add connector$/i })
    await userEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/connectors', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })))

    const postCall = fetchMock.mock.calls.find(([url, options]) => url === '/api/admin/connectors' && options?.method === 'POST')
    const body = JSON.parse(postCall?.[1]?.body as string)

    expect(body).toMatchObject({
      name: 'punjab-aqi-live',
      displayName: 'Punjab AQI - Live Data',
      endpointUrl: 'https://api.waqi.info/feed/lahore/?token={api_key}',
      connectorType: 'aqi',
      injectAs: 'system_context',
    })
    expect(body.topics).toEqual([{ topic: 'air_quality', priority: 100 }])

    expect(await screen.findByText('Punjab AQI - Live Data')).toBeInTheDocument()
  })

  it('disables connector submission while a save is in flight and prevents duplicate POSTs', async () => {
    queueInitialFetches({ connectors: [], stats: { ...baseStats, totalConnectors: 0, activeConnectors: 0, connectorsByType: { aqi: 0 }, totalRequests: 0 } })

    let resolveSave: ((value: unknown) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve
    }))

    render(<ConnectorsSettingsPanel />)

    expect(await screen.findByText(/no connectors configured/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add connector/i }))
    await userEvent.type(screen.getByLabelText(/name \(unique id\)/i), 'single-submit-connector')
    await userEvent.type(screen.getByLabelText(/display name/i), 'Single Submit Connector')
    fireEvent.change(screen.getByLabelText(/endpoint url/i), { target: { value: 'https://example.com/environment' } })

    const submitButton = screen.getAllByRole('button', { name: /^add connector$/i }).at(-1)
    expect(submitButton).toBeDefined()

    await userEvent.click(submitButton!)

    const savingButton = await screen.findByRole('button', { name: /saving/i })
    expect(savingButton).toBeDisabled()

    fireEvent.click(savingButton)

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(([url, options]) => (
        url === '/api/admin/connectors' && options?.method === 'POST'
      ))
      expect(postCalls).toHaveLength(1)
    })

    resolveSave?.({ json: async () => ({ success: true }) })
  })
})
