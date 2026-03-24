import { expect, test } from '@playwright/test'
import {
  authenticateAdminSession,
  expectRedirectToLogin,
  goToAdminTab,
  gotoHome,
  gotoLogin,
  seedE2EDatabase,
  uniqueValue,
} from './test-helpers'

test.describe('AI-code hygiene regressions', () => {
  test.beforeAll(() => {
    seedE2EDatabase()
  })

  test('prevents duplicate submits for provider and connector admin forms', async ({ page }) => {
    const providerName = uniqueValue('provider')
    const providerDisplayName = `Provider ${providerName}`
    const connectorName = uniqueValue('connector')
    const connectorDisplayName = `Connector ${connectorName}`

    await authenticateAdminSession(page)

    await goToAdminTab(page, /providers/i)
    await page.getByRole('button', { name: /add provider/i }).click()

    await page.getByLabel(/name \(unique id\)/i).fill(providerName)
    await page.getByLabel(/display name/i).fill(providerDisplayName)
    await page.getByLabel(/base url/i).fill('https://api.example.com')
    await page.getByLabel(/model id/i).fill('gpt-4o-mini')

    const addProviderButton = page.getByRole('dialog').getByRole('button', { name: /^add provider$/i })
    await addProviderButton.scrollIntoViewIfNeeded()
    await addProviderButton.dblclick()
    await expect(page.getByText(providerDisplayName)).toHaveCount(1, { timeout: 10000 })

    await goToAdminTab(page, /connectors/i)
    await page.getByRole('button', { name: /add connector/i }).click()

    await page.getByLabel(/name \(unique id\)/i).fill(connectorName)
    await page.getByLabel(/display name/i).fill(connectorDisplayName)
    await page.getByLabel(/endpoint url/i).fill('https://example.com/environment')

    const addConnectorButton = page.getByRole('dialog').getByRole('button', { name: /^add connector$/i })
    await addConnectorButton.scrollIntoViewIfNeeded()
    await addConnectorButton.dblclick()
    await expect(page.getByText(connectorDisplayName)).toHaveCount(1, { timeout: 10000 })
  })

  test('loads every page without console errors, page crashes, or unhandled promise errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await gotoHome(page)
    await page.waitForTimeout(250)
    expect(errors).toEqual([])

    errors.length = 0
    await gotoLogin(page)
    await page.waitForTimeout(250)
    expect(errors).toEqual([])

    errors.length = 0
    await page.goto('/403', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/access restricted/i)).toBeVisible()
    await page.waitForTimeout(250)
    expect(errors).toEqual([])

    errors.length = 0
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /preferences/i })).toBeVisible()
    await page.waitForTimeout(250)
    expect(errors).toEqual([])

    errors.length = 0
    await authenticateAdminSession(page)
    await page.waitForTimeout(250)
    expect(errors).toEqual([])

    errors.length = 0
    await page.context().clearCookies()
    await page.goto('/admin')
    await expectRedirectToLogin(page)
    await page.waitForTimeout(250)
    expect(errors).toEqual([])
  })
})
