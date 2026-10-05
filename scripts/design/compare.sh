#!/usr/bin/env bash
# Comparisons in one command (agentic-system ADR-0040, the `compare` of `.agentic/stack.yaml`'s
# `design` block): starts the sample app on a throwaway database, waits for its facts, writes
# each design screen next to the same built screen (scripts/design/comparisons.mjs), stops the
# app, and prints where the images went. Extra arguments go to comparisons.mjs (`--only A,B`).
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
