# GH-251: evidence for the `web-e2e` flake

Base head of the measurements: `195a0af2` (the base of this branch). The flake itself was
seen on `dbe57a27` (GH-218). None of this is a gate step: they are one-off runs on the
developer's machine (16 cores, shared), recorded once.

## What is and is not proven

The root cause on `dbe57a27` is **not** proven, and this document does not claim the fold
removed the flake. Results are "k of n runs", outcome by outcome, never a rate.

- **Case (a), real clock, base, loaded:** 0 failed of 5 runs (5 green). Nothing stronger.
- **Cases (b) a minute before an Argentina midnight, (c) a Monday, (d) a month's last day,
  base, loaded:** **0 of 5 runs each were obtained.** The follow-up (GH-263) built the tooling
  and wrote the outcome and void rules below, but stopped before any shifted run was
  recorded, so those cases are still unexamined: the flake is neither reproduced nor
  excluded under those calendar conditions.
- **Head, shifted, loaded (midnight, +400d, Monday, month end):** **0 of 4 runs obtained.**
  The two earlier head runs under faketime (table "Anchored clock, zones and drift") were
  unloaded and left one test out with `--grep-invert`, so they do not count as full runs
  and are not repeated here as evidence of the suite.
- **The Variedades test under the preload:** see "`+0d` comparison": it fails with the
  preload and no shift, on the base and on the head, and passes without the preload. That is
  the ADR-0043 amendment point 5 reading (a setup artifact of the shifting tool). It was
  checked by the comparison, no longer only a reading.

The change makes the next red run leave evidence (junit, trace, screenshot) and removes the
dependencies the code can name; it does not claim the flake is gone.

## Count of listed tests

`npx playwright test --list` from `web/`:

| | total |
|---|---|
| before the fold (base head, projects `secure-origin`, `insecure-origin`, `timed`) | 102 tests in 29 files |
| after the fold (`secure-origin`, `insecure-origin`) | 102 tests in 29 files |

Both figures come from `npx playwright test --list` run from `web/`, the first on a tree
checked out at `195a0af2` and the second on the head of GH-263, in the same session.
The invariant that holds is that the total before the fold equals the total after it; no
number is fixed in advance (the 87 in ADR-0040 was a count of an earlier suite).

## Pre-change loaded runs, case (a): the real clock

Each is `taskset -c 0,1 npm --prefix web run e2e` on the base code, with
`taskset -c 0,1 uv run --no-project pytest -n auto -q` looping in another shell
(`web/e2e/helpers/signup.ts` temporarily timed each accept-invitation POST via
`request.timing()`; that edit is not committed).

| run | exit | wall time | phase 1 | phase 2 (`timed`) |
|---|---|---|---|---|
| 1 | 0 | 462 s | 100 passed (6.9 m) | 2 passed (39.0 s) |
| 2 | 0 | 407 s | 100 passed (5.8 m) | 2 passed (48.5 s) |
| 3 | 0 | 611 s | 100 passed (9.2 m) | 2 passed (44.9 s) |
| 4 | 0 | 683 s | 100 passed (10.2 m) | 2 passed (54.8 s) |
| 5 | 0 | 582 s | 100 passed (8.7 m) | 2 passed (46.1 s) |

Failures: **0 of 5** in case (a). No failing test name to report.

Note: two of the five loaded runs (611 s and 683 s) went past the agentic system's 600 s
check timeout and a third took 582 s. That is the cost of two cores shared with a looping
pytest, not a failure, but it is a figure to know.

### Shifted clock cases (b), (c), (d): tooling built, runs not recorded

Earlier this machine had no libfaketime. GH-263 unpacked libfaketime 0.9.10 (Ubuntu
`faketime` + `libfaketime`, `dpkg -x` under `/tmp`, outside the repository) and used it
through `LD_PRELOAD` with `FAKETIME_CACHE_DURATION=1`. A canary spec (not committed) signs a
business up and prints the backend's `GET /auth/me` `today`, node's now and
`page.evaluate(() => new Date().toISOString())`. A smoke check with `FAKETIME="+86400s"` on
the head printed `server_today=2026-10-07 node_now=2026-10-18T03:58:21Z
browser_now=2026-10-18T03:58:21Z`: node and the browser followed the shift, the backend
stayed on the anchor (see "Head reading"). On the base, a backend and its canary with no shift
printed the real date, 2026-10-17.

**What was not done.** Of the 15 base runs for cases (b), (c) and (d) (5 each) and the 4
head runs, none is recorded here: the turn budget of the follow-up ended first. The first
queued runs were still executing when it ended, so none counts. Cases (b), (c) and (d) are
reported as "0 of 5 obtained" each, base, and "0 of 1 obtained" each, head, with no outcome.

### Outcomes and void rules for a shifted run

Written before any shifted run is reported.

**Outcomes** (a run is evaluated for voiding first, then for its outcome):

