/**
 * The end-to-end check (plan, "Shape": `e2e` lands last and adds `web-e2e` to
 * `.agentic/stack.yaml`). One browser, against the real backend and the real built
 * front — `web/dist`, the same artefact `scripts/serve.sh` serves — never a mock of
 * either side (PRD, M1: "no `curl` at any point").
 *
 * No server starts here (ADR-0040, GH-152): each Playwright worker starts its own
 * uvicorn, on its own free port and over its own throwaway SQLite file, from the
 * worker-scoped `workerServer` fixture in `e2e/fixtures.ts`, and every spec takes `test`
 * from there. This file is also loaded inside every worker, so it never resolves a port
 * and sets no top-level `baseURL`: the fixture supplies it per worker.
 *
 * One phase, one `npx playwright test` (ADR-0040, GH-251). A red run leaves evidence in
 * `OUTPUT_DIR`: a junit file, and a trace and a screenshot of each failing test.
 */

import { defineConfig } from '@playwright/test'
import { freePort } from './e2e/freePort.js'
import { E2E_HOST, mobileBaseUrl, mobileDbPath, mobileEnv, mobilePort } from './e2e/env.js'

// The phone check's second server gets one port for the whole run (GH-80, invariant 7).
// The first server is per worker (ADR-0040) and never named here. The runner decides the
// port once and every worker it forks inherits the variable, so a worker loading this
// file again finds it set and picks nothing.
if (process.env.APOSTROPHE_E2E_MOBILE_PORT === undefined) {
  process.env.APOSTROPHE_E2E_MOBILE_PORT = String(await freePort(E2E_HOST))
}
mobilePort()

const assignments = (env: Record<string, string>): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

// Playwright races a `url` poll against `wait` (`node_modules/playwright/lib/runner/
// index.js:946-951`), so keeping `url` set would let another worktree's server,
// already answering on the same port, win that race and mark this run ready against
// a server it never started. The only readiness signal is this run's own uvicorn
// announcing itself on its own port.
const readyOn = (port: number): RegExp =>
  new RegExp(`Uvicorn running on http://${E2E_HOST.replace(/\./g, '\\.')}:${port}\\b`)

// One cell walks every registry screen twice (loaded, then held); a cell's own budget.
// Measured (GH-53 integration, ADR-0048): all eight cells together, pinned to two cores
// (`taskset -c 0,1 npx playwright test --project=mobile --workers=3 --timeout=1800000`), took 238.9 to 246.2 s each,
// slowest 430x932 claro at 246.2 s: a margin of 59% under 600 s (the rule is at least 25%). On a
// loaded 16-core box the slowest cells took 294 to 305 s (GH-53 delivery gate), about half the
// ceiling. The CI job is not measured: CI is off for billing (human decision, GH-53).
const MOBILE_TEST_TIMEOUT_MS = 600_000

// Read once. The caller names the directory (a run never overwrites an earlier one); the
// config never computes a name from the time or the sha.
const OUTPUT_DIR = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results/local'

export default defineConfig({
  testDir: './e2e',
  // Wait ceilings, set here once (GH-110); a call site never sets a shorter one.
  // Measured with the backend suite (`uv run --no-project pytest -n auto -q`) looping in
  // another shell, 3 workers (ADR-0040). Accept-invitation POST (scrypt, ADR-0002): max
  // 1_949 ms and p95 1_669 ms over the 5 final-config runs (175 signups); the heaviest
  // earlier run on one worker had max 8_458 ms. `expect` stays at least 2x the largest max.
  // A test's timeout is at least 2x its own longest duration under that load. Longest
  // passing per spec over the 5 runs at 3 workers: sales 54 s (alone, in the former `timed`
  // phase), tapBudget 45 s, flow 30 s, insets 28 s, payments 23 s (before, on one worker: payments 75 s,
  // panel 69 s, passwords 67 s, insets 62 s, sales 117 s). So the default is 160 s;
  // `sales.spec.ts` sets 240 s itself. Not measured: the CI box (2 vCPU).
  timeout: 160_000,
  expect: { timeout: 17_000 },
  retries: 0,
  fullyParallel: false,
  // A fixed constant, never derived from the machine (ADR-0040): the same figure everywhere,
  // so a run on a 2-vCPU CI box and on a 16-core one are the same shape.
  workers: 3,
  outputDir: OUTPUT_DIR,
  reporter: [['list'], ['junit', { outputFile: `${OUTPUT_DIR}/junit.xml` }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The browser's zone and locale are set here once, never by a spec (ADR-0040, GH-251):
    // a calendar day in a spec is the same day whatever zone the machine runs in.
    timezoneId: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
  },
  // `catalogInsecureOrigin.spec.ts` (review finding, carried from the clipboard
  // subtask: the `execCommand` fallback was only proven in jsdom) needs a base URL
  // that is neither `https` nor `localhost`/`127.0.0.1` — the one combination
  // Chromium's own secure-context rule still treats as insecure — so it gets its
  // own project with its own `baseURL`, instead of running under the default one
  // every other spec shares. It needs no real DNS entry: the spec itself proxies
  // every request for that host to its own worker's real server.
  projects: [
    // Listed first on purpose: Playwright queues projects in this order, and the eight phone cells are
    // the longest tests by far (about 4 min each alone, 6 under load), so queued last they left two
    // workers idle while the last round of cells ran, and the whole run crossed the gate's 1500 s with every test green. The order is pinned by
    // src/architecture/e2eShape.test.ts.
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
    // The phone check runs on its own server and clock (the `mobile` project above), so the
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
  ],
  // Only the phone check's second server starts here: the first is each worker's own
  // (ADR-0040, `fixtures.ts`). Its clock is pinned (`create_mobile_e2e_app`).
  webServer: {
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
})
