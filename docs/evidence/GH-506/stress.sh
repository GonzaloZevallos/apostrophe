#!/usr/bin/env bash
# Stress loop for the GH-506 web-tests flake. Task evidence, not product tooling.
#
# Usage: stress.sh <tree> <mode> <cap> <log> [extra...]
#   tree  the `git rev-parse HEAD^{tree}` hash the current checkout must have; the script
#         refuses to run on any other tree, so every logged line names the tree it tested.
#   mode  solo       `vitest run <extra[0]>` (one test file), cap iterations
#         full-load  `npm --prefix web test` with tests, types, web-types and web-build
#                    looping beside it, cap iterations
#         shuffle    `vitest run --sequence.shuffle --sequence.seed=<seed>`, seed logged
#         forced     `<extra...>` run from web/ as given (e.g. `taskset -c 0 npx vitest run f`)
#   cap   the most iterations of this tree+mode the log may hold. Never raised.
#   log   append-only log. One start line per invocation, one `iter` line per iteration and
#         a `summary` line only when the loop finishes (all `cap` iterations logged).
#
# It resumes: it counts the `iter` lines already in the log for the same tree and mode and
# runs only what is missing up to the cap. A log with no `summary` line was interrupted.
# Not detached from the reaper on purpose: no setsid, nohup or disown.
set -u
set -m # job control: background companions get their own process group, killed whole

if [ "$#" -lt 4 ]; then
  echo "usage: $0 <tree> <mode> <cap> <log> [extra...]" >&2
  exit 2
fi
TREE=$1 MODE=$2 CAP=$3 LOG=$4
shift 4

TOP=$(git rev-parse --show-toplevel) || exit 2
# A checkout made from `git archive` has no commit: its tree is the index's (`git write-tree`),
# without the `.venv` symlink to the task worktree's environment that the python companions use.
ACTUAL=$(git -C "$TOP" rev-parse --verify -q 'HEAD^{tree}' 2>/dev/null || { git -C "$TOP" add -A -- . ':!.venv' >/dev/null && git -C "$TOP" write-tree; }) || exit 2
if [ "$ACTUAL" != "$TREE" ]; then
  echo "refusing: checkout tree is $ACTUAL, asked for $TREE" >&2
  exit 2
fi
case "$MODE" in
  solo) [ "$#" -ge 1 ] || { echo "solo needs the test file" >&2; exit 2; } ;;
  forced) [ "$#" -ge 1 ] || { echo "forced needs the command" >&2; exit 2; } ;;
  full-load | shuffle) ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

mkdir -p "$(dirname "$LOG")"
touch "$LOG"
SCRATCH=${TMPDIR:-/tmp}/gh506-stress.$$
mkdir -p "$SCRATCH"
LOADPIDS=""
n=0

load1() { cut -d' ' -f1 /proc/loadavg; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Looping companions for full-load: the checks the merge gate runs beside web-tests.
# A companion that fails in under 10 s (a spawn error, a missing venv) stops looping instead of
# churning processes, and stop_load logs one `companion` line per command: how many runs started,
# how many finished, and whether it stopped for failing fast, so a dead companion shows in the log.
COMPANIONS=(
  "uv run --no-project pytest -n 8"
  "uv run --no-project mypy app tests scripts"
  "npm --prefix web run typecheck"
  "npm --prefix web run build"
)
start_load() {
  local idx=0 cmd
  for cmd in "${COMPANIONS[@]}"; do
    idx=$((idx + 1))
    (
      cd "$TOP" || exit 1
      while true; do
        echo start >>"$SCRATCH/comp.$n.$idx"
        t0=$SECONDS
        $cmd >/dev/null 2>&1
        rc=$?
        echo "done rc=$rc" >>"$SCRATCH/comp.$n.$idx"
        if [ "$rc" -ne 0 ] && [ $((SECONDS - t0)) -lt 10 ]; then
          echo fastfail >>"$SCRATCH/comp.$n.$idx"
          break
        fi
      done
    ) &
    LOADPIDS="$LOADPIDS $!"
  done
}
stop_load() {
  local pid idx=0 cmd f
  for pid in $LOADPIDS; do
    kill -TERM -- "-$pid" 2>/dev/null # job control: each companion has its own process group
  done
  LOADPIDS=""
  for cmd in "${COMPANIONS[@]}"; do
    idx=$((idx + 1))
    f=$SCRATCH/comp.$n.$idx
    [ -f "$f" ] || continue
    echo "companion tree=$TREE mode=$MODE n=$n cmd=\"$cmd\" started=$(grep -c '^start' "$f") finished=$(grep -c '^done' "$f") fastfail=$(grep -c '^fastfail' "$f")" >>"$LOG"
  done
}
cleanup() { stop_load; rm -rf "$SCRATCH"; }
trap cleanup EXIT
trap 'exit 143' TERM INT

count_iters() { grep -c "^iter tree=$TREE mode=$MODE " "$LOG"; }

DONE=$(count_iters)
echo "start tree=$TREE mode=$MODE cap=$CAP logged=$DONE time=$(now)" >>"$LOG"

n=$DONE
while [ "$n" -lt "$CAP" ]; do
  n=$((n + 1))
  OUT=$SCRATCH/out.$n
  SEED=-
  LOAD_START=$(load1)
  [ "$MODE" = full-load ] && start_load
  case "$MODE" in
    solo) (cd "$TOP/web" && npx vitest run "$1") >"$OUT" 2>&1 ;;
    full-load) (cd "$TOP/web" && npm test) >"$OUT" 2>&1 ;;
    shuffle)
      SEED=$(( (RANDOM << 15 | RANDOM) % 1000000 ))
      (cd "$TOP/web" && npx vitest run --sequence.shuffle --sequence.seed="$SEED") >"$OUT" 2>&1 ;;
    forced) (cd "$TOP/web" && "$@") >"$OUT" 2>&1 ;;
  esac
  CODE=$?
  [ "$MODE" = full-load ] && stop_load
  LOAD_END=$(load1)
  # The vitest summary (`Test Files  N passed (N)` / `Tests  M passed (M)`), kept per iteration.
  COUNTS=$(grep -E '^ *(Test Files|Tests) ' "$OUT" | sed -E 's/^ +//; s/ +/_/g' | tr '\n' ';')
  [ -n "$COUNTS" ] || COUNTS=-
  if [ "$CODE" -eq 0 ]; then
    RESULT=green FAILING=-
  else
    RESULT=red
    # Names of failing tests, as vitest prints them (`FAIL  file > describe > test`).
    FAILING=$(grep -E '^ *(FAIL|×) ' "$OUT" | sed -E 's/^ *(FAIL|×) +//; s/ \[[a-z]+\]//' | sort -u | tr '\n' ';')
    [ -n "$FAILING" ] || FAILING="?exit=$CODE"
    tail -n 200 "$OUT" >"${LOG%.log}-red-$MODE-${TREE:0:8}-$n.txt"
  fi
  echo "iter tree=$TREE mode=$MODE n=$n load_start=$LOAD_START load_end=$LOAD_END seed=$SEED result=$RESULT counts=$COUNTS failing=$FAILING" >>"$LOG"
done

REDS=$(grep "^iter tree=$TREE mode=$MODE " "$LOG" | grep -c "result=red")
echo "summary tree=$TREE mode=$MODE n=$n red=$REDS cap=$CAP time=$(now)" >>"$LOG"