- **green**: `npm --prefix web run e2e` exits 0 over the full listed set.
- **green-except-artifact**: exit 1, and the junit names exactly one failed test, the one the
  `+0d` comparison classed as an artifact (`varietiesAutoSelect.spec.ts › a tap that leaves
  Variedades on the phone is not replaced when the viewport turns computer`), failing the same
  way (the 160 s timeout on `send.click`). This outcome exists because the `+0d` comparison
  below classed that test, on the base and on the head.
- **red**: anything else.

**Void rules.** A run is voided only for one of these, evaluated from the canary and the
junit times before its outcome is read; nothing else voids a run:

1. A clock it claims shows the wrong date. On the head, a backend that is not on 2026-10-07 is
   **red**, not void.
2. Cases (b) and (d) only: the before-canary is already past the boundary, or the
   after-canary is still before it.
3. Cases (b) and (d) only: the junit's first test, converted to faked time with N, is not
   before the boundary, or its last test is not after it.
4. The run was killed by something outside the repository, with evidence.

A voided run stays in the table with its rule and its outcome. A case allows at most 3 voids
(base and head counted separately); a case that reaches the cap, or hits the same rule among
1 to 3 three times in a row, is reported "not obtainable" and is not rerun.

**Every shifted run** uses one relative `FAKETIME="+<N>s"` for all its processes, never
`@...`, where N = planned instant minus real UTC at launch. It records N, the real launch time
and the planned instant, and a canary before and after the run. On the base, a shifted run
counts only if all three canary clocks show the shifted date; on the head only if node and the
browser show the shifted date and the backend shows 2026-10-07. If the browser reading does not
follow the preload, no browser coverage is claimed for that run.

### Head reading

`setClockOffset` in `web/e2e/fixtures.ts` (lines 68 to 77) calls `execFileSync` with no `env`, and
the backend spawn (`fixtures.ts`, line 107) spreads `process.env`; both inherit `LD_PRELOAD` and
`FAKETIME`. The offset is computed from the faked now, so on the head the backend starts on the
anchor day, 2026-10-07, under any shift, and the date it reads is not the shifted one.

### The `+0d` comparison (ADR-0043 amendment, point 5)

Full suite, unloaded, nothing excluded, no shift. "off" is no `LD_PRELOAD`; "+0d" is
`LD_PRELOAD` with `FAKETIME="+0d"`. Each is `npm --prefix web run e2e`. The canary spec was
in the tree for some runs (noted); the Variedades row is the figure that matters.

| code | preload | exit | listed | Variedades test | canary spec in the run |
|---|---|---|---|---|---|
| base `195a0af2` | off | 0 | phase 1: 101, phase 2: 2 (103) | passed | yes (+1) |
| base `195a0af2` | +0d | 1 | phase 1: 101, phase 2: 2 (103) | **failed**, 160 s timeout on `send.click` | yes (+1) |
| head | off | 0 | 103 | passed | yes (+1) |
| head | +0d | 1 | 102 | **failed**, 160 s timeout on `send.click` | no |

Every other test passed in all four. So, on both codes, the test fails with the preload at no
shift and passes without it: it is classed a faketime artifact, ADR-0043 point 5, and it is
not a calendar finding. The cause inside the tool (the 20x CPU throttle with a hooked clock) is
still unexplained, so this is a classification by comparison, not a root cause. The
base runs have no junit (the base `playwright.config.ts` writes none); their evidence is the
run log.

### Ceiling: issue request for the integrator

Title: "e2e: tapBudget.spec.ts runs within 2x of the 160 s test timeout under load".
Evidence: 90 s against `timeout: 160_000` (1.78x), measured over the five loaded runs of case
(a) (table above); the new unloaded runs of this follow-up finished every `tapBudget` test, and
no new loaded run was recorded, so there is no newer maximum. Suggested limit: a timeout of at
least 2x the largest loaded maximum, or split the spec. The timeout is not changed here.

## Load figures (from the five loaded runs)

- **Accept-invitation POST** (scrypt, ADR-0002): 235 signups, max **5_203 ms**, p95
  3_985 ms. Ceiling: `expect` 17_000 ms, so 3.3x the maximum. Not within 2x.
- **Longest passing test per spec** (s, over the 5 runs): tapBudget 90, navigation 72,
  pressed 58, payments 54, flow 51, insets 49, varietiesAutoSelect 43, passwords 42,
  settings 40, withdrawals 39, panel 38, analysis 38, nuevaVentaTelefono 36, theme 36,
  ventasPhone 33, archivadas 32, sales 31, customers 31, leaveWithBack 31, ventasLinea 28,
  catalog 27, ventasTelefono 25, onboarding 25, priceModal 23, catalogInsecureOrigin 22,
  pinnedCatalog 21, install 3, barFit 2, consoleCollector 2.
