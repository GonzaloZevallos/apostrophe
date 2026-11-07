#!/usr/bin/env bash
# Stress loop for GH-542's `QueuePool limit ... reached` in the mobile seed. Task evidence,
# not product tooling. Pattern of docs/evidence/GH-506/stress.sh.
#
# Usage: stress.sh <tree> <mode> <cap> <log>
#   tree  the `git rev-parse HEAD^{tree}` hash the current checkout must have; the script
#         refuses to run on any other tree, so every logged line names the tree it tested.
#   mode  squeezed  the mobile server of `scripts.stress.squeezed_mobile_app` with a pool of
#                   2 connections, no overflow, 2 s wait, diagnostics on (pool checkouts with
#                   their stacks, lock waiters), on a fresh file DB per iteration; then the
#                   real `scripts/design/mobile_seed.py` against it over HTTP.
#         default   the same seed against the plain `tests.e2e_app:create_mobile_e2e_app`
#                   (CI's server, SQLAlchemy's pool of 5 + 10, 30 s). Its peaks are `-`: the
#                   plain app has no diagnostics, and none is added to it.
#   cap   the most iterations of this tree+mode the log may hold. Never raised.
#   log   append-only log. One start line per invocation, one `iter` line per iteration and
#         a `summary` line only when the loop finishes (all `cap` iterations logged).
#
# An iter line: exit status of the seed, `first` = the first `sample-app:` line it printed,
# `peak_out` = the most `checkedout` the server log shows, `peak_waiters` = the most threads
# waiting on a business's pinned-catalog lock, `errors` = the SQLAlchemy error classes the
# server log names (TimeoutError, OperationalError). A red iteration also keeps the tail of
# the server and seed output beside the log. It resumes: it counts the `iter` lines already
# in the log for the same tree and mode and runs only what is missing up to the cap. A log
# with no `summary` line was interrupted.
# Not detached from the reaper on purpose: no setsid, nohup or disown.
set -u
set -m # job control: the server gets its own process group, killed whole

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <tree> <mode> <cap> <log>" >&2
  exit 2
fi
TREE=$1 MODE=$2 CAP=$3 LOG=$4

TOP=$(git rev-parse --show-toplevel) || exit 2
ACTUAL=$(git -C "$TOP" rev-parse --verify -q 'HEAD^{tree}' 2>/dev/null || { git -C "$TOP" add -A -- . ':!.venv' >/dev/null && git -C "$TOP" write-tree; }) || exit 2
if [ "$ACTUAL" != "$TREE" ]; then
  echo "refusing: checkout tree is $ACTUAL, asked for $TREE" >&2
  exit 2
fi
case "$MODE" in
  squeezed) FACTORY=scripts.stress.squeezed_mobile_app:create_squeezed_mobile_app ;;
  default) FACTORY=tests.e2e_app:create_mobile_e2e_app ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

mkdir -p "$(dirname "$LOG")"
touch "$LOG"
SCRATCH=${TMPDIR:-/tmp}/gh542-stress.$$
mkdir -p "$SCRATCH"
SERVER=""
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
stop_server() {
  if [ -n "$SERVER" ]; then
    kill -TERM -- "-$SERVER" 2>/dev/null
    wait "$SERVER" 2>/dev/null
    SERVER=""
  fi
}
cleanup() { stop_server; rm -rf "$SCRATCH"; }
trap cleanup EXIT
trap 'exit 143' TERM INT

count_iters() { grep -c "^iter tree=$TREE mode=$MODE " "$LOG"; }
free_port() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'; }
# Spaces and `=` out of a free-text field, so an iter line stays `key=value` pairs.
oneword() { tr -c 'A-Za-z0-9_./:>-' '_' | cut -c1-200; }

DONE=$(count_iters)
echo "start tree=$TREE mode=$MODE cap=$CAP logged=$DONE time=$(now)" >>"$LOG"

n=$DONE
while [ "$n" -lt "$CAP" ]; do
  n=$((n + 1))
  DB=$SCRATCH/mobile.$n.db
  SLOG=$SCRATCH/server.$n.log
  OUT=$SCRATCH/seed.$n.log
  PORT=$(free_port)
  export APOSTROPHE_SECRET_KEY=e2e-secret-key-not-for-production
  export APOSTROPHE_DATABASE_URL="sqlite:///$DB"
  export APOSTROPHE_PUBLIC_URL="http://127.0.0.1:$PORT"
  if [ "$MODE" = squeezed ]; then
    export STRESS_POOL_SIZE=2 STRESS_MAX_OVERFLOW=0 STRESS_POOL_TIMEOUT=2 STRESS_DIAGNOSTICS=1
  fi
  (cd "$TOP" && exec uv run --no-project uvicorn "$FACTORY" --factory --host 127.0.0.1 \
    --port "$PORT" --no-access-log) >"$SLOG" 2>&1 &
  SERVER=$!
  READY=no
  for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then READY=yes; break; fi
    sleep 0.5
  done
  if [ "$READY" = yes ]; then
    (cd "$TOP" && timeout 300 uv run --no-project python scripts/design/mobile_seed.py \
      --base "http://127.0.0.1:$PORT" --state "$SCRATCH/state.$n.json" \
      --facts "$SCRATCH/facts.$n.json") >"$OUT" 2>&1
    CODE=$?
  else
    echo "server did not become ready" >"$OUT"
    CODE=97
  fi
  sleep 1 # let the last post-write upkeep finish and log
  stop_server

  FIRST=$(grep -m1 '^sample-app:' "$OUT" | oneword)
  [ -n "$FIRST" ] || FIRST=-
  if [ "$MODE" = squeezed ]; then
    PEAK_OUT=$(grep -o 'checkedout=[0-9]*' "$SLOG" | cut -d= -f2 | sort -n | tail -1)
    PEAK_WAIT=$(grep -o 'lock-waiters peak=[0-9]*' "$SLOG" | cut -d= -f2 | sort -n | tail -1)
    [ -n "$PEAK_OUT" ] || PEAK_OUT=0
    [ -n "$PEAK_WAIT" ] || PEAK_WAIT=0
  else
    PEAK_OUT=- PEAK_WAIT=-
  fi
  ERRORS=$(grep -ohE '\b(TimeoutError|OperationalError)\b' "$SLOG" | sort -u | tr '\n' ';')
  [ -n "$ERRORS" ] || ERRORS=-
  if [ "$CODE" -eq 0 ]; then RESULT=green; else
    RESULT=red
    RED="${LOG%.log}-red-$MODE-${TREE:0:8}-$n.txt"
    {
      echo "== seed output (tail 40)"
      tail -n 40 "$OUT"
      echo "== server log: the first checkouts that reached the pool size (stack names the holder)"
      grep -m6 'checkedout=2 ' "$SLOG" | grep ' checkout '
      echo "== server log (tail 120)"
      tail -n 120 "$SLOG"
    } >"$RED"
  fi
  echo "iter tree=$TREE mode=$MODE n=$n result=$RESULT exit=$CODE first=$FIRST peak_out=$PEAK_OUT peak_waiters=$PEAK_WAIT errors=$ERRORS" >>"$LOG"
done

REDS=$(grep "^iter tree=$TREE mode=$MODE " "$LOG" | grep -c "result=red")
echo "summary tree=$TREE mode=$MODE n=$n red=$REDS cap=$CAP time=$(now)" >>"$LOG"
