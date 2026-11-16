import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: process.env.CI ? undefined : "chrome",
    screenshot: "only-on-failure",
  },
  reporter: [["list"]],
});
