#!/usr/bin/env bash
# Stress harness for the GH-543 web-e2e flake. Task evidence, not product tooling. Adapted from
# docs/evidence/GH-506/stress.sh: the same tree guard, the same append-only log with a cap that is
# never raised, and the same resume; the loop body is different.
#
# One run = every command of `checks:` in .agentic/stack.yaml started at once, as the gate does
# with `parallel_checks: true`. The reserved `docs` check is not in `checks:` and is not started.
#
# Usage: stress.sh <tree> <mode> <cap> <log>
#   tree  the `git rev-parse HEAD^{tree}` the checkout must have; the script refuses any other.
#   mode  all     every check starts at the same moment.
#         offset  every check but `web-build` starts at once; `web-build` starts 10 s after
#                 Playwright prints its first finished-test line (the forced interference of run 1). It
#                 refuses a tree whose stack.yaml has no `web-build` check.
#   cap   the most runs of this tree+mode the log may hold. Never raised.
#   log   append-only. One `start` line per invocation, one `run` line per run, one `check` line
#         per check of each run, a `summary` line when the loop finishes. The loop stops at the
#         first red `web-e2e` run (its output tail and web/dist listing are kept beside the log).
set -u
set -m # job control: each check gets its own process group, killed whole on a timeout

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <tree> <mode> <cap> <log>" >&2
  exit 2
fi
TREE=$1 MODE=$2 CAP=$3 LOG=$4
TOP=$(git rev-parse --show-toplevel) || exit 2
ACTUAL=$(git -C "$TOP" rev-parse --verify -q 'HEAD^{tree}') || exit 2
if [ "$ACTUAL" != "$TREE" ]; then
  echo "refusing: checkout tree is $ACTUAL, asked for $TREE" >&2
  exit 2
fi
case "$MODE" in all | offset) ;; *) echo "unknown mode: $MODE" >&2; exit 2 ;; esac

HEAD_SHORT=$(git -C "$TOP" rev-parse --short HEAD)
RUN_TIMEOUT=2400 # seconds per run; a check still running then is killed and logged rc=timeout
mkdir -p "$(dirname "$LOG")"
touch "$LOG"
SCRATCH=${TMPDIR:-/tmp}/gh543-stress.$$
mkdir -p "$SCRATCH"
trap 'rm -rf "$SCRATCH"' EXIT
trap 'exit 143' TERM INT

load3() { cut -d' ' -f1-3 /proc/loadavg | tr ' ' ','; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# name<TAB>command, in file order.
mapfile -t CHECKS < <(cd "$TOP" && uv run --no-project python -c '
import yaml
for name, cmd in yaml.safe_load(open(".agentic/stack.yaml"))["checks"].items():
    print(f"{name}\t{cmd}")
')
NAMES=()
for line in "${CHECKS[@]}"; do NAMES+=("${line%%$'\t'*}"); done
if [ "$MODE" = offset ]; then
  case " ${NAMES[*]} " in *" web-build "*) ;; *) echo "offset needs a web-build check" >&2; exit 2 ;; esac
fi
case " ${NAMES[*]} " in *" web-e2e "*) ;; *) echo "no web-e2e check" >&2; exit 2 ;; esac

count_runs() { grep -c "^run tree=$TREE mode=$MODE " "$LOG"; }
DONE=$(count_runs)
echo "start tree=$TREE head=$HEAD_SHORT mode=$MODE cap=$CAP logged=$DONE checks=${NAMES[*]// /,} time=$(now)" >>"$LOG"

start_check() { # name command run
  local name=$1 cmd=$2 n=$3
  (
    cd "$TOP" || exit 1
    t0=$SECONDS
    echo "$SECONDS" >"$SCRATCH/$n.$name.t0"
    timeout "$RUN_TIMEOUT" bash -c "$cmd" >"$SCRATCH/$n.$name.out" 2>&1
    echo "$? $((SECONDS - t0))" >"$SCRATCH/$n.$name.rc"
  ) &
}

