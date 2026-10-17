import { defineConfig } from '@playwright/test';

const PORT = 4411;
// Set BASE_URL (e.g. https://huttese.benrichardson.dev) to test a deployed site instead of a local production build.
const remote = process.env.BASE_URL;

// End-to-end tests run against the production build (astro preview of dist/), driving the installed Google Chrome.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: remote ?? `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: false } },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npm run build && npx astro preview --ignore-lock --host 127.0.0.1 --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
