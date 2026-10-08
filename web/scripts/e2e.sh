#!/bin/sh
# The supported full e2e run (ADR-0040, GH-152): `npm run e2e`.
# Phase 1 runs every spec but `sales.spec.ts` on the configured workers; phase 2 runs
# `sales.spec.ts` alone, because it measures wall-clock time (a 300 ms list check) and
# must not share the machine with other workers' browsers. Phase 2 runs even when phase 1
# is red, so one run reports everything; the exit status is non-zero if either is.
# No `set -e`: a red phase must not skip the next one.
# Extra arguments reach both phases, so the affected form (scripts/affected.py, ADR-0039)
# can pass `--only-changed=<base>`; a phase it selects nothing from exits 0.
set -u

npx vite build || exit 1

status=0
npx playwright test --project=secure-origin --project=insecure-origin "$@" || status=1
npx playwright test --project=timed "$@" || status=1
exit $status