- **Ceilings**: `timeout` 160 s, `expect` 17 s, `sales.spec.ts` 240 s (31 s measured, 7.7x).
- **A ceiling within 2x of a measured maximum**: `tapBudget.spec.ts`, 90 s against the 160 s
  `timeout` (1.78x). Nothing was raised. This is the issue request below ("Ceiling"), for the
  integrator to file, with these figures; a test under load that needs 90 s of 160 s is where a
  slower box would turn red with no code change.

## Coupling runs (unloaded)

- **Each spec file alone**, its own invocation (`npx playwright test e2e/<file>`): all 29
  files green, 102 tests in total, the same as the full run. No difference.
- **`--workers=1`, spec files in reverse alphabetical order** (a throwaway config with one
  project per file, reversed; not committed): 102 passed (9.0 m), exit 0. No spec depends on
  another's state or order. No spec was changed.

## Zone and drift runs

Not part of this subtask: the browser-zone pin is asserted by `web/src/architecture/e2eShape.test.ts`
(`timezoneId` and `locale` in the top-level `use`, none in a project). The two zone runs and the
run 400 days after the anchor belong to `e2e-clock-ts`.

## Red-run epilogue (`web/scripts/e2e.sh`, subtask `e2e-failures`)

Throwaway specs under `web/e2e/` (not committed), run as `sh scripts/e2e.sh e2e/<spec>`:

- **Red.** A spec with one failing and one passing test: exit **1**, and the last lines were
  `e2e: failed:`, `zz_throwaway.spec.ts › throwaway fails`, and
  `e2e: traces in test-results/f86e8a0-20261017T002736Z`; the directory held `junit.xml` and
  the failing test's `trace.zip`.
- **Green.** One passing test: exit **0**, no epilogue.
- **Two consecutive runs** left two directories, `f86e8a0-20261017T002736Z` and
  `f86e8a0-20261017T002748Z`, each with its own `junit.xml`.

## Anchored clock, zones and drift (subtask `e2e-clock-ts`)

Head under test: the `e2e-clock-ts` branch (workers on the anchored clock, `analysis.spec.ts`
date in UTC). All runs are `npm --prefix web run e2e`, unloaded, on the developer's machine.

| run | how | result |
|---|---|---|
| default | none | 102 passed (3.2 m), exit 0 |
| zone | `TZ=Pacific/Auckland` | 102 passed (5.2 m), exit 0 |
| zone | `TZ=UTC` | 102 passed (6.0 m), exit 0 |
| faketime, crossing an Argentina midnight | start `@2026-10-16 02:58:30` UTC (23:58:30 in Argentina, time running, the run took 10 m so it crossed 03:00 UTC), `TZ=UTC` | 101 passed + the canary, exit 0, with one spec excluded (below) |
| faketime, 400 days after the anchor | start `@2027-11-12 12:00:00`, `TZ=UTC` | 101 passed + the canary, exit 0, with the same spec excluded |

`faketime` is libfaketime 0.9.10 (Ubuntu package `faketime` + `libfaketime`, unpacked with
`dpkg -x` under `/tmp`, used with `LD_PRELOAD` and `FAKETIME_CACHE_DURATION=1`). It is
inherited by node, python, uvicorn and Chromium alike.

**Canary.** A throwaway spec (not committed) signed a business up and read `GET /auth/me`.
Midnight run: `CANARY server today=2026-10-07 node-now=2026-10-16T03:07:14Z`. 400-day run:
`CANARY server today=2026-10-07 node-now=2027-11-12T12:06:19Z`. The process clock was shifted
(`node-now`) and the backend's calendar still read the anchor, 2026-10-07: the runs are not void.

**One spec excluded under faketime.** `varietiesAutoSelect.spec.ts › a tap that leaves
Variedades on the phone is not replaced when the viewport turns computer` times out at 160 s
on `send.click` (it drives `Emulation.setCPUThrottlingRate` 20x). It failed in 2 of 2 full
runs under faketime and in a single-spec run under faketime at a fixed noon (so not tied to
midnight or to the date), and passed in the default, Auckland and UTC runs and in a
single-spec run with no faketime (32.8 s). So it depends on `LD_PRELOAD`-ed time in the
browser, not on the calendar: I read it as a faketime artifact (throttled Chromium with a
hooked clock), **not proven**. Both faketime runs above exclude it with
`--grep-invert "a tap that leaves Variedades"`; the 101 are green. Because of that exclusion those two runs cover 101 of 102 tests and are not used as full-suite evidence by this document. The first midnight run
(with the spec included, `FAKETIME_NO_CACHE=1`) was 101 passed and that 1 failed (the excluded spec).

**Contexts made by hand.** A throwaway spec (not committed), under `TZ=Pacific/Auckland`,
compared the fixture's `page` with a page of `browser.newContext({ baseURL })`: both
`America/Buenos_Aires` and `es-AR`. So `CONTEXT_DEFAULTS` was not needed.

**Listed total.** `npx playwright test --list` after this subtask: 102 tests in 29 files,
the same as before.
