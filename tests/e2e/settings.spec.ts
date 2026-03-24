import { expect, test } from '@playwright/test'
import { authenticateAdminSession, seedE2EDatabase } from './test-helpers'

test.describe('Settings flows', () => {
  test.beforeAll(() => {
    seedE2EDatabase()
  })

  test('saves chat settings and persists them after reload', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /preferences/i })).toBeVisible()

    const historyInput = page.getByRole('spinbutton')
    const showSourcesSwitch = page.getByRole('switch')

    await historyInput.fill('3')
    await expect(historyInput).toHaveValue('3')

    await showSourcesSwitch.click()
    await expect(showSourcesSwitch).toHaveAttribute('aria-checked', 'false')

    await page.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText('Settings saved', { exact: true }).first()).toBeVisible()
    await expect(historyInput).toHaveValue('3')
    await expect(showSourcesSwitch).toHaveAttribute('aria-checked', 'false')
    await page.reload()

    await expect(historyInput).toHaveValue('3')
    await expect(showSourcesSwitch).toHaveAttribute('aria-checked', 'false')
  })

  test('exports stats successfully for an authenticated admin', async ({ page }) => {
    await authenticateAdminSession(page)

    await page.route('**/api/export?type=stats&format=json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exportedAt: '2026-03-24T00:00:00Z', stats: { documents: 3 } }),
      })
    })

    await page.goto('/settings')
    await page.getByRole('button', { name: /export/i }).click()

    await expect(page.getByText('Export complete', { exact: true }).first()).toBeVisible()
  })

  test('shows a safe error state when export fails', async ({ page }) => {
    await page.goto('/settings')
    await page.route('**/api/export?type=stats&format=json', async (route) => {
      await route.abort()
    })

    await page.getByRole('button', { name: /export/i }).click()
    await expect(page.getByText('Export failed', { exact: true }).first()).toBeVisible()
  })

  test('clears local data and resets settings to defaults', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /preferences/i })).toBeVisible()

    await page.getByRole('spinbutton').fill('7')
    await page.getByRole('switch').click()
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText('Settings saved', { exact: true }).first()).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /^clear$/i }).click()

    await expect(page.getByText('Data cleared', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('spinbutton')).toHaveValue('10')
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
