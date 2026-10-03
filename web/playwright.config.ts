/**
 * The end-to-end check (plan, "Shape": `e2e` lands last and adds `web-e2e` to
 * `.agentic/stack.yaml`). One browser, against the real backend and the real built
 * front — `web/dist`, the same artefact `scripts/serve.sh` serves — never a mock of
 * either side (PRD, M1: "no `curl` at any point").
 *
 * The server is started here, with its own throwaway SQLite file and secret key, by
 * calling `uvicorn` and the `invite-business` CLI directly with explicit environment
 * variables — never `scripts/serve.sh` or `scripts/invite-business.sh`, which source
 * `.env` (plan, "Old shapes kept": the e2e run calls neither).
 */

import { defineConfig } from '@playwright/test'
import { E2E_BASE_URL, E2E_DB_PATH, E2E_ENV } from './e2e/env.js'

const envAssignments = Object.entries(E2E_ENV)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ')

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: E2E_BASE_URL,
  },
  // `catalogInsecureOrigin.spec.ts` (review finding, carried from the clipboard
  // subtask: the `execCommand` fallback was only proven in jsdom) needs a base URL
  // that is neither `https` nor `localhost`/`127.0.0.1` — the one combination
  // Chromium's own secure-context rule still treats as insecure — so it gets its
  // own project with its own `baseURL`, instead of running under the default one
  // every other spec shares. It needs no real DNS entry: the spec itself proxies
  // every request for that host to the one real server this config starts below.
  projects: [
    { name: 'secure-origin', testIgnore: /catalogInsecureOrigin\.spec\.ts/ },
    {
      name: 'insecure-origin',
      testMatch: /catalogInsecureOrigin\.spec\.ts/,
      use: { baseURL: 'http://apostrophe.test' },
    },
  ],
  webServer: {
    // A throwaway SQLite file, removed before every run; `cwd: '..'` so the paths
    // in `E2E_ENV` (repo-root-relative, matching `scripts/serve.sh`'s own) resolve
    // the same way. Never `scripts/serve.sh`: that one sources `.env`.
    //
    // `tests.e2e_app:create_e2e_app`, not `app.main:create_app` (GH-10, front
    // subtask): the plan's own invariant — "the test app always injects
    // FakeTelegram and upkeep_ticker=False" — holds for the e2e run too, so no
    // spec here ever reaches a real Telegram token or the network.
    command:
      `mkdir -p "$(dirname '${E2E_DB_PATH}')" && rm -f '${E2E_DB_PATH}' && ` +
      `${envAssignments} uv run --no-project uvicorn tests.e2e_app:create_e2e_app --factory ` +
      `--host 127.0.0.1 --port 8799 --no-access-log`,
    cwd: '..',
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
