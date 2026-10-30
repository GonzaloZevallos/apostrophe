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

## Amendment (GH-533): e2e is `CI_ONLY` and gates every merge

- **The owner's rule (2026-10-29).** A pull request lands only with every CI job green, e2e included. The
  merges of #523 and #525 landed with a red e2e because the job gated nothing.
- **#428 is closed.** The condition of the GH-444 amendment ("joins `ci:` when the owner turns local e2e back
  on and #428 has fixed the flake") no longer holds, and neither does its "Superseded" bullet.
- **Local web-e2e stays off** (owner, 2026-10-26). So `npm --prefix web run e2e` is a `CI_ONLY` command again,
  and `ci:` is `[test, web, docs, e2e]`. `PARKED` stays as a mechanism and is now empty.
- **The `CI_ONLY` rule is now every-holder.** With `ci:` set, every job that runs a `CI_ONLY` command is in
  `ci:`, one problem per ungated holder, so an unlisted e2e shard is refused.
- **e2e gates unconditionally** (no `if:`, no `needs:`) until GH-448 part 2 decides how a selectively skipped
  e2e is read (ADR-0064, rule 7).
