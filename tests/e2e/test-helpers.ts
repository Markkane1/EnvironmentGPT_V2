import { execFileSync } from 'child_process'
import path from 'path'
import { expect, Locator, Page } from '@playwright/test'

const rootDir = path.resolve(__dirname, '../..')
const tsNodeCli = path.join(rootDir, 'node_modules', 'ts-node', 'dist', 'bin.js')
const seedScript = path.join(rootDir, 'tests', 'e2e', 'seed.ts')
const accessTokenCookieName = 'token'
const refreshTokenCookieName = 'refreshToken'
let cachedAdminSession: { accessToken: string; refreshToken: string } | null = null
let cachedViewerSession: { accessToken: string; refreshToken: string } | null = null

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const user = process.env.POSTGRES_USER || 'postgres'
  const password = process.env.POSTGRES_PASSWORD || 'root123'
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = process.env.POSTGRES_PORT || '5432'
  const database = process.env.POSTGRES_DB || 'environmentgpt'

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`
}

export function seedE2EDatabase() {
  cachedAdminSession = null
  cachedViewerSession = null

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      execFileSync(process.execPath, [
        tsNodeCli,
        '--transpile-only',
        '--compiler-options',
        '{"module":"NodeNext","moduleResolution":"NodeNext"}',
        seedScript,
      ], {
        cwd: rootDir,
        env: {
          ...process.env,
          DATABASE_URL: getDatabaseUrl(),
          JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret',
        },
        stdio: 'inherit',
      })

      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000 * (attempt + 1))
    }
  }

  throw lastError ?? new Error('E2E seed failed')
}

export function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getChatInput(page: Page) {
  return page.getByPlaceholder(/ask about environmental issues in punjab/i)
}

export function getSendButton(page: Page) {
  return page.getByRole('button', { name: /send message/i })
}

export async function enterText(locator: Locator, value: string) {
  await locator.click()
  await locator.fill('')
  await locator.fill(value)

  await expect(locator).toHaveValue(value)
}

async function waitForReactHydration(page: Page, selector: string) {
  await page.waitForFunction((targetSelector) => {
    const target = document.querySelector(targetSelector)

    if (!target) {
      return false
    }

    return Object.keys(target).some((key) => (
      key.startsWith('__reactFiber') || key.startsWith('__reactProps')
    ))
  }, selector)
}

export async function gotoHome(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('main')).toBeVisible()
  await expect(getChatInput(page)).toBeVisible()
  await waitForReactHydration(page, 'textarea')
}

export async function gotoLogin(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await waitForReactHydration(page, 'form')
}

export async function loginThroughUi(page: Page, username: string, password: string) {
  await gotoLogin(page)
  await enterText(page.getByLabel('Username'), username)
  await enterText(page.getByLabel('Password'), password)
  await page.getByRole('button', { name: /sign in to admin/i }).click()
}

export async function loginAsAdmin(page: Page) {
  await loginThroughUi(page, 'admin', 'AdminPass123!')
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20000 })
  await expect(page.getByRole('main', { name: /admin dashboard/i })).toBeVisible({ timeout: 20000 })
}

async function authenticateSession(
  page: Page,
  credentials: { username: string; password: string },
  cachedSession: { accessToken: string; refreshToken: string } | null
) {
  let session = cachedSession

  if (!session) {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    const payload = await response.json()
    const setCookieHeader = response.headers.get('set-cookie')
    const accessToken = extractCookie(setCookieHeader, accessTokenCookieName)
    const refreshToken = extractCookie(setCookieHeader, refreshTokenCookieName)

    if (!response.ok || !accessToken || !refreshToken) {
      throw new Error(`Failed to establish session: ${JSON.stringify(payload)}`)
    }

    session = {
      accessToken,
      refreshToken,
    }
  }

  await page.context().addCookies([
    {
      name: accessTokenCookieName,
      value: session.accessToken,
      url: 'http://localhost:3000',
    },
    {
      name: refreshTokenCookieName,
      value: session.refreshToken,
      url: 'http://localhost:3000',
    },
  ])

  return session
}

function extractCookie(setCookieHeader: string | null, cookieName: string): string | null {
  if (!setCookieHeader) {
    return null
  }

  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
  return match?.[1] ?? null
}

export async function authenticateAdminSession(page: Page) {
  cachedAdminSession = await authenticateSession(page, {
    username: 'admin',
    password: 'AdminPass123!',
  }, cachedAdminSession)

  await page.goto('/admin', { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20000 })
  await expect(page.locator('main')).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('tab', { name: /documents/i })).toBeVisible({ timeout: 20000 })
}

export async function loginAsViewer(page: Page) {
  await loginThroughUi(page, 'testuser', 'TestPass123!')
  await expect(page).toHaveURL(/\/403$/, { timeout: 20000 })
}

export async function authenticateViewerSession(page: Page) {
  cachedViewerSession = await authenticateSession(page, {
    username: 'testuser',
    password: 'TestPass123!',
  }, cachedViewerSession)

  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20000 })
}

export async function expectRedirectToLogin(page: Page) {
  await expect(page).toHaveURL(/\/login$/, { timeout: 20000 })
  await expect(page.getByRole('button', { name: /sign in to admin/i })).toBeVisible()
}

export async function gotoAdmin(page: Page) {
  await page.goto('/admin', { waitUntil: 'commit' })
  await expect(page.getByRole('main', { name: /admin dashboard/i })).toBeVisible()
}

export async function goToAdminTab(page: Page, name: RegExp | string) {
  const tab = page.getByRole('tab', { name })
  await expect(tab).toBeVisible({ timeout: 20000 })
  await tab.scrollIntoViewIfNeeded()
  await tab.click({ force: true })
}

export async function selectRadixOption(page: Page, trigger: ReturnType<Page['locator']>, optionName: string) {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}

export async function sendMockedChatMessage(page: Page, message: string) {
  const input = getChatInput(page)

  await enterText(input, message)
  await expect(getSendButton(page)).toBeEnabled()
  await getSendButton(page).click()

  await expect(page.getByText(message, { exact: true })).toBeVisible()
}
