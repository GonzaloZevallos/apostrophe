# GH-251: evidence for the `web-e2e` flake

Base head of the measurements: `195a0af2` (the base of this branch). The flake itself was
seen on `dbe57a27` (GH-218). None of this is a gate step: they are one-off runs on the
developer's machine (16 cores, shared), recorded once.

## What is and is not proven

The root cause on `dbe57a27` is **not** proven. The 5 loaded runs below are 5 of the 20 the
plan asked for, and "not reproduced" means 0 of 5 in the real-clock case, nothing stronger.
Cases (b), (c) and (d) could not be run (see "Shifted clock cases"). The change makes the
next red run leave evidence (junit, trace, screenshot) and removes the dependencies the code
can name; it does not claim the flake is gone.

## Count of listed tests

`npx playwright test --list` from `web/`:

| | total |
|---|---|
| before the fold (base head, projects `secure-origin`, `insecure-origin`, `timed`) | 102 tests in 29 files |
| after the fold (`secure-origin`, `insecure-origin`) | 102 tests in 29 files |

The plan expected 87; the suite has grown since ADR-0040 counted 87, so the recorded figure
is 102, and the invariant that matters (the same total before and after) holds.

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

### Shifted clock cases (b), (c), (d): not run

`faketime` is not installed on this machine (`which faketime` is empty), there is no compiler
to build libfaketime and no `sudo`. A case whose canary cannot show a shifted date is void
(ADR-0043), so cases (b) one minute before an Argentina midnight, (c) a Monday and (d) a
month's last day were not run. The anchored clock (subtask `e2e-clock-py`/`e2e-clock-ts`)
makes the backend independent of the date; the shifted runs belong to `e2e-clock-ts`'s
"verify zones and drift".

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
  `timeout` (1.78x). Nothing was raised. This is a candidate for the follow-up issue the
  integrator files, with these figures; a test under load that needs 90 s of 160 s is where a
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
