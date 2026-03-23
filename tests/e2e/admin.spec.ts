import { test, expect } from '@playwright/test'
import { gotoAdmin } from './test-helpers'

test.describe('Admin Dashboard', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await gotoAdmin(page)
  })

  test('renders the dashboard shell and health status', async ({ page }) => {
    await expect(page.getByText(/admin dashboard/i)).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/updated:/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()
  })

  test('shows the key stats cards', async ({ page }) => {
    await expect(page.getByText(/^Documents$/).first()).toBeVisible()
    await expect(page.getByText(/^Chat Sessions$/)).toBeVisible()
    await expect(page.getByText(/^Total Queries$/)).toBeVisible()
    await expect(page.getByText(/^Avg Rating$/)).toBeVisible()
  })

  test('shows the main admin tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /documents/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /analytics/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /feedback/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /system/i })).toBeVisible()
  })

  test('navigates to the documents tab', async ({ page }) => {
    await page.getByRole('tab', { name: /documents/i }).click()

    await expect(page.getByText(/^Document Management$/)).toBeVisible()
    await expect(page.getByPlaceholder(/search documents/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible()
  })

  test('navigates to the analytics and feedback tabs', async ({ page }) => {
    await page.getByRole('tab', { name: /analytics/i }).click()
    await expect(page.getByText(/analytics visualization/i)).toBeVisible()

    await page.getByRole('tab', { name: /feedback/i }).click()
    await expect(page.getByText(/^Recent Feedback$/)).toBeVisible()
  })

  test('shows the system tab shell', async ({ page }) => {
    await page.getByRole('tab', { name: /system/i }).click()

    await expect(page.getByText(/^Services Status$/)).toBeVisible()
    await expect(page.getByText(/^Cache Management$/)).toBeVisible()
  })
})
