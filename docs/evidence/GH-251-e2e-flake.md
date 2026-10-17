# GH-251: evidence for the `web-e2e` flake

Base head of the measurements: `195a0af2` (the base of this branch). The flake itself was
seen on `dbe57a27` (GH-218). None of this is a gate step: they are one-off runs on the
developer's machine (16 cores, shared), recorded once.

## What is and is not proven

The root cause on `dbe57a27` is **not** proven, and this document does not claim the fold
removed the flake. Results are "k of n runs", outcome by outcome, never a rate. Runs listed as "obtained" are fewer than 5 where the remaining
ones were not yet run when this was written (b-b5, b-c5, b-d3, b-d4, b-d5): they are work still
to do, not voids and not "not obtainable". Outcomes are
defined in "Outcomes and void rules for a shifted run" below; the runs are in "Shifted runs,
loaded".

- **Case (a), real clock, base, loaded:** 0 failed of 5 runs (5 green). Nothing stronger.
- **Shifted, base, loaded** (the code of `195a0af2`, all three clocks shifted):
  - (b) a minute before an Argentina midnight: 4 of 5 runs obtained (3 green-except-artifact, 1 red);
  - (c) a Monday: 4 of 5 runs obtained (4 green-except-artifact);
  - (d) a month's last day into the next month: 2 of 5 runs obtained (2 green-except-artifact).
  In every obtained base run the only test that failed was the Variedades test; no other test
  failed. A run is green-except-artifact only if that test failed as the 160 s timeout on
  `send.click` (spec line 40), the way it fails at `+0d`; a run where it failed at another step is
  **red** by the definition, and its step is named in the table. The flake of `dbe57a27` (a
  failure other than the classified test) was **not reproduced** in these runs: with so few runs
  that is evidence neither for nor against it, and no rate is given.
- **Shifted, head, loaded** (node and browser shifted, backend on the anchor day):
  (b) midnight: 1 of 1 runs obtained (1 green-except-artifact); +400d: 1 of 1 runs obtained (1 green-except-artifact); (c) a Monday: 1 of 1 runs obtained (1 red); (d) month end: 1 of 1 runs obtained (1 green-except-artifact). The only failing test is again Variedades in each; the table gives
  its step, and a run where it is not the `send.click` timeout is red.
- **The Variedades test under the preload:** it fails with the preload at `+0d` (no shift) on
  the base and on the head, and passes without the preload (see "`+0d` comparison"). That is
  the ADR-0043 amendment point 5 reading (a setup artifact of the shifting tool), now checked
  by the comparison. Its cause inside the tool is not explained. Because of it, no shifted run
  here is "green"; the runs are green-except-artifact or red, and that test's behaviour under a
  shifted clock is not examined by them. That the same test also failed at a different step in
  the red runs (a viewport change or a closed target, still while its 20x CPU throttle was on)
  is not explained by the `+0d` comparison, which saw only the `send.click` timeout.
- **Browser coverage.** The browser canary followed the preload in every run (it shows the
  shifted instant), so browser-side date handling was shifted in all of them.
- **Earlier faketime runs** (table "Anchored clock, zones and drift") were unloaded and left
  one test out with `--grep-invert`; they are not full-suite evidence and are not counted.

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

### Shifted clock cases (b), (c), (d): how they were run

Earlier this machine had no libfaketime. GH-263 unpacked libfaketime 0.9.10 (Ubuntu
`faketime` + `libfaketime`, `dpkg -x` under `/tmp`, outside the repository) and used it
through `LD_PRELOAD` with `FAKETIME_CACHE_DURATION=1`. The base code at `195a0af2` was
exported with `git archive` into a tree under `/tmp` (with its own venv and `web/node_modules`
linked), because the sandbox does not allow `git worktree` for this role.

A canary spec (throwaway, never committed, copied into the tree only for the canary
invocation and removed before the full run, so no full run lists it) signs a business up and
prints the backend's `GET /auth/me` `today`, node's now and
`page.evaluate(() => new Date().toISOString())`. It ran as its own invocation before and after
each full run, under the same `LD_PRELOAD` and `FAKETIME`. Each full run is
`taskset -c 0,1 npm --prefix web run e2e` with `taskset -c 0,1 uv run --no-project pytest -n
auto -q` looping in another shell (the loop is stopped when the run ends), with the machine's
other processes checked with `pgrep` just before. Planned instants, N and the real launch
time are in the table. The run's launch time is the moment before the load loop starts, so the
canary before the run reads about 10 to 60 s after the planned instant was chosen; the planned
instant (02:56:00 UTC, four minutes before the boundary) was picked so that the boundary falls
inside the run.

