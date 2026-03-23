import { test, expect } from '@playwright/test'
import { getChatInput, getSendButton, gotoAdmin, gotoHome, sendMessage } from './test-helpers'

test.describe('Accessibility Smoke Tests', () => {
  test('home page exposes the primary landmark and heading', async ({ page }) => {
    await gotoHome(page)

    await expect(page.getByRole('heading', { level: 1, name: /epa punjab/i })).toBeVisible()
    await expect(page.getByText(/environmental knowledge assistant/i)).toBeVisible()
  })

  test('admin page exposes the primary landmark and heading', async ({ page }) => {
    await gotoAdmin(page)

    await expect(page.getByText(/environmentgpt management/i)).toBeVisible({ timeout: 60_000 })
  })

  test('keyboard navigation reaches visible interactive controls', async ({ page }) => {
    await gotoHome(page)

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('chat composer exposes an accessible send action', async ({ page }) => {
    await gotoHome(page)

    await expect(getChatInput(page)).toHaveAttribute('placeholder', /ask about environmental issues/i)
    await expect(getSendButton(page)).toHaveAccessibleName(/send message/i)
  })

  test('primary navigation buttons have discernible names', async ({ page }) => {
    await gotoHome(page)

    await expect(page.getByRole('link', { name: /epa punjab/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible()
  })

  test('response actions remain accessible after sending a query', async ({ page }) => {
    await gotoHome(page)
    await sendMessage(page, 'What are the NEQS standards in Punjab?')

    await expect(page.getByRole('button', { name: /copy/i }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: /mark response as helpful/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /mark response as not helpful/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /source/i }).last()).toBeVisible()
  })
})
