import React from 'react'
import { render, screen } from '@testing-library/react'
import AdminPage from '@/app/admin/page'
import SettingsPage from '@/app/settings/page'

jest.mock('@/components/admin/enhanced-dashboard', () => ({
  EnhancedAdminDashboard: () => <div>Admin dashboard body</div>,
}))

jest.mock('@/components/settings/settings-panel', () => ({
  SettingsPanel: () => <div>Settings body</div>,
}))

describe('Page wrappers', () => {
  it('renders the admin page inside a main landmark', () => {
    render(<AdminPage />)

    expect(screen.getByRole('main', { name: /admin dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('Admin dashboard body')).toBeInTheDocument()
  })

  it('renders the settings page inside a main landmark', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('main', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByText('Settings body')).toBeInTheDocument()
  })
})
