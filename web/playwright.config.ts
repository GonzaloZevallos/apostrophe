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
 *
 * The port is decided only here (plan, "Shape": "the port is decided only in
 * `web/playwright.config.ts`"): `APOSTROPHE_E2E_PORT` when set, else a free port from
 * `freePort.ts`, written back into the environment so every worker this config
 * spawns inherits the same one. `env.ts`'s functions read it back; nothing else picks
 * or hardcodes a port.
 */

import { defineConfig } from '@playwright/test'
import { freePort } from './e2e/freePort.js'
import { E2E_HOST, e2eBaseUrl, e2eDbPath, e2eEnv, e2ePort } from './e2e/env.js'

if (process.env.APOSTROPHE_E2E_PORT === undefined) {
  process.env.APOSTROPHE_E2E_PORT = String(await freePort(E2E_HOST))
}
// Validates the variable whether it was already set or was just picked above —
// `e2ePort()` never picks a port itself, by decision.
e2ePort()

const envAssignments = Object.entries(e2eEnv())
  .map(([key, value]) => `${key}=${value}`)
  .join(' ')

// Playwright races a `url` poll against `wait` (`node_modules/playwright/lib/runner/
// index.js:946-951`), so keeping `url` set would let another worktree's server,
// already answering on the same port, win that race and mark this run ready against
// a server it never started. The only readiness signal is this run's own uvicorn
// announcing itself on its own port.
const readyPattern = new RegExp(
  `Uvicorn running on http://${E2E_HOST.replace(/\./g, '\\.')}:${e2ePort()}\\b`,
)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: e2eBaseUrl(),
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
    // A throwaway SQLite file, keyed on the port so two runs never share one,
    // removed before every run; `cwd: '..'` so the paths in `e2eEnv()`
    // (repo-root-relative, matching `scripts/serve.sh`'s own) resolve the same way.
    // Never `scripts/serve.sh`: that one sources `.env`.
    //
    // `tests.e2e_app:create_e2e_app`, not `app.main:create_app` (GH-10, front
    // subtask): the plan's own invariant — "the test app always injects
    // FakeTelegram and upkeep_ticker=False" — holds for the e2e run too, so no
    // spec here ever reaches a real Telegram token or the network.
    command:
      `mkdir -p "$(dirname '${e2eDbPath()}')" && rm -f '${e2eDbPath()}' && ` +
      `${envAssignments} uv run --no-project uvicorn tests.e2e_app:create_e2e_app --factory ` +
      `--host ${E2E_HOST} --port ${e2ePort()} --no-access-log`,
    cwd: '..',
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
    wait: { stderr: readyPattern },
  },
})
