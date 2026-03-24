import { expect, test } from '@playwright/test'
import {
  authenticateViewerSession,
  enterText,
  getChatInput,
  getSendButton,
  gotoHome,
  gotoLogin,
  seedE2EDatabase,
} from './test-helpers'

test.describe('Chat, sources, and sidebar flows', () => {
  test.beforeAll(() => {
    seedE2EDatabase()
  })

  test('renders the landing state and suggested starter prompts', async ({ page }) => {
    await gotoHome(page)

    await expect(page.getByRole('heading', { level: 1, name: /epa punjab/i })).toBeVisible()
    await expect(page.getByText(/environmental knowledge assistant/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /air quality|water resources|biodiversity/i }).first()).toBeVisible()
  })

  test('populates the composer when a suggested question is selected', async ({ page }) => {
    await gotoHome(page)

    const suggestion = page.getByRole('button', { name: /air quality|water resources|biodiversity/i }).first()
    const suggestionText = ((await suggestion.textContent()) || '').trim()

    await suggestion.click()

    await expect(getChatInput(page)).toHaveValue(suggestionText)
  })

  test('sends a chat message, opens the source panel, copies the answer, and saves feedback', async ({ page }) => {
    await authenticateViewerSession(page)

    let chatRequestCount = 0

    await page.route('**/api/chat', async (route) => {
      chatRequestCount += 1
      const payload = chatRequestCount === 1
        ? {
            success: true,
            response: 'Punjab faces sustained air-quality pressure from traffic, crop burning, and industrial emissions.',
            sources: [
              {
                id: 'source-air-quality',
                title: 'Punjab Air Quality Annual Review',
                category: 'Air Quality',
                excerpt: 'Vehicular emissions and crop burning are major contributors to particulate pollution in Punjab.',
                relevanceScore: 0.92,
                year: 2024,
                source: 'Seed Fixture',
              },
            ],
            sessionId: 'mock-session',
            messageId: 'mock-message-1',
            confidence: 0.92,
          }
        : {
            success: true,
            response: 'Updated guidance emphasizes traffic management, cleaner fuels, and enforcement against open burning.',
            sources: [
              {
                id: 'source-air-quality-2',
                title: 'Punjab Air Quality Action Plan',
                category: 'Air Quality',
                excerpt: 'Traffic management and cleaner fuels can materially reduce urban particulate loads.',
                relevanceScore: 0.88,
                year: 2025,
                source: 'Seed Fixture',
              },
            ],
            sessionId: 'mock-session',
            messageId: 'mock-message-2',
            confidence: 0.88,
          }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      })
    })

    await page.route('**/api/feedback', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          feedback: { id: 'feedback-1' },
        }),
      })
    })

    await enterText(getChatInput(page), 'What are the main air-quality risks in Punjab?')
    await getSendButton(page).click()

    await expect(page.getByText(/sustained air-quality pressure/i)).toBeVisible()
    await page.getByText('Copy', { exact: true }).click()

    await page.getByRole('button', { name: /mark response as helpful/i }).click()
    await expect(page.getByText('Feedback saved', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /1 source/i }).first().click()
    await page.waitForFunction(() => {
      const visibleText = (value: string) =>
        Array.from(document.querySelectorAll<HTMLElement>('body *')).some((element) => (
          element.textContent?.trim() === value
          && element.offsetParent !== null
        ))

      return visibleText('High confidence') && visibleText('Punjab Air Quality Annual Review')
    })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /regenerate/i }).click()
    await expect(page.getByText(/updated guidance emphasizes traffic management/i)).toBeVisible()
    await expect(chatRequestCount).toBe(2)
  })

  test('shows a safe error state when the chat request fails', async ({ page }) => {
    await gotoHome(page)

    await page.route('**/api/chat', async (route) => {
      await route.abort()
    })

    await enterText(getChatInput(page), 'Trigger a network failure')
    await getSendButton(page).click()

    await expect(page.getByText('Failed to connect to the server', { exact: true }).first()).toBeVisible()
    await expect(getChatInput(page)).toBeEnabled()
    await expect(getSendButton(page)).toBeDisabled()
  })

  test('loads viewer history, restores a saved session, and deletes it from the sidebar', async ({ page }) => {
    await authenticateViewerSession(page)

    await page.getByRole('tab', { name: /history/i }).click()
    await expect(page.getByText(/neighborhood cleanup ideas/i)).toBeVisible()

    await page.getByText(/neighborhood cleanup ideas/i).click()
    await expect(page.getByText(/prioritize waste segregation/i)).toBeVisible()

    const sessionRow = page.getByText(/neighborhood cleanup ideas/i).locator('..').locator('..')
    await sessionRow.hover()
    await page.getByRole('button', { name: /delete session neighborhood cleanup ideas/i }).click()
    await expect(page.getByText(/neighborhood cleanup ideas/i)).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: /epa punjab/i })).toBeVisible()
  })

  test('filters sidebar documents and shows an empty state when nothing matches', async ({ page }) => {
    await authenticateViewerSession(page)

    await page.getByRole('tab', { name: /docs/i }).click()
    await expect(page.getByText(/citizen guide to cleaner neighborhoods/i)).toBeVisible()

    await page.getByPlaceholder(/search documents/i).fill('no-match-query')
    await expect(page.getByText(/no documents found/i)).toBeVisible()

    await page.getByPlaceholder(/search documents/i).fill('Citizen')
    await expect(page.getByText(/citizen guide to cleaner neighborhoods/i)).toBeVisible()
  })

  test('keeps a very long query in the composer without crashing', async ({ page }) => {
    await gotoHome(page)

    const longQuery = 'Punjab air quality guidance '.repeat(80)
    await enterText(getChatInput(page), longQuery)

    await expect(getChatInput(page)).toHaveValue(longQuery)
  })

  test('allows an authenticated viewer to return from the admin-only login flow to the public home page', async ({ page }) => {
    await gotoLogin(page)
    await enterText(page.getByLabel('Username'), 'testuser')
    await enterText(page.getByLabel('Password'), 'TestPass123!')
    await page.getByRole('button', { name: /sign in to admin/i }).click()

    await expect(page).toHaveURL(/\/403$/, { timeout: 20000 })
    await page.getByRole('link', { name: /back to home/i }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(getChatInput(page)).toBeVisible()
  })
})
