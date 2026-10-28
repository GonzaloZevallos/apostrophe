---
status: accepted
date: 2026-10-26
---

# Local checks and CI run one list, enforced by a test

GH-432. CI was off from 2026-10-14 to 2026-10-25 (billing) and drifted: `ci.yml` ran
`mypy app tests scripts` while `checks.types` ran `mypy app tests`, so a script that was never
type-checked locally failed on GitHub's runner.

## Decision

- **One list.** Every command of `.agentic/stack.yaml` `checks` is a `run:` step of exactly one job of
  `.github/workflows/ci.yml`, verbatim. Every `run:` step of `ci.yml` is a `setup` command, a `checks`
  command or a named `CI_ONLY` entry. `tests/test_stack_ci.py` enforces it, with `ci:` absent and with it
  present, and when `ci:` is present, each of its names is a job id and every check runs in a gated job.
- **`CI_ONLY` entries, each with its reason** (in the test):
  - `npx --prefix web playwright install --with-deps chromium`: the runner needs the root `--with-deps`
    form of `setup.web-browsers`.
  - `npm --prefix web run e2e`: off locally by the owner's decision of 2026-10-26, not reopened here.
- **mypy sees `scripts/`.** `[tool.mypy]` carries `mypy_path = "scripts/design"` and
  `explicit_package_bases = true`, so `import sample_app` resolves as it does at run time. Nothing is
  silenced.
- **A CI-only check gates every merge.** With `ci:` on, e2e, which runs only in CI, gates every merge. Its
  flakes are fixed at their cause and never retried away.

## Rejected

- **Reading `ci.yml` by hand at review.** It is the drift this ADR closes; a test does not forget.
- **`exclude = ["scripts"]` for mypy.** It hides the file instead of checking it.

## Amendment (GH-444): `PARKED` commands run in CI and gate nothing

- **`PARKED` beside `CI_ONLY`.** `tests/test_stack_ci.py` gets a second dict, `PARKED`, in the same shape
  (command, reason). A parked command is a known `run:` step of `ci.yml` that some job must run, so it is
  never dead; it runs on every pull request and gates nothing. With `ci:` set, the test refuses a parked
  command that sits in a gated job, and refuses a command listed in both dicts. `CI_ONLY` keeps its rule:
  with `ci:` set, its command is in a gated job.
- **e2e moves from `CI_ONLY` to `PARKED`.** By the owner's decision of 2026-10-26 (local e2e off, PR #434)
  and because `flow.spec.ts` flakes (#428), `npm --prefix web run e2e` stays out of `ci:`. It joins `ci:`
  when the owner turns local e2e back on and #428 has fixed the flake; the entry then leaves `PARKED`.
- **Superseded.** The bullet "A CI-only check gates every merge" no longer holds for e2e: `ci: [test, web]`
  gates the merge, and `test` and `web` together run every check of `.agentic/stack.yaml`.

## Amendment (GH-448): `SPLIT`, the aggregator, and the end of `PARKED`

- **`SPLIT`.** `tests`, `web-tests` and `web-e2e` are not one verbatim step: each is a (job, step
  template) entry where `{check}` is the declared command, so `pytest` runs per group, vitest with
  coverage and e2e per shard, and a change to the command still reaches the step.
- **The aggregator.** `ci: [ci-ok]`. The test requires that `ci-ok` needs every other job, runs with
  `if: always()` and has the verdict script as its only step; the jobs it needs cover every check and
  every `CI_ONLY` command. Matrices must read from `changes`, e2e shards need only `changes` and `build`,
  and only `coverage` may write to a pull request (ADR-0055).
- **`PARKED` is gone.** e2e is a merge condition again (owner, 2026-10-27): `web-e2e` is in `checks`,
  and the flake of #428 is fixed at its cause, in #428, #429 and #430, never retried away.
