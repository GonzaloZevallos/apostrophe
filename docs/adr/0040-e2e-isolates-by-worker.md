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

### Amendment (GH-251): every worker runs on the anchored clock

8. **The calendar is no longer shared.** This supersedes point 5's reading that the workers
   and the browser share the real calendar (and ADR-0043's "shares the real clock with the CLI
   subprocess" reason for `tests/e2e_app.py`). Before its backend starts, each worker's
   `workerServer` fixture runs `python -m tests.e2e_app offset` once (`cwd` the repository
   root), checks the output is a whole number and writes it to
   `APOSTROPHE_E2E_CLOCK_OFFSET` in its own environment. `e2eEnv()` passes it on, so the
   worker's uvicorn and the `invite-business` and `reset-password` calls
   (`web/e2e/backend.ts`, now `python -m tests.e2e_app`) read one clock that started at
   `2026-10-07T15:00:00Z`, 12:00 in Argentina, and keeps advancing. The offset is computed
   in Python only, so no TypeScript reads the clock. Only `tests/e2e_app.py` reads the
   variable, only `fixtures.ts` writes it and only `env.ts` passes it on;
   `tests/test_e2e_clock.py` scans `web/e2e` for it.
9. **The browser's contexts inherit the zone and locale; no `CONTEXT_DEFAULTS`.** A
   throwaway spec (not committed), run under `TZ=Pacific/Auckland`, read the zone and
   `navigator.language` in the fixture's `page` and in a page of a context made by hand with
   `browser.newContext({ baseURL })`: both `America/Buenos_Aires` and `es-AR`. So the config's
   `use` stays the only place that names them, and the `newContext` call sites are unchanged.
10. **`analysis.spec.ts`'s last-month date** is `firstOfMonth(todayIso, 1)`, the file's own
    UTC helper, instead of local-time `setDate`/`setMonth` over a UTC-parsed date.

## Amendment (GH-171): the CI run, a loaded serial baseline and the rule that chose N

All figures below are indicative: single runs or small medians, taken on a shared machine or on one CI run, read on 2026-10-17. None is asserted by any test, gate step or config value (ADR-0038); this section only records them. It supersedes nothing above; the text above stays as written.

### 1. The rule N = 3 was actually chosen by

The "Floor estimate" above says N is the smallest worker count whose loaded full run lands within about 10 % of the floor. No N met that: "Choosing N" computes floors of about 107, 135 and 110 s and loaded runs of 327 s (N = 2), 260 s (N = 3) and 235 s (N = 4). N = 3 was chosen as the smallest N whose loaded full run finished under 300 s on the 16-core machine (N = 2 took 327 s). With 86 tests on 3 or 4 workers the run is bound by total work divided by N, not by the longest file, so the 10 % rule cannot be met on this suite. Nothing was re-measured against it. N = 3 stands.

### 2. The CI run of PR #170

| figure | value | where it is read |
|---|---|---|
| run | https://github.com/GonzaloZevallos/apostrophe/actions/runs/37734508993/job/113170898273 | `gh api repos/GonzaloZevallos/apostrophe/actions/jobs/113170898273` |
| event, branch, head | `pull_request`, `agentic/GH-152`, head `21770d2499ea8ab6cb34eb54bc1f682924232889`; the job checked out the PR merge ref `654437f2bb9bc35b74b2d98502aabcd4dc2faea2`; PR #170 merged at 2026-10-08T05:56:33Z as `4166445b7f12b3643ba72f9d54df5052ab80dbf6` | `gh run view 37734508993 --json event,headSha,headBranch`; `gh pr view 170 --json mergeCommit,mergedAt`; the job log |
| runner label | `ubuntu-24.04`, image version 20260927.320.1 | the job's `labels` and the log's "Runner Image" group |
| vCPU | 2, **documented for the label, not measured in this run**: the log prints no CPU count and nothing in this run printed `nproc`. This repository is private; docs.github.com lists `ubuntu-24.04` as 2 vCPU / 8 GB for private repositories (4 vCPU / 16 GB for public ones). | https://docs.github.com/en/actions/reference/runners/github-hosted-runners, read 2026-10-17 |
| suite shape | the suite of that head, before GH-251: `workers: 3`, `retries: 0`, **two phases** (a first phase of 86 tests, then the `timed` phase of 1 test). It is not the current one-phase suite. | the log: "Running 86 tests using 3 workers", "Running 1 test using 1 worker" |
| Playwright phase 1 | `86 passed (2.5m)`, as printed by Playwright | the job log, step "Run npm --prefix web run e2e" |
| Playwright phase 2 | `1 passed (10.9s)`, as printed by Playwright | the same step |
| job time | 4m07s, **including** set-up, checkout, installs, `playwright install` and post-job steps | `gh pr checks 170`; the job's `started_at` 2026-10-08T05:51:44Z and `completed_at` 2026-10-08T05:55:51Z |
| e2e step | started 2026-10-08T05:53:02Z, completed 2026-10-08T05:55:47Z, success | the job's `steps` array |

The step's duration is not printed as a figure anywhere I could read, and it is not derived here: the two Playwright figures are what the run printed, and the step lies inside the 4m07s job. One run, so no median.

### 3. What the 300 s criterion is, and what it is not

The 300 s criterion was measured locally, on the 16-core machine, and it chose N. It does not transfer to CI (2 vCPU documented for the label against 16 cores), and CI does not validate N = 3. The CI figure to compare with the agentic system's 600 s check timeout and its 300 s margin is the e2e step. The step's own duration was not printed. The two phases it printed (2.5 min and 10.9 s) and the whole 4m07s job that contains the step all lie inside both the 300 s margin and the 600 s timeout. This is one CI run of the suite as it was on 2026-10-08; the suite has 106 tests now, and no CI run of the current suite is recorded here.

### 4. Loaded runs on the current one-phase suite (dated 2026-10-17, one machine, indicative)

Machine: `nproc` = 16, AMD Ryzen 7 5700U with Radeon Graphics, head `e08228dd44cd0fbb632ac0dc4d90931daffd07dd`, `workers: 3` in the config, `retries: 0`, one phase, **106 tests** (the 86 + 1 of the tables above are the older suite). Load: `uv run --no-project pytest -n auto -q` looping in another shell for the whole session. The six runs ran back to back, serial first, then 3 workers. Each run's header was read from its output: "Running 106 tests using 1 worker" for the serial set (checked on the first run before the other two) and "Running 106 tests using 3 workers" for the other.

Before each run `pgrep -af '(^|/)(pytest|mypy|ruff|vitest|playwright)'` was recorded. It shows two idle `playwright-mcp` servers throughout, and the generator. The precondition "nothing but the generator" was **not always met**: this is a shared machine, other worktrees ran their own e2e, vitest and pytest, and the script waited up to 20 minutes for them to leave before it started each run anyway. The column "other worktrees' test processes" counts the lines that were neither the generator nor `playwright-mcp`. Only runs with 0 had a clean `pgrep`. The load average (1/5/15 min, `/proc/loadavg`) at each start had a 1-minute value of 16 to 52, so the runs were not under one steady load.

**Serial, `workers: 1`.** Command, one run per row: `/usr/bin/time -f %e npm --prefix web run e2e -- --workers=1`.

| run | started (UTC) | seconds | outcome | Playwright summary | other worktrees' test processes at start | load average at start (1/5/15 min) |
|---|---|---|---|---|---|---|
| 1 | 16:18:09 | 974.5 | green | 106 passed (16.1m) | 0 | 16.46 11.98 15.76 |
| 2 | 16:55:14 | 1382.4 | RED | 1 failed; 105 passed (22.8m) (pressed.spec.ts › Deshacer › keeps 4.5:1 at rest and while pressed (oscuro)) | 11 | 43.44 48.03 44.64 |
| 3 | 17:38:53 | 1745.8 | green | 106 passed (28.9m) | 4 | 51.58 47.57 47.00 |

2 green of 3; median of the green runs 1360 s; (max - min)/median 57 %.

The red run is kept in the table with its time and name and left out of the median; it was not re-run; the cause was not investigated. The spread is large: the three runs ran under different foreign load, so the median of two green runs says little.

**Three workers (the configured default).** Command, one run per row: `/usr/bin/time -f %e npm --prefix web run e2e`.

| run | started (UTC) | seconds | outcome | Playwright summary | other worktrees' test processes at start | load average at start (1/5/15 min) |
|---|---|---|---|---|---|---|
| 1 | 18:21:00 | 508.7 | green | 106 passed (8.3m) | 0 | 32.33 34.47 42.18 |
| 2 | 18:29:45 | 593.6 | green | 106 passed (9.8m) | 0 | 44.77 45.65 44.06 |
| 3 | 19:00:13 | 649.2 | green | 106 passed (10.7m) | 9 | 36.84 42.27 46.71 |

3 green of 3; median of the green runs 594 s; (max - min)/median 24 %.


Reading, with that caution: on this suite and this machine the 3-worker runs finished in 509 to 649 s, which is past the 300 s criterion in all three runs and, for the last one (649 s), past the 600 s check timeout itself. The 300 s figures of "Choosing N" were taken on 86 tests and under a 17 to 32 load average, so they do not carry over to 106 tests under a 1-minute load average of 32 to 45 at the start of each run. The 300 s criterion is recorded here as the rule that chose N; this amendment does not claim N = 3 meets it today, and does not change N.

### 5. Comparison with the earlier `workers: 1` figures

The serial figures in section 4 are not comparable with the earlier `workers: 1` runs (3m49s to 6m01s over five runs, "on a shared machine with other work running", the ADR's own words, taken before N workers existed, on the older 87-test suite). The load they ran under is not recorded; the serial set above is the first `workers: 1` set taken under the backend suite's load and on the current suite. The earlier text says the issue records a loaded `workers: 1` run past 600 s; the loaded serial runs above (975 s and 1746 s green, 1382 s red) are consistent with that.

### 6. What guards these figures

Nothing. No test, gate step or config value reads any figure in this amendment (ADR-0038). `workers: 3` and the `playwright.config.ts` timeouts stay as set, and the 600 s check timeout belongs to the agentic system, outside this repository.
