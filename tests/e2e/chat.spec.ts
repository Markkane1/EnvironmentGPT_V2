import { test, expect } from '@playwright/test'
import { getChatInput, getSendButton, gotoHome, sendMessage } from './test-helpers'

test.describe('EnvironmentGPT Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('renders the landing state and suggested questions', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /epa punjab/i })).toBeVisible()
    await expect(page.getByText(/environmental knowledge assistant/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /air quality|water|pollution|climate/i }).first()).toBeVisible()
  })

  test('clicking a suggestion populates the chat composer', async ({ page }) => {
    const suggestion = page.getByRole('button', { name: /air quality|water|pollution/i }).first()
    const suggestionText = (await suggestion.textContent())?.trim() || ''

    await suggestion.click()
    await expect(getChatInput(page)).toHaveValue(suggestionText)
  })

  test('sends a query and renders a response with sources', async ({ page }) => {
    await sendMessage(page, 'What are the main sources of air pollution in Punjab?')

    await expect(page.getByText(/air quality|vehicular emissions|industrial pollution/i).last()).toBeVisible()
    await expect(page.getByRole('button', { name: /source/i }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: /copy/i }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: /regenerate/i })).toBeVisible()
  })

  test('starts a new chat after a completed response', async ({ page }) => {
    await sendMessage(page, 'What is smog?')

    await page.getByRole('button', { name: /start new chat/i }).click()
    await expect(page.getByRole('heading', { level: 1, name: /epa punjab/i })).toBeVisible()
    await expect(page.getByText('What is smog?')).toHaveCount(0)
  })
})

test.describe('Chat Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('keeps the send button disabled for empty input', async ({ page }) => {
    await getChatInput(page).clear()
    await expect(getSendButton(page)).toBeDisabled()
  })

  test('accepts long queries', async ({ page }) => {
    const longQuery = 'What is the air quality in Punjab? '.repeat(30)

    await getChatInput(page).fill(longQuery)
    await expect(getChatInput(page)).toHaveValue(longQuery)
  })

  test('retains special characters in the composer', async ({ page }) => {
    const specialQuery = 'What is PM2.5? <script>alert(\"test\")</script>'

    await getChatInput(page).fill(specialQuery)
    await expect(getChatInput(page)).toHaveValue(specialQuery)
  })
})

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('renders the chat composer on mobile', async ({ page }) => {
    await gotoHome(page)

    await expect(getChatInput(page)).toBeVisible()
    await getChatInput(page).fill('Mobile test query')
    await expect(getChatInput(page)).toHaveValue('Mobile test query')
  })

  test('keeps the send button large enough for touch targets', async ({ page }) => {
    await gotoHome(page)

    const box = await getSendButton(page).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(40)
    expect(box?.width).toBeGreaterThanOrEqual(40)
  })
})
