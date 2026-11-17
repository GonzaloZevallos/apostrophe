#!/usr/bin/env bash
# Puts one bot-owned commit on top of a branch that may have moved while a workflow ran. Any workflow
# that commits to master as `github-actions[bot]` calls it instead of re-deriving the race rules.
#
#   scripts/ci/bot-push.sh --sha SHA --commit REV --summary FILE --label TEXT --skip-note TEXT \
#       [--ignore PATH]... [--remote origin] [--branch master]
#
# SHA is the commit the branch was at when the workflow started; REV is the commit to publish. It
# runs in the current directory, a full clone (fetch-depth: 0), and rewrites its work tree. The
# branch may have moved: every commit in SHA..tip must be a bot commit on bot-owned paths, or touch
# only --ignore paths; then REV is cherry-picked on the tip and pushed. Exactly one line, starting
# with `<label>:`, is appended to FILE (to stdout when FILE is empty). Exit 0: pushed, skipped
# (the branch moved under a change the bot must not push over) or nothing to push. Exit 1: the bot
# cannot judge or cannot finish. Exit 2: bad usage, a usage line on stderr only.
set -euo pipefail

usage="usage: bot-push.sh --sha SHA --commit REV --summary FILE --label TEXT --skip-note TEXT [--ignore PATH]... [--remote origin] [--branch master]"

# The paths the bots own; its docs part equals `docs.paths` of .agentic/stack.yaml (a test compares them).
BOT_OWNED=(
  'docs/architecture/generated/**'
  'docs/api/**'
  'docs/architecture/decisiones.md'
  'docs/assets/screens/**'
)
bot_email='41898283+github-actions[bot]@users.noreply.github.com'
max_attempts=4

sha=""
commit=""
summary_file=""
have_summary=0
label=""
skip_note=""
have_skip_note=0
ignore=()
remote="origin"
branch="master"
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }
  case "$1" in
    --sha) sha="$2" ;;
    --commit) commit="$2" ;;
    --summary) summary_file="$2"; have_summary=1 ;;
    --label) label="$2" ;;
    --skip-note) skip_note="$2"; have_skip_note=1 ;;
    --ignore) ignore+=("$2") ;;
    --remote) remote="$2" ;;
    --branch) branch="$2" ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
  shift 2
done
{ [ -n "$sha" ] && [ -n "$commit" ] && [ -n "$label" ] && [ "$have_summary" -eq 1 ] && [ "$have_skip_note" -eq 1 ]; } \
  || { echo "$usage" >&2; exit 2; }

# Everything git or this script prints goes to stderr; fd 3 keeps stdout for the one summary line.
exec 3>&1 1>&2

written=0
# The only writer of the summary, always called in the main shell (never in $(...) or a pipe).
summary() {
  written=1
  if [ -n "$summary_file" ]; then
    printf '%s\n' "$1" >> "$summary_file"
  else
    printf '%s\n' "$1" >&3
  fi
}
finish() { summary "$1"; exit "$2"; }
trap 'code=$?; if [ "$written" -eq 0 ] && [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then summary "$label: failed, unexpected error."; fi' EXIT

# Every commit this script creates is the bot's, whatever the runner exports.
export GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL="$bot_email"
export GIT_COMMITTER_NAME='github-actions[bot]' GIT_COMMITTER_EMAIL="$bot_email"
git() { command git -c user.name='github-actions[bot]' -c user.email="$bot_email" "$@"; }

# matches ENTRY PATH: `dir/**` matches only what is strictly under `dir/`; any other entry, only itself.
matches() {
  case "$1" in
    */\*\*) local dir="${1%/\*\*}"; [[ "$2" == "$dir"/?* ]] ;;
    *) [ "$1" = "$2" ] ;;
  esac
}

# paths_within COMMIT ENTRY...: every path COMMIT touches against its first parent matches an entry.
# A failing diff yields an empty path, which never matches.
paths_within() {
  local c="$1" p entry found
  shift
  while IFS= read -r -d '' p; do
    [ -n "$p" ] || return 1
    found=1
    for entry in "$@"; do
      if matches "$entry" "$p"; then found=0; break; fi
    done
    [ "$found" -eq 0 ] || return 1
  done < <(git diff --name-only -z --no-renames "$c^1" "$c" || printf '\0')
}

has_first_parent() { git rev-parse -q --verify "$1^1" > /dev/null; }

is_bot() {
  local ids
  ids="$(git log -1 --format='%ae%n%ce' "$1")"
  [ "$ids" = "$bot_email"$'\n'"$bot_email" ]
}

rev_sha="$(git rev-parse --verify -q "$commit^{commit}")" \
  || finish "$label: failed, --commit does not name a commit." 1

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  finish "$label: failed, the clone is shallow; the checkout needs fetch-depth: 0." 1
fi

has_first_parent "$rev_sha" || finish "$label: failed, the commit to push has no first parent." 1
paths_within "$rev_sha" "${BOT_OWNED[@]}" \
  || finish "$label: failed, the commit to push touches a path outside the bot-owned paths." 1

tip=""
# fetch_tip: tip is where the branch is now.
fetch_tip() {
  git fetch -q "$remote" "$branch" || finish "$label: failed, could not fetch $branch from $remote." 1
  tip="$(git rev-parse FETCH_HEAD)"
}

# classify: exits 0 (skip) when a commit in sha..tip may not be pushed over; exits 1 on one with no first parent.
classify() {
  local range c
  range="$(git rev-list "$sha..$tip")"
  while IFS= read -r c; do
    [ -z "$c" ] || has_first_parent "$c" \
      || finish "$label: failed, a commit between $sha and $tip has no first parent." 1
  done <<< "$range"
  while IFS= read -r c; do
    [ -n "$c" ] || continue
    if is_bot "$c"; then
      paths_within "$c" "${BOT_OWNED[@]}" && continue
    else
      paths_within "$c" ${ignore[@]+"${ignore[@]}"} && continue
    fi
    finish "$label: not pushed, $branch moved from $sha to $tip during the run; $skip_note" 0
  done <<< "$range"
}

# apply: REV on top of tip, as the bot; exits when there is nothing to push or it conflicts.
apply() {
  git reset -q --hard "$tip"
  if ! git cherry-pick --no-commit "$rev_sha"; then
    git cherry-pick --abort || git reset -q --hard "$tip"
    finish "$label: failed, the commit to push conflicts with $branch at $tip." 1
  fi
  if git diff --cached --quiet; then
    git reset -q --hard "$tip"
    finish "$label: nothing to push, $branch at $tip already has $rev_sha's changes." 0
  fi
  git commit -q -C "$rev_sha" --reset-author
}

attempt=0
while :; do
  attempt=$((attempt + 1))
  fetch_tip
  if [ "$tip" = "$sha" ]; then
    pushing="$rev_sha"
  else
    classify
    apply
    pushing="$(git rev-parse HEAD)"
  fi
  if git push -q "$remote" "$pushing:refs/heads/$branch"; then
    finish "$label: pushed $pushing to $branch." 0
  fi
  [ "$attempt" -lt "$max_attempts" ] \
    || finish "$label: failed, the push to $branch was rejected $max_attempts times." 1
  echo "bot-push: push to $branch rejected (attempt $attempt of $max_attempts), retrying" >&2
done
