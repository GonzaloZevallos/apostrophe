---
status: accepted
date: 2026-10-08
---

# e2e isolates by worker: one backend and one database per Playwright worker

GH-152 runs the e2e suite on more than one Playwright worker. Until then the config's
`webServer` started a single uvicorn over a single SQLite file, so every spec shared one
installation. This ADR fixes how workers stop sharing it. The suite itself stays on
`workers: 1` in this step; turning on N workers, the timed phase and the measurements are
the next step's, and appended here.

## Decision

1. **The fixture owns the backend.** `web/e2e/fixtures.ts` holds a worker-scoped `auto`
   fixture, `workerServer` (`timeout: 100_000`). In order it picks a free port
   (`freePort`), writes it to `APOSTROPHE_E2E_WORKER_PORT` in its own worker process,
   makes `web/e2e/.tmp` and removes the worker's DB file with its `-journal` and `-wal`,
   and spawns `uv run --no-project uvicorn tests.e2e_app:create_e2e_app --factory` in its
   own process group. It waits up to 30 s for its own child's stderr line
   `Uvicorn running on http://127.0.0.1:<port>`; it polls no URL, so another checkout's
   server answering on the port never passes for this one. If the child exits first (a
   port lost between picking and binding) it retries with a new port, three attempts, then
   fails with a fixed message. Teardown, pass or fail: SIGTERM to the process group, up to
   5 s, SIGKILL, then the DB files are removed. `baseURL` becomes
   `baseURL ?? workerServer.url`.
2. **Only the fixture picks a port.** The variable is renamed `APOSTROPHE_E2E_PORT` ->
   `APOSTROPHE_E2E_WORKER_PORT`, written only in `fixtures.ts`; `env.ts` reads it and
   `backend.ts` passes `e2eEnv()` to its CLI calls, which therefore reach the calling
   worker's own DB. The old `APOSTROPHE_E2E_PORT` input is gone: it is read nowhere. The
   config no longer starts a server, resolves a port or sets a top-level `baseURL` (it is
   loaded inside every worker).
3. **Specs take `test` and `expect` from the fixture file.** `web/.oxlintrc.json` forbids
   value imports of them from `@playwright/test` under `e2e/**`, type imports allowed, and
   switches the rule off for `fixtures.ts` alone. Every `browser.newContext(...)` passes
   `baseURL` from `workerServer`, since a context built from `browser` in a hook or in a
   test is not given the fixture's override on its own.
4. **A parent-pid watcher in `tests/e2e_app.py`.** When `APOSTROPHE_E2E_PARENT_PID` is set
   (the fixture sets it to its worker's pid), a daemon thread polls `parent_gone` every
   second and calls `os._exit(0)` once the worker is gone, so a crashed or killed worker
   never leaves a uvicorn alive. With the variable unset it does nothing. Known risk: a
   reused pid keeps a leaked uvicorn idle, on a port no later run picks.
5. **Specs keep their `Date.now()` identities and in-test signups.** An installation is
   now one worker's DB, so two workers cannot collide on a name or an email. `fullyParallel`
   stays `false`: parallelism is by file, and tests inside a file keep their order.

## Global-state grep

Looked for state a second worker could race on, and found none to change:

- Module-level values in `tests/e2e_app.py` (three constants), `tests/fakes/telegram.py`
  (none) and `web/e2e/*.ts` (viewport and label constants, never mutated). `E2eTelegram`
  is built per app, so per worker.
- Client-address-keyed tables (`login_guard`, `login_address_guard`): each worker's DB holds
  its own, so the address brake of one worker never counts another's attempts.
- Module-level `let`, or a collecting `const` (array, map, set) in the specs: none. The
  `let page`/`consoleMessages` state lives inside each file's own `describe`.
- Wall-clock `Date.now()` inside an `expect`: `sales.spec.ts` (300 ms list check, 60 s record
  budgets), `customers`, `passwords`, `ventasTelefono` (60 s) and `onboarding` (5 min). Only `sales.spec.ts`'s 300 ms check is tight; the next step pins it to a
  timed phase.

## Worker-restart proof

After a failing test Playwright discards the worker and starts a new one, which starts a
new backend on a new DB. Throwaway failing tests (not committed) were put in the middle of
`barFit`, `navigation` and `ventasTelefono`, run with `workers: 1`: the serial groups of
`barFit` (2) and `navigation` (3) skipped their remaining tests (5 did not run, 3 failed,
41 passed); `ventasTelefono`'s remaining 6 tests reran its `beforeAll` against the new
worker's server and passed.

## Five consecutive green runs at `workers: 1`

`npm --prefix web run e2e` (87 tests), on a shared machine with other work running, five
runs in a row, all green: 5m06s, 6m01s, 3m55s, 4m13s and 3m49s (wall time of the whole
command, including `vite build`). The spread is the machine's load, not the suite. These
are the runs of the server model alone; the per-N times and the loaded/idle comparison
belong to the step that turns on N workers.

## What enforces the import rule

`web/src/architecture/e2eImportRule.test.ts` copies the real `web/.oxlintrc.json` next to
throwaway files and runs oxlint: a spec importing `test` and `expect` from
`@playwright/test` is rejected, a type-only import and `fixtures.ts` are accepted.

## A silent backend is not retried

The fixture retries only when the child exits before it is ready (a lost port race). A child
silent for 30 s fails the fixture at once with a fixed message, so three slow attempts can
never run past the fixture's own 100 s timeout.

## N workers and the timed phase (the second step)

`web/playwright.config.ts` now sets `workers` to a fixed constant (never
`os.availableParallelism()`; `fullyParallel` stays `false`, so parallelism is by file).
`sales.spec.ts` alone runs in a `timed` project with no `dependencies`, and
`web/scripts/e2e.sh` (the `e2e` script) runs two phases: `vite build` (exit 1 if it fails),
then phase 1, every other spec (`--project=secure-origin --project=insecure-origin`), then
phase 2, `--project=timed`. There is no `set -e`: phase 2 always runs, so a red phase 1 never
hides a red 300 ms check, and the script exits non-zero if either phase is red. A
`dependencies` entry would skip `timed` whenever phase 1 failed. `npx playwright test
sales.spec.ts` alone runs only the `timed` project; the supported full run is `npm run e2e`.

### Floor estimate (written before measuring)

A run can never be shorter than its longest phase-1 file, plus `sales.spec.ts`, plus build
and startup. From the loaded figures recorded in the config before this step (longest
passing test per spec under backend-suite load: payments 75 s; `sales.spec.ts` 117 s at
worst; about 20 s for `vite build` and the workers' first backends) the floor is about
75 + 117 + 20 = **210 s**. N is the smallest worker count whose loaded full run lands within
about 10% of the floor measured in that same run; a loaded run must finish well inside the
agentic system's 600 s check timeout (300 s is the sanity margin reported).
