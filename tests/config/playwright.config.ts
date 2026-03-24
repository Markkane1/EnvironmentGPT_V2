// =====================================================
// EPA Punjab EnvironmentGPT - Playwright Configuration
// Phase 8: E2E Testing Setup
// =====================================================

import path from 'path'
import { defineConfig, devices } from '@playwright/test'

const rootDir = path.resolve(__dirname, '../..')

export default defineConfig({
  testDir: path.join(rootDir, 'tests/e2e'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: path.join(rootDir, 'playwright-report') }],
    ['json', { outputFile: path.join(rootDir, 'tests', 'playwright-results.json') }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
  webServer: {
    command: 'node scripts/start-e2e-server.cjs',
    url: 'http://localhost:3000',
    cwd: rootDir,
    reuseExistingServer: false,
    timeout: 180 * 1000,
  },
})