**The backend's `today` is the Argentina date.** `GET /auth/me` answers the date in
Argentina (UTC-3). A planned instant of 02:56 UTC on 2026-10-18 is 23:56 on 2026-10-17 there,
so a base before-canary with `server_today=2026-10-17` next to a node reading of
2026-10-18T02:56Z is the shifted clock, not the real one; the after-canary showing
2026-10-18 (the real date is 2026-10-17 throughout) is what proves the backend itself
crossed the boundary. The same reading applies to (d): `2026-10-31` before and `2026-11-01`
after.

**The load check** in each row is the share of cores 0 and 1 and the load average read just
before the loop starts, and the processes found by `pgrep -af 'playwright test|uvicorn
tests.e2e_app'` (the agentic runtime's own process excluded). "others at launch" counts those
processes from other checkouts or earlier runs. No two of the runs in the table overlapped.
Three earlier base runs (labelled b-b4, b-c4, b-d3 at the time) did overlap, because two run
chains of mine were alive at once on the one base tree; they are **not in the table**, were
not read for an outcome, and are being rerun alone under the same labels, one at a time (b-b4 and b-c4 are done). That overlap is not one of
the closed void reasons, so it is disclosed here and not counted as a void. Other tasks on this shared machine ran their own e2e, which is a load this document records but
does not control.

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

| code | preload | exit | listed | Variedades test | run directory |
|---|---|---|---|---|---|
| base `195a0af2` | off | 0 | phase 1: 101, phase 2: 2 (103; the canary spec was in the tree, +1) | passed | log only (`/tmp/gh263/logs/z-base-off.e2e.log`; the base writes no junit) |
| base `195a0af2` | +0d | 1 | phase 1: 101, phase 2: 2 (103; canary spec, +1) | **failed**, 160 s timeout on `send.click` | log only (`z-base-zero.e2e.log`) |
| head | off | 0 | 103 (canary spec, +1) | passed | `web/test-results/2220b4e-20261017T041220Z` (junit: 103 tests, 0 errors) |
| head | +0d, run 1 | 1 | 102 | **failed**, 160 s timeout on `send.click` | `web/test-results/2220b4e-20261017T042031Z` (junit: 102 tests, 1 error) |
| head | +0d, run 2 | 1 | 102 | **failed**, 160 s timeout on `send.click` | `web/test-results/2220b4e-20261017T042831Z` (junit: 102 tests, 1 error) |

All five were unloaded runs. The second head `+0d` run overlapped in time with another
`web-e2e` check on this checkout (a review's, which finished before the next run began), so its
duration (10.2 m) is not a clean figure; its outcome, the same failure, is the same as run 1's.
Those run directories are ignored by git (`web/test-results/`), so they are on the developer's
machine only.

Every other test passed in all five. So, on both codes, the test fails with the preload at no
shift and passes without it: it is classed a faketime artifact, ADR-0043 point 5, and it is
not a calendar finding. The cause inside the tool (the 20x CPU throttle with a hooked clock) is
still unexplained, so this is a classification by comparison, not a root cause. The
base runs have no junit (the base `playwright.config.ts` writes none); their evidence is the
run log.

### Shifted runs, loaded

One row per run. N is the whole seconds added by `FAKETIME="+<N>s"` for every process of the run
(planned instant minus the real UTC at launch), so N, the real launch time and the planned
instant fit together. "Canary" gives the three clocks, before and after the run. The listed
count is the Playwright "Running N tests" figure of each phase, from the run's own log, on a
tree with no canary spec in it. A run directory under `web/test-results/` holds the head's
`junit.xml`; the base writes no junit (its config has none), so its evidence is the run's log
kept outside the repository. Rules 2 and 3 apply to (b) and (d) only; "pass" means the
before-canary was before the boundary, the after-canary past it, the first test before the
boundary and the last test after it, with the tests' times taken from the real-time stamps of
the run's log, converted with N. No run was voided by rules 1 to 4. In every row the failed test
is `varietiesAutoSelect.spec.ts › a tap that leaves Variedades on the phone is not replaced when
the viewport turns computer`; the table gives the step it failed at, read from the head's junit
and, for the base, from the log. A run is green-except-artifact only if that step is the 160 s
timeout on `send.click` (spec line 40), and red otherwise.

| run | case | code | N / real launch / planned instant | canary before and after | listed | outcome | failed tests | run directory | load check | rules 2 and 3 |
|---|---|---|---|---|---|---|---|---|---|---|
| b-b1 | (b) midnight | base | 76643 / 2026-10-17T05:38:11Z / 2026-10-18T02:56:00Z | before: backend 2026-10-17, node 2026-10-18T02:56:11Z, browser 2026-10-18T02:56:11Z; after: backend 2026-10-18, node 2026-10-18T03:03:43Z, browser 2026-10-18T03:03:43Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-b1.e2e.log; no junit on the base)` | cpu0=22% cpu1=11%  loadavg=7.38 15.46 18.71; others at launch: 0 [] | Rules 2 and 3: pass
| b-b2 | (b) midnight | base | 74459 / 2026-10-17T06:14:35Z / 2026-10-18T02:56:00Z | before: backend 2026-10-17, node 2026-10-18T02:56:11Z, browser 2026-10-18T02:56:11Z; after: backend 2026-10-18, node 2026-10-18T03:05:24Z, browser 2026-10-18T03:05:24Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-b2.e2e.log; no junit on the base)` | cpu0=31% cpu1=29%  loadavg=13.79 18.83 18.80; others at launch: 2 ['GH-220'] | Rules 2 and 3: pass
| b-b3 | (b) midnight | base | 72544 / 2026-10-17T06:46:30Z / 2026-10-18T02:56:00Z | before: backend 2026-10-17, node 2026-10-18T02:56:13Z, browser 2026-10-18T02:56:13Z; after: backend 2026-10-18, node 2026-10-18T03:03:42Z, browser 2026-10-18T03:03:42Z | 102 (100 + 2) | red | Variedades (cdpSession.send at spec line 42: Target page, context or browser has been closed) | `(log only: /tmp/gh263/logs/b-b3.e2e.log; no junit on the base)` | cpu0=24% cpu1=12%  loadavg=5.53 8.98 12.19; others at launch: 0 [] | Rules 2 and 3: pass
| b-b4 | (b) midnight | base | 67538 / 2026-10-17T08:09:56Z / 2026-10-18T02:56:00Z | before: backend 2026-10-17, node 2026-10-18T02:56:42Z, browser 2026-10-18T02:56:42Z; after: backend 2026-10-18, node 2026-10-18T03:07:34Z, browser 2026-10-18T03:07:34Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-b4.e2e.log; no junit on the base)` | cpu0=98% cpu1=99%  loadavg=29.93 19.21 26.71; others at launch: 0 [] | Rules 2 and 3: pass
| b-c1 | (c) Monday | base | 195040 / 2026-10-17T05:48:53Z / 2026-10-19T12:00:00Z | before: backend 2026-10-19, node 2026-10-19T12:00:33Z, browser 2026-10-19T12:00:33Z; after: backend 2026-10-19, node 2026-10-19T12:10:45Z, browser 2026-10-19T12:10:45Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-c1.e2e.log; no junit on the base)` | cpu0=25% cpu1=17%  loadavg=15.16 15.99 16.90; others at launch: 0 [] |
| b-c2 | (c) Monday | base | 192772 / 2026-10-17T06:26:42Z / 2026-10-19T12:00:00Z | before: backend 2026-10-19, node 2026-10-19T12:00:12Z, browser 2026-10-19T12:00:12Z; after: backend 2026-10-19, node 2026-10-19T12:07:44Z, browser 2026-10-19T12:07:44Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-c2.e2e.log; no junit on the base)` | cpu0=30% cpu1=18%  loadavg=8.07 16.12 18.68; others at launch: 0 [] |
| b-c3 | (c) Monday | base | 190994 / 2026-10-17T06:56:20Z / 2026-10-19T12:00:00Z | before: backend 2026-10-19, node 2026-10-19T12:00:12Z, browser 2026-10-19T12:00:12Z; after: backend 2026-10-19, node 2026-10-19T12:09:32Z, browser 2026-10-19T12:09:32Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-c3.e2e.log; no junit on the base)` | cpu0=49% cpu1=33%  loadavg=6.76 9.25 11.18; others at launch: 0 [] |
| b-c4 | (c) Monday | base | 185660 / 2026-10-17T08:25:14Z / 2026-10-19T12:00:00Z | before: backend 2026-10-19, node 2026-10-19T12:00:15Z, browser 2026-10-19T12:00:15Z; after: backend 2026-10-19, node 2026-10-19T12:11:09Z, browser 2026-10-19T12:11:09Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-c4.e2e.log; no junit on the base)` | cpu0=80% cpu1=92%  loadavg=20.45 23.90 26.94; others at launch: 0 [] |
| b-d1 | (d) month end | base | 1284817 / 2026-10-17T06:01:56Z / 2026-11-01T02:56:00Z | before: backend 2026-10-31, node 2026-11-01T02:56:11Z, browser 2026-11-01T02:56:11Z; after: backend 2026-11-01, node 2026-11-01T03:04:44Z, browser 2026-11-01T03:04:44Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-d1.e2e.log; no junit on the base)` | cpu0=51% cpu1=30%  loadavg=8.86 15.06 18.39; others at launch: 0 [] | Rules 2 and 3: pass
| b-d2 | (d) month end | base | 1282741 / 2026-10-17T06:36:33Z / 2026-11-01T02:56:00Z | before: backend 2026-10-31, node 2026-11-01T02:56:11Z, browser 2026-11-01T02:56:11Z; after: backend 2026-11-01, node 2026-11-01T03:03:48Z, browser 2026-11-01T03:03:48Z | 102 (100 + 2) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `(log only: /tmp/gh263/logs/b-d2.e2e.log; no junit on the base)` | cpu0=28% cpu1=17%  loadavg=5.92 9.63 14.29; others at launch: 0 [] | Rules 2 and 3: pass
| h-b1 | (b) midnight | head | 80184 / 2026-10-17T04:39:10Z / 2026-10-18T02:56:00Z | before: backend 2026-10-07, node 2026-10-18T02:56:22Z, browser 2026-10-18T02:56:22Z; after: backend 2026-10-07, node 2026-10-18T03:07:45Z, browser 2026-10-18T03:07:45Z | 102 (102) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `test-results/81fdfb2-20261018T025623Z` | cpu0=62% cpu1=50%  loadavg=36.57 32.93 26.00; others at launch: 6 ['GH-263'] | Rules 2 and 3: pass
| h-c1 | (c) Monday | head | 197492 / 2026-10-17T05:08:02Z / 2026-10-19T12:00:00Z | before: backend 2026-10-07, node 2026-10-19T12:00:21Z, browser 2026-10-19T12:00:21Z; after: backend 2026-10-07, node 2026-10-19T12:13:21Z, browser 2026-10-19T12:13:21Z | 102 (102) | red | Variedades (page.setViewportSize at spec line 41: Test timeout of 160000ms exceeded.) | `test-results/81fdfb2-20261019T120022Z` | cpu0=38% cpu1=40%  loadavg=17.15 18.71 19.00; others at launch: 0 [] |
| h-d1 | (d) month end | head | 1287095 / 2026-10-17T05:23:59Z / 2026-11-01T02:56:00Z | before: backend 2026-10-07, node 2026-11-01T02:56:14Z, browser 2026-11-01T02:56:14Z; after: backend 2026-10-07, node 2026-11-01T03:07:46Z, browser 2026-11-01T03:07:46Z | 102 (102) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `test-results/81fdfb2-20261101T025616Z` | cpu0=33% cpu1=23%  loadavg=9.72 21.21 21.67; others at launch: 0 [] | Rules 2 and 3: pass
| h-400 | +400d | head | 33807978 / 2026-10-17T04:53:15Z / 2027-11-12T12:00:00Z | before: backend 2026-10-07, node 2027-11-12T12:00:14Z, browser 2027-11-12T12:00:14Z; after: backend 2026-10-07, node 2027-11-12T12:11:43Z, browser 2027-11-12T12:11:43Z | 102 (102) | green-except-artifact | Variedades (160 s timeout on send.click (line 40)) | `test-results/81fdfb2-20271112T120015Z` | cpu0=29% cpu1=22%  loadavg=7.82 13.80 18.99; others at launch: 0 [] |

