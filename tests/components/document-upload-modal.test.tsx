import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'

const toastMock = jest.fn()
const fetchMock = global.fetch as jest.Mock

jest.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

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
      return (
        <button type="button" onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      )
    },
  }
})

describe('DocumentUploadModal', () => {
  const onOpenChange = jest.fn()
  const onUploadComplete = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    toastMock.mockReset()
    onOpenChange.mockReset()
    onUploadComplete.mockReset()
  })

  it('renders the empty form and keeps upload disabled until required fields are provided', () => {
    render(
      <DocumentUploadModal open={true} onOpenChange={onOpenChange} onUploadComplete={onUploadComplete} />
    )

    expect(screen.getByText('Upload Document')).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('')
    expect(screen.getByLabelText(/content/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled()
  })

  it('autofills the title from the selected filename and posts form data for file uploads', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })

    render(
      <DocumentUploadModal open={true} onOpenChange={onOpenChange} onUploadComplete={onUploadComplete} />
    )

    const file = new File(['report body'], 'Punjab AQI Report.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/^file/i), {
      target: { files: [file] },
    })

    expect(screen.getByLabelText(/title/i)).toHaveValue('Punjab AQI Report')
    expect(screen.getByText(/Punjab AQI Report.pdf/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Air Quality' }))
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, options] = fetchMock.mock.calls[0]
    const body = options.body as FormData

    expect(url).toBe('/api/upload')
    expect(options.method).toBe('POST')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file')).toBe(file)
    expect(body.get('title')).toBe('Punjab AQI Report')
    expect(body.get('category')).toBe('Air Quality')
    expect(body.get('audience')).toBe('General Public')
    expect(body.get('tags')).toBe('[]')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onUploadComplete).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Success',
      description: 'Document uploaded successfully',
    }))
  })

  it('posts JSON for text-only uploads and preserves very long content without crashing', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })
    const longContent = 'A'.repeat(12000)

    render(
      <DocumentUploadModal open={true} onOpenChange={onOpenChange} onUploadComplete={onUploadComplete} />
    )

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Long form submission' } })
    await userEvent.click(screen.getByRole('button', { name: 'Water Resources' }))
    fireEvent.change(screen.getByLabelText(/^content/i), { target: { value: longContent } })
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, options] = fetchMock.mock.calls[0]
    const payload = JSON.parse(options.body as string)

    expect(url).toBe('/api/documents')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(payload).toMatchObject({
      title: 'Long form submission',
      category: 'Water Resources',
      audience: 'General Public',
      tags: [],
    })
    expect(payload.content).toHaveLength(12000)
  })

  it('shows a destructive toast when the upload API returns an error payload', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Upload rejected' }),
    })

    render(
      <DocumentUploadModal open={true} onOpenChange={onOpenChange} onUploadComplete={onUploadComplete} />
    )

    await userEvent.type(screen.getByLabelText(/title/i), 'Rejected upload')
    await userEvent.click(screen.getByRole('button', { name: 'Climate Change' }))
    await userEvent.type(screen.getByLabelText(/^content/i), 'Body text')
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error',
      description: 'Upload rejected',
      variant: 'destructive',
    })))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('shows the loading state while the upload request is in flight', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))

    render(
      <DocumentUploadModal open={true} onOpenChange={onOpenChange} onUploadComplete={onUploadComplete} />
    )

    await userEvent.type(screen.getByLabelText(/title/i), 'Pending upload')
    await userEvent.click(screen.getByRole('button', { name: 'Biodiversity' }))
    await userEvent.type(screen.getByLabelText(/^content/i), 'Pending content')
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }))

    expect(await screen.findByRole('button', { name: /uploading/i })).toBeDisabled()

    resolveRequest?.({
      json: async () => ({ success: true }),
    })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1))
  })
})
