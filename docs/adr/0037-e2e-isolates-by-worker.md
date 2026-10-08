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
