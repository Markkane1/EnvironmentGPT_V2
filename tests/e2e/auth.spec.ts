import { test, expect } from '@playwright/test'
import {
  authenticateAdminSession,
  enterText,
  expectRedirectToLogin,
  gotoLogin,
  loginAsAdmin,
  loginAsViewer,
  seedE2EDatabase,
} from './test-helpers'

test.describe('Authentication flows', () => {
  test.beforeAll(async ({ request }) => {
    seedE2EDatabase()
    await request.get('/login')
    await request.get('/403')
  })

  test('logs an admin user in and redirects to the admin dashboard', async ({ page }) => {
    await loginAsAdmin(page)

    await expect(page.getByRole('main', { name: /admin dashboard/i })).toBeVisible()
  })

  test('shows an auth error for a wrong password and keeps the user on the login page', async ({ page }) => {
    await gotoLogin(page)
    await enterText(page.getByLabel('Username'), 'admin')
    await enterText(page.getByLabel('Password'), 'WrongPass123!')
    await page.getByRole('button', { name: /sign in to admin/i }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(/authentication failed/i)).toBeVisible()
    await expect(page.getByText(/invalid username or password/i)).toBeVisible()
  })

  test('shows an auth error for a non-existent username', async ({ page }) => {
    await gotoLogin(page)
    await enterText(page.getByLabel('Username'), 'missing-user')
    await enterText(page.getByLabel('Password'), 'AdminPass123!')
    await page.getByRole('button', { name: /sign in to admin/i }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(/invalid username or password/i)).toBeVisible()
  })

  test('blocks empty login submission with browser validation', async ({ page }) => {
    await gotoLogin(page)
    await page.getByRole('button', { name: /sign in to admin/i }).click()

    const usernameField = page.getByLabel('Username')
    await expect(page).toHaveURL(/\/login$/)
    await expect(usernameField).toBeFocused()
    const validationMessage = await usernameField.evaluate((element) => (
      (element as HTMLInputElement).validationMessage
    ))
    expect(validationMessage.length).toBeGreaterThan(0)
  })

  test('redirects a logged-in non-admin user to the forbidden page', async ({ page }) => {
    await loginAsViewer(page)

    await expect(page).toHaveURL(/\/403$/)
    await expect(page.getByText(/access restricted/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in as admin/i })).toBeVisible()
  })

  test('redirects logged-out users away from protected admin routes', async ({ page }) => {
    await page.goto('/admin')

    await expectRedirectToLogin(page)
  })

  test('logs out through the admin UI and denies subsequent access to the admin route', async ({ page }) => {
    await authenticateAdminSession(page)

    const signOutButton = page.getByRole('button', { name: /sign out/i }).first()
    await signOutButton.scrollIntoViewIfNeeded()
    await signOutButton.click({ force: true })

    await expectRedirectToLogin(page)

    await page.goto('/admin')
    await expectRedirectToLogin(page)
  })

  test('redirects to login after the auth cookies are removed mid-session', async ({ page, context }) => {
    await authenticateAdminSession(page)

    await context.clearCookies()
    await page.goto('/admin')

    await expectRedirectToLogin(page)
  })
})
