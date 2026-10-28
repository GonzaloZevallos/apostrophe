---
status: accepted
date: 2026-10-28
---

# CI runs only the suites a change affects, in shards, with coverage

GH-448. One `ci.yml` job ran every suite serially on every pull request. Now a first job decides what the
change affects, the suites run in parallel, and one job says whether the pull request may merge.

## Decision

- **Jobs.**

  | Job | Runs | When |
  | --- | --- | --- |
  | `changes` | `scripts/ci_changes.py`: the three selections as job outputs | always |
  | `test` | `ci-lint`, `lint`, `types`, `tests-fast` (the "always" paths, read from `stack.yaml`) | always, needs nothing |
  | `web` | `web-types`, `web-lint`, `web-tests` with coverage | vitest selected |
  | `build` | `web-build`, uploads `web/dist` | vitest or e2e selected |
  | `pytest` | one matrix entry per selected group, with coverage | any group selected |
  | `e2e` | Playwright `--shard`, on the selected specs, with the prebuilt `dist` | e2e selected; needs only `changes` and `build` |
  | `coverage` | job summary, PR comment, `master` area-map check | after the suites |
  | `ci-ok` | `scripts/ci_verdict.py` over `needs` | `if: always()` |

  Every matrix is `fromJSON` of an output of `changes`; none is written in the file.
- **`ci-ok` is the one gated name** (`ci: [ci-ok]`). It needs every other job and fails on any `failure`
  or `cancelled` result; `success` and `skipped` pass. A selection error therefore fails only by selecting
  more, never by hiding a failure.
- **Every selection fails open.** An unknown path, an empty diff, a missing parent, a git error, a path of
  `affected_fallback` and a push to `master` select everything.
- **Pytest groups.** The "always" set is the `tests-fast` command of `stack.yaml`, never listed twice. The
  groups are one per `tests/<d>` that has an `app/<d>`, plus `rest`.
- **The map is derived from the tests.** `scripts/pytest_areas.json` says which groups execute an area; it
  comes from a `--cov-context=test` run, counting setup, run and teardown, and excludes only the root
  modules of `app/` and `app/shared`. On a push to `master` the `coverage` job derives it again, uploads
  the result as `pytest-areas` and warns when the committed map lags.
- **Deviation from the owner's decision 2** ("a change under `app/<area>` runs that area's tests"): it also
  runs every group whose tests execute that area, because a fixture of one area seeds another over HTTP.
  Running only the area's own tests would miss exactly those failures.
- **Permissions.** The default is `contents: read`; only `coverage` has `pull-requests: write`, and its
  comment step is skipped on forks.
- **Concurrency.** The group is `ci-${{ github.ref }}`; a newer push cancels a pull request's run, never a
  `master` run.
- **Coverage is reported, not enforced.** Totals come from `scripts/ci_coverage.py` alone. No threshold.

## Rejected

- **`pytest-split`.** It balances by duration but needs stored timings and says nothing about what a change
  affects.
- **Building `dist` in every shard.** Four builds for one result; the prebuilt `dist` is the same bytes.
