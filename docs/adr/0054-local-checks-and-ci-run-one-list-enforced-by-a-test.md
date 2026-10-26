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
