import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/login/page'

const pushMock = jest.fn()
const refreshMock = jest.fn()
const fetchMock = global.fetch as jest.Mock

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    pushMock.mockReset()
    refreshMock.mockReset()
  })

  it('renders the admin login form with required username and password fields', () => {
    render(<LoginPage />)

    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeRequired()
    expect(screen.getByLabelText(/password/i)).toBeRequired()
    expect(screen.getByRole('button', { name: /sign in to admin/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /return to environmentgpt/i })).toHaveAttribute('href', '/')
  })

  it('posts credentials and redirects to the admin dashboard on successful login', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin-user')
    await userEvent.type(screen.getByLabelText(/password/i), 'AdminPass123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in to admin/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body as string)).toEqual({
      username: 'admin-user',
      password: 'AdminPass123!',
    })

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'))
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('shows the authentication alert when the backend rejects the credentials', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    })

    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin-user')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in to admin/i }))

    expect(await screen.findByText('Authentication failed')).toBeInTheDocument()
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows a safe network error when the authentication service cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))

    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin-user')
    await userEvent.type(screen.getByLabelText(/password/i), 'AdminPass123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in to admin/i }))

    expect(await screen.findByText('Unable to contact the authentication service')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows the submitting state while the login request is still pending', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))

    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin-user')
    await userEvent.type(screen.getByLabelText(/password/i), 'AdminPass123!')
    await userEvent.click(screen.getByRole('button', { name: /sign in to admin/i }))

    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled()

    resolveRequest?.({
      ok: true,
      json: async () => ({ success: true }),
    })

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'))
  })
})
