#!/bin/sh
# The supported full e2e run (ADR-0040, GH-152, GH-251): `npm run e2e`.
# `vite build`, then one `npx playwright test` on the configured workers, whose exit status
# is returned unchanged. There is one phase: no spec measures elapsed time (ADR-0038).
# Extra arguments reach Playwright, so the affected form (scripts/affected.py, ADR-0039) can
# pass `--only-changed=<base>`. No option turns zero selected tests into success: an empty
# selection is sent to the full run by scripts/affected.py.
set -u

npx vite build || exit 1

npx playwright test "$@"
