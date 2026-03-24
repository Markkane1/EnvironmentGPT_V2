import { expect, test } from '@playwright/test'
import {
  authenticateAdminSession,
  goToAdminTab,
  seedE2EDatabase,
  selectRadixOption,
  uniqueValue,
} from './test-helpers'

test.describe('Admin dashboard and CRUD flows', () => {
  test.beforeAll(async ({ request }) => {
    seedE2EDatabase()
    await request.get('/login')
    await request.get('/admin')
  })

  test('renders seeded dashboard stats and previews a seeded document', async ({ page }) => {
    await authenticateAdminSession(page)

    await goToAdminTab(page, /documents/i)
    await expect(page.getByText(/^title$/i)).toBeVisible()
    await expect(page.getByText(/punjab air quality annual review/i)).toBeVisible()
    await page.getByRole('button', { name: /view document punjab air quality annual review/i }).click()
    await expect(page.getByText(/loading document/i)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toContainText(/vehicular emissions and crop burning/i)
  })

  test('creates and deletes a text document from the upload modal', async ({ page }) => {
    const documentTitle = `E2E Document ${uniqueValue('doc')}`

    await authenticateAdminSession(page)
    await goToAdminTab(page, /documents/i)
    await page.getByRole('button', { name: /^upload$/i }).click()

    await page.getByLabel(/^title \*$/i).fill(documentTitle)
    await selectRadixOption(
      page,
      page.getByRole('combobox').filter({ has: page.getByText(/select category/i) }).first(),
      'Air Quality'
    )
    await page.getByLabel(/^content/i).fill(
      'This document was created by Playwright to verify admin document uploads and includes enough detail to satisfy the backend validation rules for minimum content length.'
    )
    const uploadButton = page.getByRole('dialog').getByRole('button', { name: /^upload$/i })
    await uploadButton.scrollIntoViewIfNeeded()
    await uploadButton.click()

    await expect(page.getByText(documentTitle)).toBeVisible({ timeout: 10000 })

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: new RegExp(`Delete document ${documentTitle}`, 'i') }).click()
    await expect(page.getByText('Document deleted', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: new RegExp(`Delete document ${documentTitle}`, 'i') })
    ).toHaveCount(0, { timeout: 15000 })
  })

  test('creates, updates, toggles, and deletes a provider', async ({ page }) => {
    const providerName = uniqueValue('provider')
    const providerDisplayName = `Provider ${providerName}`
    const updatedDisplayName = `${providerDisplayName} Updated`

    await authenticateAdminSession(page)
    await goToAdminTab(page, /providers/i)
    await page.getByRole('button', { name: /add provider/i }).click()

    await page.getByLabel(/name \(unique id\)/i).fill(providerName)
    await page.getByLabel(/display name/i).fill(providerDisplayName)
    await page.getByLabel(/base url/i).fill('https://api.example.com')
    await page.getByLabel(/model id/i).fill('gpt-4o-mini')
    const addProviderButton = page.getByRole('dialog').getByRole('button', { name: /add provider/i })
    await addProviderButton.scrollIntoViewIfNeeded()
    await addProviderButton.click({ force: true })

    await expect(page.getByText(providerDisplayName)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: new RegExp(`Edit ${providerDisplayName}`, 'i') }).click()
    await page.getByLabel(/display name/i).fill(updatedDisplayName)
    const updateProviderButton = page.getByRole('dialog').getByRole('button', { name: /update provider/i })
    await updateProviderButton.scrollIntoViewIfNeeded()
    await updateProviderButton.click({ force: true })

    await expect(page.getByText(updatedDisplayName)).toBeVisible({ timeout: 10000 })

    const providerToggle = page.getByRole('switch', { name: new RegExp(`Toggle ${updatedDisplayName}`, 'i') })
    await expect(providerToggle).toHaveAttribute('aria-checked', 'true')
    await providerToggle.click()
    await expect(providerToggle).toHaveAttribute('aria-checked', 'false')

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: new RegExp(`Delete ${updatedDisplayName}`, 'i') }).click()
    await expect(
      page.getByRole('switch', { name: new RegExp(`Toggle ${updatedDisplayName}`, 'i') })
    ).toHaveAttribute('aria-checked', 'false')
  })

  test('shows a visible provider error state when provider loading fails', async ({ page }) => {
    await authenticateAdminSession(page)
    await page.route('**/api/admin/providers**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Injected provider failure' }),
      })
    })

    await page.goto('/admin')
    await goToAdminTab(page, /providers/i)

    await expect(
      page.getByRole('tabpanel', { name: /providers/i }).getByRole('alert')
    ).toContainText(/injected provider failure|failed to load providers/i)
  })

  test('creates, updates, tests, toggles, and deletes a connector', async ({ page }) => {
    const connectorName = uniqueValue('connector')
    const connectorDisplayName = `Connector ${connectorName}`
    const updatedDisplayName = `${connectorDisplayName} Updated`

    await authenticateAdminSession(page)
    await goToAdminTab(page, /connectors/i)
    await page.getByRole('button', { name: /add connector/i }).click()

    await page.getByLabel(/name \(unique id\)/i).fill(connectorName)
    await page.getByLabel(/display name/i).fill(connectorDisplayName)
    await page.getByLabel(/endpoint url/i).fill('https://example.com/environment')
    const addConnectorButton = page.getByRole('dialog').getByRole('button', { name: /add connector/i })
    await addConnectorButton.scrollIntoViewIfNeeded()
    await addConnectorButton.click({ force: true })

    await expect(page.getByText(connectorDisplayName)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: new RegExp(`Edit ${connectorDisplayName}`, 'i') }).click()
    await page.getByLabel(/display name/i).fill(updatedDisplayName)
    const updateConnectorButton = page.getByRole('dialog').getByRole('button', { name: /update connector/i })
    await updateConnectorButton.scrollIntoViewIfNeeded()
    await updateConnectorButton.click({ force: true })

    await expect(page.getByText(updatedDisplayName)).toBeVisible({ timeout: 10000 })

    await page.route('**/api/admin/connectors?action=test**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          result: {
            success: true,
            latencyMs: 123,
            data: { aqi: 87, city: 'Lahore' },
          },
        }),
      })
    })

    await page.getByRole('button', { name: new RegExp(`Test ${updatedDisplayName}`, 'i') }).click()
    await expect(page.getByRole('dialog')).toContainText(/connector responded successfully/i)
    await expect(page.getByRole('dialog')).toContainText(/lahore/i)
    await page.keyboard.press('Escape')

    const connectorToggle = page.getByRole('switch', { name: new RegExp(`Toggle ${updatedDisplayName}`, 'i') })
    await expect(connectorToggle).toHaveAttribute('aria-checked', 'true')
    await connectorToggle.click()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: new RegExp(`Delete ${updatedDisplayName}`, 'i') }).click()
    await expect(
      page.getByRole('button', { name: new RegExp(`Delete ${updatedDisplayName}`, 'i') })
    ).toHaveCount(0)
  })

  test('shows a visible connector error state when connector loading fails', async ({ page }) => {
    await authenticateAdminSession(page)
    await page.route('**/api/admin/connectors**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Injected connector failure' }),
      })
    })

    await page.goto('/admin')
    await goToAdminTab(page, /connectors/i)

    await expect(
      page.getByRole('tabpanel', { name: /connectors/i }).getByRole('alert')
    ).toContainText(/injected connector failure|failed to load connectors/i)
  })

  test('clears cache from the system tab', async ({ page }) => {
    await authenticateAdminSession(page)
    await goToAdminTab(page, /system/i)

    await page.getByRole('button', { name: /clear cache/i }).click()
    await expect(page.getByText(/cached items/i)).toBeVisible()
  })
})
