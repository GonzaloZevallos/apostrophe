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

### Choosing N: full runs of `npm run e2e` (wall time, `vite build` included)

Machine: 16 cores, shared with other work. "Loaded" = `uv run --no-project pytest -n auto -q`
looping in another shell (load average 17-32 during the runs). All green (86 + 1 tests).

| run | workers | seconds | phase 1 | phase 2 | longest phase-1 file / `sales.spec.ts` (same run) |
|---|---|---|---|---|---|
| idle | 3 | 111 | 1.5 min | 19 s | tapBudget 21 s / 17 s |
| loaded | 2 | 327 | 4.6 min | 41 s | ventasTelefono 46 s / 35 s |
| loaded | 3 | 260 | 3.4 min | 50 s | tapBudget 65 s / 45 s |
| loaded | 4 | 235 | 3.1 min | 40 s | tapBudget 50 s / 40 s |

The floor (longest file + `sales.spec.ts` + ~20 s) was about 107, 135 and 110 s in those
runs, so no N lands within 10% of it: with 86 tests and 3 or 4 workers the bound is the
total work divided by N, not the longest file. The rule could not be applied as written;
the chosen N is the smallest whose loaded run is under the 300 s sanity margin (N = 2 took
327 s). **N = 3.** Going to 4 saved about 25 s. The "before" figure (`workers: 1`) is the
five runs recorded above, 3m49s to 6m01s on a shared machine; a loaded `workers: 1` run was
not repeated, the issue records it past 600 s. CI (2 vCPU) was not run from this
checkout: the chosen N must be green once on the PR's own e2e job.

Five consecutive loaded green runs at N = 3: 285, 269, 269, 281 and 276 s. Longest passing
test per spec over them: sales 54 s, tapBudget 45 s, flow 30 s, insets 28 s, payments 23 s.

### Accept-invitation POST under load (N = 3, 175 signups through `signUpNewBusiness`)

Max 1_949 ms, p95 1_669 ms. `expect` (17 s) is unchanged: still at least 2x the largest
max ever recorded (8_458 ms, one worker).

### Wall-clock maxima across the five loaded runs

- `customers.spec.ts` 60 s checks: 1_466 ms and 2_323 ms.
- `passwords.spec.ts` 60 s check: 4_042 ms. `ventasTelefono.spec.ts` 60 s check: 1_991 ms.
- `onboarding.spec.ts` 5-minute check: 10_582 ms.
- `sales.spec.ts` record checks (60 s): 2_120, 813 and 991 ms; list check (300 ms): 161 ms.

None exceeds half its budget except the list check, which already runs alone in `timed`.
No file moved to `timed`.

### Cold timed phase

`npx playwright test --project=timed`, five separate invocations with the backend suite
looping. List check `elapsedMs`: 83, 50, 98, 68, 76. Record durations (new customer,
existing, none) in ms: 957/288/385, 902/304/466, 696/386/352, 692/376/579, 755/323/288.
Every list check is under 200 ms, so `sales.spec.ts` needs no warm-up request and no
budget moved.

### Exit-status proof (throwaway failing specs, not committed)

- Only phase 1 red: exit 1, phase 2 still ran and reported (1 failed, 86 passed; 1 passed).
- Only phase 2 red: exit 1 (86 passed; 1 failed, 1 passed).
- Both green: exit 0 (the five runs above).

## Amendment (GH-251): one phase, a pinned zone and locale, evidence on failure

`web-e2e` went red and then green on the same head and left nothing to say which test failed.
This amendment supersedes the "N workers and the timed phase" text above wherever it speaks
of `timed` or of two phases. **N = 3 stands**, with `retries: 0` and every `timeout` and
`expect` ceiling as measured there.

1. **One phase.** No spec reads elapsed time any more (ADR-0038), so the `timed` project is
   gone and `sales.spec.ts` runs in `secure-origin` with the others. `web/scripts/e2e.sh` is
   `vite build` (exit 1 if it fails) and one `npx playwright test "$@"`, whose exit status it
   returns unchanged. `--only-changed=<base>` still passes through. No option that turns zero
   selected tests into success is added: `scripts/affected.py` already sends an empty
   selection to the full run. `npx playwright test sales.spec.ts` now runs it in
   `secure-origin`.
2. **The browser's zone and locale are pinned once.** `web/playwright.config.ts`'s top-level
   `use` sets `timezoneId: 'America/Argentina/Buenos_Aires'` and `locale: 'es-AR'`; no spec and
   no project sets its own, so a machine's own zone never reaches a spec.
3. **A red run leaves evidence.** The config reads `PLAYWRIGHT_OUTPUT_DIR` once, with the
   fixed default `test-results/local`, and never computes a name from the time or the sha; the
   caller chooses a per-run name. Reporters are `list` and `junit` (`<dir>/junit.xml`); a
   trace is kept on failure only, and so is a screenshot. CI uploads `web/test-results/` with
   `if: failure()`, retention 14 days.
4. **What enforces it.** `web/src/architecture/e2eShape.test.ts` imports the real config and
   checks the above: no `timed` project, every spec file in exactly one project, the pins, and
   the output directory with the variable unset and set.

The root cause of the red run on `dbe57a27` is not proven; `docs/evidence/GH-251-e2e-flake.md`
holds the loaded runs, their maxima and what they do and do not show.

### Amendment (GH-251): one directory per run, and the failing tests named at the end

5. **Each run has its own directory.** `web/scripts/e2e.sh` sets and exports
   `PLAYWRIGHT_OUTPUT_DIR=test-results/<short sha>-<UTC stamp>` (`git rev-parse --short HEAD`,
   `date -u +%Y%m%dT%H%M%SZ`), so the junit file, traces and screenshots of a run are never
   overwritten by a rerun of the same head. The config only reads the variable (item 3); a run
   that does not go through the script writes to `test-results/local`. The `date -u` in
   `e2e.sh` is the harness's one deliberate real-clock read: it names a directory, no
   assertion reads it, and it sits outside both wall-clock guards by design.
6. **Pruning.** Before the run, `e2e.sh` removes directories under `web/test-results/` older
   than 14 days, matching the CI artefact retention. A missing directory is fine.
7. **The epilogue of a red run.** When Playwright's status is non-zero, the last lines of the
   output are `e2e: failed:`, one `<file> › <title>` per failed or errored test
   (`scripts/e2e_failures.py`, read from the run's `junit.xml`; names only, never a message or
   an output body) and `e2e: traces in <run dir>`. A missing or unreadable junit prints one
   fixed line and the helper still exits 0. `e2e.sh` exits with Playwright's own status. The
   gate's captured output tail is the evidence this relies on: what the agentic system keeps
   after a red check is outside this repository, so the worktree surviving is a bonus.
