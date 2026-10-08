---
status: accepted
date: 2026-10-08
---

# Affected-only checks: vitest by its graph plus the guards, e2e only for e2e-only changes, pytest full

agentic-system ADR-0046 lets a product declare, in `.agentic/stack.yaml`, an affected-only
form of a check (a command with the literal `{base}`, the task base sha) and a list of
`affected_fallback` globs. The Developer's and the reviewer's gates run the affected form
and rerun the check in full when it fails; the merge gate and CI always run the full
commands. The system reads only the exit code, and the contract is that an affected command
exits non-zero when it selects nothing. `checks`, `ci` and `.github/workflows/ci.yml` do
not change.

## Decision

1. **`tests` (pytest) has no affected form.** No selection plugin is installed, and the
   suite's guards read the whole repository (architecture, isolation sweep, gated routes,
   refusal codes, no-secrets, ADR numbers, migrations, naming, contrast, design tokens):
   any per-module selection would skip them. pytest already runs with `-n auto`. Revisit
   when pytest becomes the gate's slowest check.
2. **`web-tests` and `web-e2e` go through one wrapper**, `scripts/affected.py`, standard
   library only: `uv run --no-project python scripts/affected.py <vitest|e2e> {base}`.
   It lists the changed paths as `git diff --name-only --no-renames <base>` plus
   `git ls-files --others --exclude-standard`; a git failure or an empty list exits 1.
3. **vitest.** `vitest run --changed` builds its graph from transformed dependencies and
   drops an edge whose path does not exist, which a `?raw` import always is (the query is
   in the path). The whole-tree guards (`architecture/*`, `inAppState`, `routes.test.ts`)
   read their inputs through `import.meta.glob(..., { query: '?raw' })` or `readdir`, so a
   change to a file they scan never selects them; and the changed list leaves out
   untracked files. Proof, from a real base: a new `src/screens/HexProbe.tsx` with a hex
   literal, plus an edit to `src/format/money.ts`, makes plain `vitest run --changed` print
   `Test Files 42 passed (42)` with exit 0, missing `hexColors.real.test.ts`, which then
   fails in the wrapper's guard pass. The wrapper:
   - lists the selection (`vitest list --changed=<base> --filesOnly`) and exits 1 when it
     is empty, because `vitest run --changed` prints "No test files found, exiting with
     code 0" and exits 0;
   - runs `--changed=<base>`, and only when it passes runs the guard set.
4. **The guard set is discovered on every run, never listed.** A guard is a
   `web/src/**/*.test.{ts,tsx}` whose text, or the text of one relative non-test import of
   it (`./` or `../`, resolved through `.ts`, `.tsx`, `/index.ts`), matches
   `import\.meta\.glob\b`, `\breadFile`, `\breaddir`, `\bexistsSync`, `\?raw\b` or
   `\?url\b`. The rule errs toward running: an extra guard costs seconds, a skipped one
   gives a green on a partial set. **The limit:** a helper two imports away is not found.
   Revisit at the first guard helper that imports another helper.
5. **e2e.** The sound set is exactly `web/e2e/**/*.spec.ts` and `web/e2e/helpers/**`.
   Playwright's `--only-changed` follows only the import graph of the specs; that graph
   never reaches the backend, the built bundle (`web/dist`) or the files the specs read
   with `readFileSync`. So any changed path outside the sound set prints
   `affected: unsound -> full` and exits 1 before anything is built. Inside it, the wrapper
   lists the selection (`playwright test --list --only-changed=<base>`, no build, no server)
   and exits 1 when it is empty, because `--only-changed` exits 0 on an empty selection
   (a new helper no spec imports lists `Total: 0 tests in 0 files`); otherwise it runs
   `npm --prefix web run e2e -- --only-changed=<base>` and returns its code unchanged.
   Listing first also means an empty selection never pays for `vite build`; a non-empty
   one pays it once, as the full form does.
6. **Fallback breadth.** The list applies to every check at once and its `*` crosses `/`,
   so it holds only what can mislead a selection: workflows, lockfiles, `pyproject.toml`,
   `web/package.json`, the vite, playwright and tsconfig files, `web/src/test-setup.ts`,
   `web/e2e/env.ts` and `freePort.ts`, `app/legacy_front_paths.json`, `app/migrations/*`,
   `tests/conftest.py`, `tests/fixtures/*`, `tests/fakes/*`, and the wrapper itself
   (`scripts/affected.py`, `scripts/__init__.py`). `app/**` and `web/src/**` are left out
   on purpose: either would force every check to full on nearly every task. The system
   adds `.agentic/stack.yaml` itself. No e2e-sound path matches a fallback glob, or a
   spec-only change could never be affected-only; `tests/test_stack_affected.py` checks it.
7. **What it saves.** Only changes confined to specs and their helpers skip the full
   e2e. Of the last 50 merged commits on master (first-parent, up to `064d380`), 1 touches
   only that set. No duration is promised: a unit-test change costs vitest's selection plus
   the guard set (8 files today), and the e2e saving is rare.
8. **Known risks.** (a) The graph rules were read from vitest 5.0.3: a vitest upgrade is
   the trigger to rerun the real-base proofs (the four guard diffs, an empty selection and
   an unknown sha). (b) The wrapper diffs `<base>` against the working tree while vitest
   diffs `base...HEAD`; the wrapper can only judge a larger set than vitest runs, the safe
   direction. (c) A new file with no test importing it selects nothing, so the wrapper exits
   1 and the gate runs the full check; the guard pass runs after a non-empty selection.

## Consequences

- **§7 (observability).** Nothing is emitted beyond one fixed stderr line per branch of
  the wrapper (`affected: ...`); it prints no file contents.
- **§8 (security, performance).** Nothing new is reachable: the wrapper runs only `git`,
  `npx vitest list`, `npx playwright test --list` and the two npm scripts the product
  already declares, in the same checkout. The base sha is refused if it starts with `-`.
  The cost grows with the number of test files for the guard discovery (a read of each
  `web/src` test file and its one-level imports), well under a second today.
