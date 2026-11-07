/**
 * Browser-Tests (End-to-End) mit Playwright.
 * Getestet wird die laufende App – standardmäßig der Docker-Container:
 *   docker compose up -d --build
 *   npm run test:e2e                         (oder E2E_BASE_URL=http://… setzen)
 */
import { defineConfig, devices } from '@playwright/test';

const gpuArgs = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 900 }, launchOptions: { args: gpuArgs } } },
    { name: 'mobil', use: { ...devices['Pixel 5'], launchOptions: { args: gpuArgs } }, grep: /@mobil/ },
  ],
});
