#!/usr/bin/env bash
# Screen images in one command (docs/product/screen-images.md, ADR-0079): captures every row that
# gets an image, built side only, in the pinned Playwright container, against the pinned sample app,
# encodes each picture to lossless webp and plans what `docs/assets/screens/` should hold.
#
#   scripts/design/screen-images.sh [--out DIR] [--apply] [--twice] [--mode local|pr] [--base-sha SHA]
#
# It writes `plan.json`, `summary.md` and the webp files to DIR (default: a temporary folder, printed).
# `--apply` captures twice (a row whose two captures differ in decoded pixels is a failure and keeps its
# committed image) and then applies the plan to `docs/assets/screens/`. `--twice` alone only reports how
# many rows differ, by name, and how long it took.
#
# This file makes no decision about what is written, removed or failed, or about its exit status: the
# plan, the not-started plan and the exit code come from `screenImages.mjs` through
# `screenImagesRun.mjs`. Here are only the processes: Docker, the sample app, the capture container.
# It exits non-zero when a row failed or the app did not start, after writing everything.
set -euo pipefail
cd "$(dirname "$0")/../.."
driver=(node scripts/design/screenImagesRun.mjs)
target=docs/assets/screens

out=""
apply=""
twice=""
mode="local"
base_sha=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out) out="${2:?--out needs a folder}"; shift 2 ;;
    --apply) apply=1; shift ;;
    --twice) twice=1; shift ;;
    --mode) mode="${2:?--mode needs local or pr}"; shift 2 ;;
    --base-sha) base_sha="${2:?--base-sha needs a sha}"; shift 2 ;;
    *) echo "usage: screen-images.sh [--out DIR] [--apply] [--twice] [--mode local|pr] [--base-sha SHA]" >&2; exit 2 ;;
  esac
done
[ -n "$out" ] || out="$(mktemp -d)"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
echo "screen-images: output in $out"

app_pid=""
temp_dirs=()
stop_app() {
  [ -z "$app_pid" ] || kill -- -"$app_pid" 2>/dev/null || true
  [ -z "$app_pid" ] || wait "$app_pid" 2>/dev/null || true
  app_pid=""
}
cleanup() {
  stop_app
  [ "${#temp_dirs[@]}" -eq 0 ] || rm -rf "${temp_dirs[@]}"
}
trap cleanup EXIT

# The last step of every run, whatever happened before it.
finish() {
  local code=0
  "${driver[@]}" exit-code --out "$out" || code=$?
  exit "$code"
}

not_started() {
  "${driver[@]}" not-started --reason "$1" --out "$out"
  finish
}

# Docker first: without it nothing is captured, and nothing in the folder changes.
docker info >/dev/null 2>&1 || not_started docker-unavailable
image="$("${driver[@]}" image)"
docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image" || not_started image-unavailable

# One sample app on a pinned instant and its own throwaway database, started in its own process group
# so stopping it also stops the server it execs into. Sets `facts`; the readiness loop is compare.sh's.
start_app() {
  local work="$1" log="$1/sample-app.log"
  # The app runs from the pass's own folder, not from the checkout, as a later pass's host directory.
  setsid bash -c 'cd "$1" && shift && exec "$@"' _ "$work" "$PWD/scripts/design/sample-app.sh" --pinned --dir "$work/app" > "$log" 2>&1 &
  app_pid=$!
  facts=""
  for _ in $(seq 1 600); do
    facts="$(sed -n 's/^facts: //p' "$log" | head -1)"
    [ -n "$facts" ] && break
    kill -0 "$app_pid" 2>/dev/null || { cat "$log" >&2; echo "screen-images: the sample app stopped before it was ready" >&2; not_started app-not-started; }
    sleep 0.5
  done
  [ -n "$facts" ] || { cat "$log" >&2; echo "screen-images: the sample app was not ready in 300 s" >&2; not_started app-not-started; }
}

# One pass: a fresh app, one container run into `$out/capture-N`. A later pass differs on purpose in
# its temporary paths, its host working directory, its output folder and its container uid, so a row
# that depends on any of them shows up as a row that differs.
capture_pass() {
  local number="$1" shift_uid="$2"
  local work
  work="$(mktemp -d)"
  temp_dirs+=("$work")
  start_app "$work"
  local capture="$out/capture-$number"
  # An earlier run's capture in a reused --out must not be read as this run's.
  rm -rf "$capture"
  mkdir -p "$capture"
  chmod 0777 "$capture"
  # The container reads the facts as another user too: a copy anyone can read.
  cp "$facts" "$work/facts.json"
  chmod 0644 "$work/facts.json"
  local args=()
  mapfile -d '' -t args < <("${driver[@]}" container-args --facts "$work/facts.json" --out "$capture" --uid "$(( $(id -u) + shift_uid ))" --gid "$(( $(id -g) + shift_uid ))")
  docker run "${args[@]}" || echo "screen-images: the capture container stopped with status $?" >&2
  stop_app
}

SECONDS=0
rm -f "$out/index.json"
capture_pass 1 0
index="$out/capture-1/index.json"
if [ -n "$twice" ] || [ -n "$apply" ]; then
  capture_pass 2 1
  index="$out/index.json"
  "${driver[@]}" compare --a "$out/capture-1" --b "$out/capture-2" --out "$index" || true
  echo "screen-images: two captures took ${SECONDS} s"
fi

"${driver[@]}" plan --index "$index" --built-dir "$out/capture-1" --committed "$target" --out "$out" --mode "$mode" ${base_sha:+--base-sha "$base_sha"}
if [ -n "$apply" ]; then
  "${driver[@]}" apply --out "$out" --target "$target"
fi
echo "screen-images: $out/summary.md"
finish