The first head run, h-b1, was launched while the processes of a review's own `web-e2e` check
(on this same checkout, just finished) were still being torn down, which is why its load check
shows "others at launch: 6"; the run's own listed set and canaries are unaffected, and the load
only made it slower (11.1 m).

**Run directories.** `web/test-results/` is ignored by git and local. Of the directories named
above, those of h-b1 and of the head `+0d` runs are no longer there; `web/scripts/e2e.sh` removes
directories older than 14 days with `find -mtime +14` run under the same preload, so a later run
shifted forward (h-400, +400d, in particular) very probably removed them. That was not checked.
The run logs of every run, base and head, are kept under `/tmp/gh263/logs` outside the repository;
the table's results are read from them.
### Ceiling: issue request for the integrator

Title: "e2e: tapBudget.spec.ts runs within 2x of the 160 s test timeout under load".
Evidence: in the five loaded runs of case (a), the longest `tapBudget` test took 90 s against
`timeout: 160_000` (1.78x). In the shifted loaded runs of this document the largest `tapBudget`
time read from a run's log was 114 s (the head Monday run, h-c1, a `1.9m` line in the list
reporter, so rounded to 6 s), 1.4x below the ceiling: a box slower than this one turns that spec
red with no code change. Suggested limit: a timeout of at least 2x the largest loaded maximum
(so at least 228 s for 114 s), or split the spec. The timeout is not changed here; the integrator
files the issue.

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
  `timeout` (1.78x). Nothing was raised. This is the issue request above ("Ceiling"), for the
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
