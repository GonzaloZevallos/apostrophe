#!/usr/bin/env bash
# Commits the regenerated docs the `docs` job packed (scripts/docs/regen_pack.py) as the Actions bot
# and hands the push to scripts/ci/bot-push.sh. The owned paths come only from --owned; git decides
# what is owned (`:(literal)` and `:(exclude,literal)` pathspecs), no matcher is written here.
#
#   scripts/docs/regen-publish.sh --sha SHA --tar FILE --owned FILE --summary FILE
#
# Runs at the repository root of a full clone. Everything is checked before anything in the
# repository changes: the owned file, the tar and what it unpacks to. Exit 2 on bad usage (a usage
# line on stderr, no summary line). Exit 1 on a refusal and exit 0 when nothing changed, each with
# one `Generated docs:` line in FILE; after a commit, bot-push.sh's exit code and line pass through.
set -euo pipefail
usage="usage: regen-publish.sh --sha SHA --tar FILE --owned FILE --summary FILE"

sha=""
tar_file=""
owned=""
summary=""
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }
  case "$1" in
    --sha) sha="$2" ;;
    --tar) tar_file="$2" ;;
    --owned) owned="$2" ;;
    --summary) summary="$2" ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
  shift 2
done
{ [ -n "$sha" ] && [ -n "$tar_file" ] && [ -n "$owned" ] && [ -n "$summary" ]; } \
  || { echo "$usage" >&2; exit 2; }

written=0
scratch=""
# note TEXT: the one summary line of this script.
note() { written=1; printf '%s\n' "$1" >> "$summary"; }
# refuse REASON [DETAIL]: the line names the rule broken; the detail goes to stderr only.
refuse() {
  note "Generated docs: failed, $1."
  echo "regen-publish: $1" >&2
  [ -z "${2:-}" ] || printf '%s\n' "$2" >&2
  exit 1
}
trap 'code=$?
  if [ -n "${scratch:-}" ]; then rm -rf -- "$scratch"; fi
  if [ "$code" -ne 0 ] && [ "$code" -ne 2 ] && [ "$written" -eq 0 ]; then
    note "Generated docs: failed, unexpected error."
  fi' EXIT

# 1. The owned file: every line is a safe repository-relative path, or the whole file is refused.
[ -f "$owned" ] && [ -r "$owned" ] || refuse "the owned file cannot be read"
roots=()      # each line with a trailing /** stripped
kinds=()      # dir for a /** entry, file for any other
lines=0
while IFS= read -r line || [ -n "$line" ]; do
  lines=$((lines + 1))
  root="${line%/\*\*}"
  kind=dir
  [ "$root" != "$line" ] || kind=file
  case "$root" in
    "" | /* | */ | *//* | *'**'*) refuse "the owned file has an invalid line" "line: '$line'" ;;
  esac
  case "/$root/" in
    */./* | */../* | */.git/*) refuse "the owned file has an invalid line" "line: '$line'" ;;
  esac
  roots+=("$root")
  kinds+=("$kind")
done < "$owned"
[ "$lines" -gt 0 ] || refuse "the owned file is empty"

specs=()      # :(literal) pathspec of each root
excludes=()   # :(exclude,literal) pathspec of each root
for root in "${roots[@]}"; do
  specs+=(":(literal)$root")
  excludes+=(":(exclude,literal)$root")
done

# 2. The tar: readable, only regular files and directories, and never empty while docs are tracked.
[ -f "$tar_file" ] || refuse "the pack cannot be read"
listing="$(tar -tvf "$tar_file")" || refuse "the pack cannot be read"
if [ -n "$listing" ]; then
  bad="$(printf '%s\n' "$listing" | awk '!/^[-d]/')"
  [ -z "$bad" ] || refuse "a member is not a regular file" "$bad"
fi
members="$(printf '%s\n' "$listing" | awk '/^-/ { n++ } END { print n + 0 }')"
if [ "$members" -eq 0 ] && [ -n "$(git ls-files -- "${specs[@]}")" ]; then
  refuse "the pack is empty"
fi

# 3. Unpack into a scratch directory: nothing of the pack touches the repository yet.
scratch="$(mktemp -d)"
mkdir "$scratch/in" "$scratch/stage"
tar -xf "$tar_file" -C "$scratch/in" --no-same-owner 2> "$scratch/tar.err" \
  || refuse "the pack cannot be extracted" "$(cat "$scratch/tar.err")"

# 4. The unpacked tree: regular files and directories only; each root moves to the staging area as
# the kind its entry says, and whatever is left was outside the owned paths.
bad="$(find "$scratch/in" -mindepth 1 ! -type f ! -type d -print)"
[ -z "$bad" ] || refuse "a member is not a regular file" "$bad"
for i in "${!roots[@]}"; do
  root="${roots[$i]}"
  [ -e "$scratch/in/$root" ] || continue
  if [ "${kinds[$i]}" = dir ]; then
    [ -d "$scratch/in/$root" ] || refuse "a member is outside the owned paths" "$root"
  else
    [ -f "$scratch/in/$root" ] || refuse "a member is outside the owned paths" "$root"
  fi
  mkdir -p "$scratch/stage/$(dirname "$root")"
  mv "$scratch/in/$root" "$scratch/stage/$root"
done
left="$(cd "$scratch/in" && find . -mindepth 1 ! -type d -print | cut -c3-)"
[ -z "$left" ] || refuse "a member is outside the owned paths" "$left"

# 5. Only now the old docs go.
git rm -r -q --ignore-unmatch -- "${specs[@]}"
for root in "${roots[@]}"; do
  rm -rf -- "$root"
done

# 6. The new docs come in; only the owned paths are staged.
for root in "${roots[@]}"; do
  mkdir -p "$(dirname "$root")"
  if [ -e "$scratch/stage/$root" ]; then mv "$scratch/stage/$root" "$root"; fi
  if [ -e "$root" ]; then git add -A -- ":(literal)$root"; fi
done

# 7. Anything else changed or untracked in the work tree is a bug upstream: nothing is committed.
stray="$(git status --porcelain=v1 -z --untracked-files=all --no-renames -- . "${excludes[@]}" \
  | tr '\0' '\n' | cut -c4-)"
[ -z "$stray" ] || refuse "paths outside the owned paths are changed" "$stray"

# 8. Nothing staged: nothing to commit.
if git diff --cached --quiet; then
  note "Generated docs: no generated doc changed, nothing committed."
  exit 0
fi

# 9. The identity goes through the environment too: a runner that exports GIT_AUTHOR_* would win over `-c`.
bot_email='41898283+github-actions[bot]@users.noreply.github.com'
GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL="$bot_email" \
GIT_COMMITTER_NAME='github-actions[bot]' GIT_COMMITTER_EMAIL="$bot_email" \
  git -c user.name='github-actions[bot]' -c user.email="$bot_email" \
  commit -q -m 'chore(docs): regenerate [skip ci]'

# 10. The race rules (fetch, classify what moved, rebase, push, retry) are shared with the other bot workflows.
rm -rf -- "$scratch"
scratch=""
exec "$(dirname "${BASH_SOURCE[0]}")/../ci/bot-push.sh" \
  --sha "$sha" --commit HEAD --summary "$summary" \
  --label 'Generated docs' --skip-note "that commit's own master run regenerates."
