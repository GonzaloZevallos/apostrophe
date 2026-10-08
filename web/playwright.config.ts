/**
 * The end-to-end check (plan, "Shape": `e2e` lands last and adds `web-e2e` to
 * `.agentic/stack.yaml`). One browser, against the real backend and the real built
 * front — `web/dist`, the same artefact `scripts/serve.sh` serves — never a mock of
 * either side (PRD, M1: "no `curl` at any point").
 *
 * No server starts here (ADR-0037, GH-152): each Playwright worker starts its own
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
  // another shell. Accept-invitation POST (scrypt, ADR-0002): max 8_458 ms and p95 7_299 ms
  // in the heaviest run (29 signups), max 5_197 ms and p95 3_195 ms over the 5 final-config
  // runs (150 signups). `expect` is at least 2x the largest max.
  // A test's timeout is at least 2x its own longest duration under that load. Longest
  // passing, in the heaviest run: payments 75 s, panel 69 s, passwords 67 s, insets 62 s;
  // over the 5 final-config runs: passwords 41 s, insets 39 s, flow 37 s, payments 36 s.
  // So the default is 160 s; `sales.spec.ts` (117 s at worst) sets 240 s itself.
  timeout: 160_000,
  expect: { timeout: 17_000 },
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // `catalogInsecureOrigin.spec.ts` (review finding, carried from the clipboard
  // subtask: the `execCommand` fallback was only proven in jsdom) needs a base URL
  // that is neither `https` nor `localhost`/`127.0.0.1` — the one combination
  // Chromium's own secure-context rule still treats as insecure — so it gets its
  // own project with its own `baseURL`, instead of running under the default one
  // every other spec shares. It needs no real DNS entry: the spec itself proxies
  // every request for that host to its own worker's real server.
  projects: [
    { name: 'secure-origin', testIgnore: /catalogInsecureOrigin\.spec\.ts/ },
    {
      name: 'insecure-origin',
      testMatch: /catalogInsecureOrigin\.spec\.ts/,
      use: { baseURL: 'http://apostrophe.test' },
    },
  ],
})
