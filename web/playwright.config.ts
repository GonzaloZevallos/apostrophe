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
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Wait ceilings, set here once (GH-110); a call site never sets a shorter one.
  // Measured with the backend suite (`uv run --no-project pytest -n auto -q`) looping in
  // another shell, 3 workers (ADR-0040). Accept-invitation POST (scrypt, ADR-0002): max
  // 1_949 ms and p95 1_669 ms over the 5 final-config runs (175 signups); the heaviest
  // earlier run on one worker had max 8_458 ms. `expect` stays at least 2x the largest max.
  // A test's timeout is at least 2x its own longest duration under that load. Longest
  // passing per spec over the 5 runs at 3 workers: sales 54 s (alone, in `timed`), tapBudget
  // 45 s, flow 30 s, insets 28 s, payments 23 s (before, on one worker: payments 75 s,
  // panel 69 s, passwords 67 s, insets 62 s, sales 117 s). So the default is 160 s;
  // `sales.spec.ts` sets 240 s itself. Not measured: the CI box (2 vCPU).
  timeout: 160_000,
  expect: { timeout: 17_000 },
  retries: 0,
  fullyParallel: false,
  // A fixed constant, never derived from the machine (ADR-0040): the same figure everywhere,
  // so a run on a 2-vCPU CI box and on a 16-core one are the same shape.
  workers: 3,
  reporter: 'list',
  // `catalogInsecureOrigin.spec.ts` (review finding, carried from the clipboard
  // subtask: the `execCommand` fallback was only proven in jsdom) needs a base URL
  // that is neither `https` nor `localhost`/`127.0.0.1` — the one combination
  // Chromium's own secure-context rule still treats as insecure — so it gets its
  // own project with its own `baseURL`, instead of running under the default one
  // every other spec shares. It needs no real DNS entry: the spec itself proxies
  // every request for that host to its own worker's real server.
  //
  // `sales.spec.ts` measures wall-clock time (a 300 ms list check, #120), so it runs alone,
  // in the `timed` project, after the others: `scripts/e2e.sh` runs the two phases, and
  // `timed` has no `dependencies` so a red phase 1 never skips it. The supported full run is
  // `npm run e2e`; `npx playwright test sales.spec.ts` runs only the `timed` project.
  projects: [
    {
      name: 'secure-origin',
      testIgnore: [/catalogInsecureOrigin\.spec\.ts/, /sales\.spec\.ts/],
    },
    {
      name: 'insecure-origin',
      testMatch: /catalogInsecureOrigin\.spec\.ts/,
      use: { baseURL: 'http://apostrophe.test' },
    },
    { name: 'timed', testMatch: /sales\.spec\.ts/ },
  ],
})
