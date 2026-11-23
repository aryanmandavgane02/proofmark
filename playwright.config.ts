import { defineConfig, devices } from "@playwright/test";

// The main journeys, also run in Safari's engine (WebKit), Firefox and on phones: ALL_BROWSERS=1 npx playwright test
// --project=safari --project=firefox --project=iphone --project=android. Everything else runs in Chrome.
const JOURNEYS = /judge path|workflow:|document: a 10-page deck|document: the full review journey|alerts: editing F-12|replay: new wording for MSG-01|start here|acting as|home page: continue|image ad: findings|insights: real disputes|rulebook: a code rule/;
const chrome = { channel: process.env.CI ? undefined : "chrome" };

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  reporter: [["list"]],
  projects: [
    { name: "chrome", use: chrome },
    ...(process.env.ALL_BROWSERS
      ? [
          { name: "safari", use: { ...devices["Desktop Safari"] }, grep: JOURNEYS },
          { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: JOURNEYS },
          { name: "iphone", use: { ...devices["iPhone 14"] }, grep: JOURNEYS },
          { name: "android", use: { ...devices["Pixel 7"], ...chrome }, grep: JOURNEYS },
        ]
      : []),
  ],
});
