#!/usr/bin/env bash
# Comparisons in one command (agentic-system ADR-0040, the `compare` of `.agentic/stack.yaml`'s
# `design` block): starts the sample app on a throwaway database, waits for its facts, writes
# each design screen next to the same built screen (scripts/design/comparisons.mjs), stops the
# app, and prints where the images went. Extra arguments go to comparisons.mjs (`--only A,B`).
# It then prints the phone check's known offenders per issue and per rule (GH-80, CODING_STANDARDS
# §10 "Phone"). With `COMPARE_MOBILE=1` it also runs the check itself (`mobile.spec.ts`, which
# needs a browser and a minute or more), so an area PR can attach the run and not only the counts.
set -euo pipefail
cd "$(dirname "$0")/../.."
work="$(mktemp -d)"
out="$work/comparisons"
log="$work/sample-app.log"
# Its own process group, so stopping it also stops the server it execs into.
setsid scripts/design/sample-app.sh --dir "$work/app" > "$log" 2>&1 &
pid=$!
trap 'kill -- -"$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
facts=""
for _ in $(seq 1 240); do
  facts="$(sed -n 's/^facts: //p' "$log" | head -1)"
  [ -n "$facts" ] && break
  kill -0 "$pid" 2>/dev/null || { cat "$log" >&2; echo "compare: the sample app stopped before it was ready" >&2; exit 1; }
  sleep 0.5
done
[ -n "$facts" ] || { cat "$log" >&2; echo "compare: the sample app was not ready in 120 s" >&2; exit 1; }
node scripts/design/comparisons.mjs --facts "$facts" --out "$out" "$@"
echo "comparisons: $out (one PNG per screen; index.json lists each and any step that failed)"
node scripts/design/mobile-offenders.mjs
if [ "${COMPARE_MOBILE:-}" = "1" ]; then
  (cd web && npx vite build && npx playwright test --project=mobile --workers=4)
fi
