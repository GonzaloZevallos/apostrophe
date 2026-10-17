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
import {
  E2E_HOST,
  e2eBaseUrl,
  e2eDbPath,
  e2eEnv,
  e2ePort,
  mobileBaseUrl,
  mobileDbPath,
  mobileEnv,
  mobilePort,
} from './e2e/env.js'

if (process.env.APOSTROPHE_E2E_PORT === undefined) {
  process.env.APOSTROPHE_E2E_PORT = String(await freePort(E2E_HOST))
}
// Validates the variable whether it was already set or was just picked above —
// `e2ePort()` never picks a port itself, by decision.
e2ePort()
// The phone check's second server gets its own port the same way (GH-80).
if (process.env.APOSTROPHE_E2E_MOBILE_PORT === undefined) {
  process.env.APOSTROPHE_E2E_MOBILE_PORT = String(await freePort(E2E_HOST))
}
mobilePort()

const assignments = (env: Record<string, string>): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

const envAssignments = assignments(e2eEnv())

// Playwright races a `url` poll against `wait` (`node_modules/playwright/lib/runner/
// index.js:946-951`), so keeping `url` set would let another worktree's server,
// already answering on the same port, win that race and mark this run ready against
// a server it never started. The only readiness signal is this run's own uvicorn
// announcing itself on its own port.
const readyOn = (port: number): RegExp =>
  new RegExp(`Uvicorn running on http://${E2E_HOST.replace(/\./g, '\\.')}:${port}\\b`)

// One cell walks every registry screen twice (loaded, then held); a cell's own budget.
const MOBILE_TEST_TIMEOUT_MS = 300_000

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
    // The phone check runs on its own server and clock (the `mobile` project below), so the
    // original specs, which keep the first server and the real clock, never match it.
    {
      name: 'secure-origin',
      testIgnore: [/catalogInsecureOrigin\.spec\.ts/, /mobile\.(spec|setup)\.ts/],
    },
    {
      name: 'insecure-origin',
      testMatch: /catalogInsecureOrigin\.spec\.ts/,
      use: { baseURL: 'http://apostrophe.test' },
    },
    // GH-80: the phone check. The setup project seeds the second server once (the walk only
    // reads, so every cell shares that business); `npm run e2e` runs this project with its
    // own worker count (its cells are independent), the others stay at `workers: 1`.
    {
      name: 'mobile-setup',
      testMatch: /mobile\.setup\.ts/,
      timeout: 120_000,
      use: { baseURL: mobileBaseUrl() },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      dependencies: ['mobile-setup'],
      fullyParallel: true,
      timeout: MOBILE_TEST_TIMEOUT_MS,
      use: { baseURL: mobileBaseUrl(), isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
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
    wait: { stderr: readyOn(e2ePort()) },
    },
    {
      // The second server (GH-80, invariant 7): `create_mobile_e2e_app`, its clock pinned.
      command:
        `mkdir -p "$(dirname '${mobileDbPath()}')" && rm -f '${mobileDbPath()}' && ` +
        `${assignments(mobileEnv())} uv run --no-project uvicorn tests.e2e_app:create_mobile_e2e_app ` +
        `--factory --host ${E2E_HOST} --port ${mobilePort()} --no-access-log`,
      cwd: '..',
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
      wait: { stderr: readyOn(mobilePort()) },
    },
  ],
})
