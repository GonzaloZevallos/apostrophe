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

## Amendment (GH-476): gating is the `needs` closure of `ci:`, and `CI_FORMS` ties a check to its CI form

- **Gated jobs.** `ci: [ci-ok]` names one job. The gated jobs are its transitive `needs` closure, and
  `ci-ok` must `need` every other job and carry `if: always()` (ADR-0067). `PARKED` and its tests are gone:
  e2e gates again, so `npm --prefix web run e2e` is a check of the full tier and of CI.
- **`CI_FORMS`.** A check that CI runs in another form (pytest in area shards, vitest with coverage and a
  selection, e2e in `--shard=i/N`) has an entry `check -> exact run: line` in `tests/test_stack_ci.py`. A
  check is either an exact step of one gated job or has a `CI_FORMS` entry that some gated job runs, never
  both; a `CI_FORMS` key that is not a check, or a value no gated job runs, is refused.
- **What proves a `CI_FORMS` check.** The check is proven when every shard the `changes` job selected
  either succeeded or was skipped on a `"false"` flag, which is what `ci_verdict.py` reads. `tests` and
  `tests-fast` both map to the pytest shard command: the `always` shard holds every top-level
  `tests/test_*.py` plus `architecture` and `migrations`, which covers every path `tests-fast` names.