n=$DONE
REDS=0
while [ "$n" -lt "$CAP" ]; do
  n=$((n + 1))
  LOAD_START=$(load3)
  T_RUN=$SECONDS
  for line in "${CHECKS[@]}"; do
    name=${line%%$'\t'*} cmd=${line#*$'\t'}
    if [ "$MODE" = offset ] && [ "$name" = web-build ]; then
      WEB_BUILD_CMD=$cmd
      continue
    fi
    start_check "$name" "$cmd" "$n"
  done
  OFFSET=-
  if [ "$MODE" = offset ]; then
    # Playwright's list reporter prints nothing at a test's start when stdout is not a tty (run 1
    # of the log waited for such a line and never started web-build); the first line it prints is a
    # finished test's `  ✓  <n> [project] › ...`. The trigger is that line, so `web_build_offset_s`
    # counts from the first test that finished, a little after the first test started.
    E2E_OUT=$SCRATCH/$n.web-e2e.out
    T_FIRST=
    while [ ! -f "$SCRATCH/$n.web-e2e.rc" ]; do
      if grep -Eq '^ +(✓|✘) +[0-9]+ \[[^]]+\] ›' "$E2E_OUT" 2>/dev/null; then T_FIRST=$SECONDS; break; fi
      sleep 1
    done
    if [ -n "$T_FIRST" ]; then
      sleep 10
      OFFSET=$((SECONDS - T_FIRST))
      echo "dist-at-web-build-start: $(ls -A "$TOP/web/dist" 2>&1 | tr '\n' ' ')" >"$SCRATCH/$n.dist-start"
      start_check web-build "$WEB_BUILD_CMD" "$n"
    else
      OFFSET=never-started
    fi
  fi
  wait
  LOAD_END=$(load3)
  WALL=$((SECONDS - T_RUN))
  read -r E2E_RC E2E_SECS <"$SCRATCH/$n.web-e2e.rc"
  BESIDE=$(printf '%s\n' "${NAMES[@]}" | grep -vx web-e2e | tr '\n' ',' | sed 's/,$//')
  if [ "$MODE" = offset ] && [ "$OFFSET" = never-started ]; then BESIDE=$(echo "$BESIDE" | sed 's/web-build,\?//; s/,$//'); fi
  OUT=$SCRATCH/$n.web-e2e.out
  # Signatures of the checks interfering: a built asset gone, no front, blank root.
  SIG=$(grep -Eo 'net::ERR_[A-Z_]+|MissingBuiltFront|ENOENT[^ ]*dist[^ ]*|Failed to load module script|404 \(Not Found\)' "$OUT" | sort | uniq -c | tr -s ' ' | tr '\n' ';')
  [ -n "$SIG" ] || SIG=-
  RUNDIR=$(grep -Eo 'traces in [^ ]+' "$OUT" | tail -n1 | sed 's/traces in //')
  [ -n "$RUNDIR" ] || RUNDIR=-
  if [ "$E2E_RC" -eq 0 ]; then
    RESULT=green FAILING=-
  else
    RESULT=red
    # `e2e: failed:` is followed by one `<file> › <title>` per failed test.
    FAILING=$(sed -n '/^e2e: failed:/,/^e2e: traces in/p' "$OUT" | sed '1d;$d' | tr '\n' ';')
    [ -n "$FAILING" ] || FAILING="?exit=$E2E_RC"
    REDS=$((REDS + 1))
    KEEP="${LOG%.log}-red-$MODE-${HEAD_SHORT}-$n"
    tail -n 300 "$OUT" >"$KEEP.txt"
    {
      echo "web/dist at the end of the run ($(now)):"
      ls -la --time-style=full-iso "$TOP/web/dist" "$TOP/web/dist/assets" 2>&1 | head -80
      [ -f "$SCRATCH/$n.dist-start" ] && cat "$SCRATCH/$n.dist-start"
    } >"$KEEP-dist.txt"
  fi
  echo "run tree=$TREE head=$HEAD_SHORT mode=$MODE n=$n load_start=$LOAD_START load_end=$LOAD_END beside=$BESIDE web_build_offset_s=$OFFSET wall_s=$WALL e2e_secs=$E2E_SECS result=$RESULT failing=$FAILING signature=$SIG run_dir=$RUNDIR" >>"$LOG"
  for line in "${CHECKS[@]}"; do
    name=${line%%$'\t'*}
    [ -f "$SCRATCH/$n.$name.rc" ] || { echo "check tree=$TREE mode=$MODE n=$n name=$name rc=not-started" >>"$LOG"; continue; }
    read -r rc secs <"$SCRATCH/$n.$name.rc"
    echo "check tree=$TREE mode=$MODE n=$n name=$name rc=$rc secs=$secs" >>"$LOG"
  done
  [ "$RESULT" = red ] && break
done

echo "summary tree=$TREE head=$HEAD_SHORT mode=$MODE n=$n red=$REDS cap=$CAP time=$(now)" >>"$LOG"
