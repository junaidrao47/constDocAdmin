import { defineConfig, devices } from "@playwright/test";

/**
 * E2e runs against a LOCALLY RUNNING, SEEDED stack:
 *   - backend API + Postgres + Redis seeded (see e2e/README.md)
 *   - this app on http://localhost:3000 (`npm run dev`)
 *
 * It does not start either for you (Next's dev/build share `.next`, so Playwright must
 * not trigger a build while dev is up). Point elsewhere with PLAYWRIGHT_BASE_URL /
 * PLAYWRIGHT_API_URL.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
