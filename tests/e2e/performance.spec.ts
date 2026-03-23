import { test, expect } from '@playwright/test'
import { getChatInput, getSendButton, gotoAdmin, gotoHome, sendMessage } from './test-helpers'

test.describe('Performance and Resilience Smoke Tests', () => {
  test('home page renders within an acceptable development threshold', async ({ page }) => {
    const start = Date.now()
    await gotoHome(page)
    expect(Date.now() - start).toBeLessThan(20_000)
  })

  test('admin page renders within an acceptable development threshold', async ({ page }) => {
    const start = Date.now()
    await gotoAdmin(page)
    expect(Date.now() - start).toBeLessThan(25_000)
  })

  test('chat responses complete within an acceptable threshold', async ({ page }) => {
    await gotoHome(page)
    const start = Date.now()
    await sendMessage(page, 'What is air quality?')
    expect(Date.now() - start).toBeLessThan(30_000)
  })

  test('home page load does not emit unexpected console errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await gotoHome(page)

    const unexpectedErrors = errors.filter((error) =>
      !error.includes('extension') &&
      !error.includes('ERR_BLOCKED_BY_CLIENT')
    )

    expect(unexpectedErrors).toEqual([])
  })

  test('rapid composer edits keep the latest value', async ({ page }) => {
    await gotoHome(page)

    for (let i = 0; i < 5; i++) {
      await getChatInput(page).fill(`Query ${i}`)
    }

    await expect(getChatInput(page)).toHaveValue('Query 4')
  })

  test('navigation between home and admin keeps the app interactive', async ({ page }) => {
    await gotoHome(page)
    await gotoAdmin(page)
    await gotoHome(page)

    await expect(getChatInput(page)).toBeVisible()
    await expect(getSendButton(page)).toBeDisabled()
  })

  test('home page still renders under a slow network shim', async ({ page }) => {
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      await route.continue()
    })

    await gotoHome(page)
  })

  test('chat gracefully reports an API failure and recovers the composer', async ({ page }) => {
    await gotoHome(page)

    await page.route('**/api/chat', (route) => route.abort())
    await getChatInput(page).fill('Trigger a network failure')
    await getSendButton(page).click()

    await expect(page.getByText('Failed to connect to the server', { exact: true }).first()).toBeVisible()
    await expect(getChatInput(page)).toBeEnabled()
    await expect(getSendButton(page)).toBeDisabled()
  })
})
