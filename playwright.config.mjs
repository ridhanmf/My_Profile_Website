import { defineConfig, devices } from "playwright/test";

/* E2E runs against a build that uses the TEST-ONLY admin credentials in tests/fixtures
   (user "e2e-admin"), never the real ones in src/data/admin-auth.json. */
const PORT = 4174;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } }],
  webServer: {
    command: `node scripts/build.mjs --auth tests/fixtures/admin-auth.json --out .tmp/e2e/index.html && node scripts/serve.mjs`,
    env: { PORT: String(PORT), SERVE_DIR: ".tmp/e2e" },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
