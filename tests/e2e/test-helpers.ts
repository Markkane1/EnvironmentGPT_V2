import { expect, Page } from '@playwright/test'

export function getChatInput(page: Page) {
  return page.getByPlaceholder(/ask about environmental issues in punjab/i)
}

export function getSendButton(page: Page) {
  return page.getByRole('button', { name: /send message/i })
}

export async function gotoHome(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(getChatInput(page)).toBeVisible()
}

export async function gotoAdmin(page: Page) {
  await page.goto('/admin')
  await expect(page.getByRole('main', { name: /admin dashboard/i })).toBeVisible()
}

export async function sendMessage(page: Page, message: string) {
  const input = getChatInput(page)
  const sendButton = getSendButton(page)

  await expect(input).toBeVisible()
  await input.click()
  await input.clear()
  await input.type(message)
  await expect(input).toHaveValue(message)
  await expect(sendButton).toBeEnabled()
  await sendButton.click()

  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy' }).last()).toBeVisible({
    timeout: 30_000,
  })
}
