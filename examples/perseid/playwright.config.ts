import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: '../../test-results/perseid',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5198',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.SPECTRA_CHROMIUM_PATH
      ? { executablePath: process.env.SPECTRA_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npm run preview:perseid -- --port 5198 --strictPort',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
  },
})
