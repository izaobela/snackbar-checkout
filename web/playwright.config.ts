import { defineConfig, devices } from '@playwright/test'

// Runs against a stack that is already up (make up, or the native API serving web/dist).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8420'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    ...devices['iPad (gen 7) landscape'],
    browserName: 'chromium',
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results',
})
