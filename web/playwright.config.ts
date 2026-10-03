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
import { E2E_BASE_URL, E2E_DB_PATH, E2E_ENV } from './e2e/env'

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
  webServer: {
    // A throwaway SQLite file, removed before every run; `cwd: '..'` so the paths
    // in `E2E_ENV` (repo-root-relative, matching `scripts/serve.sh`'s own) resolve
    // the same way. Never `scripts/serve.sh`: that one sources `.env`.
    command:
      `mkdir -p "$(dirname '${E2E_DB_PATH}')" && rm -f '${E2E_DB_PATH}' && ` +
      `${envAssignments} uv run --no-project uvicorn app.main:create_app --factory ` +
      `--host 127.0.0.1 --port 8799 --no-access-log`,
    cwd: '..',
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
