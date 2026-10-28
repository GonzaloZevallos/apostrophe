#!/bin/sh
# The supported full e2e run (ADR-0040, GH-152, GH-251): `npm run e2e`.
# `vite build`, then one `npx playwright test` on the configured workers, whose exit status
# is returned unchanged. There is one phase: no spec measures elapsed time (ADR-0038).
# Extra arguments reach Playwright, so the affected form (scripts/affected.py, ADR-0039) can
# pass `--only-changed=<base>`. No option turns zero selected tests into success: an empty
# selection is sent to the full run by scripts/affected.py.
#
# Each run writes into its own directory, `test-results/<short sha>-<UTC stamp>`, so a rerun
# never overwrites the traces of the run before it. The `date -u` below is the harness's one
# deliberate real-clock read: it names a directory and is read by no assertion (ADR-0040).
# A red run ends with the failing tests' names and that directory.
set -u

# Runs older than 14 days go (CI keeps its upload for the same 14).
if [ -d test-results ]; then
  find test-results -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
fi

PLAYWRIGHT_OUTPUT_DIR="test-results/$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date -u +%Y%m%dT%H%M%SZ)"
export PLAYWRIGHT_OUTPUT_DIR

# CI builds `dist` once in its own job and hands it to every shard: E2E_DIST_READY=1 skips the
# build here and nothing else changes. Unset, the run builds as always.
if [ "${E2E_DIST_READY:-}" != "1" ]; then
  npx vite build || exit 1
fi

npx playwright test "$@"
status=$?

if [ "$status" -ne 0 ]; then
  echo "e2e: failed:"
  uv run --no-project python ../scripts/e2e_failures.py "$PLAYWRIGHT_OUTPUT_DIR/junit.xml"
  echo "e2e: traces in $PLAYWRIGHT_OUTPUT_DIR"
fi

exit "$status"
