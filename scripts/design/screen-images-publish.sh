#!/usr/bin/env bash
# Publishes the images the master workflow just applied (docs/product/screen-images.md): commits only
# `docs/assets/screens`, as the Actions bot, and hands the push to scripts/ci/bot-push.sh, which pushes
# on top of master when it moved only by bot commits or image changes. It makes the decisions the
# workflow must not leave in untested `run:` blocks: refuse a stray path, commit only when something
# is staged.
#
#   scripts/design/screen-images-publish.sh --sha SHA --summary FILE [--remote origin] [--branch master]
#
# Runs in the current directory, which must be the repository root, after `screenImagesRun.mjs apply`. Exit 2 on bad usage, 1 on a path
# outside the images, 0 otherwise (also when master moved and nothing was pushed). The helper's exit codes pass through.
set -euo pipefail
target=docs/assets/screens
usage="usage: screen-images-publish.sh --sha SHA --summary FILE [--remote origin] [--branch master]"

sha=""
summary=""
remote="origin"
branch="master"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --sha) [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }; sha="$2"; shift 2 ;;
    --summary) [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }; summary="$2"; shift 2 ;;
    --remote) [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }; remote="$2"; shift 2 ;;
    --branch) [ "$#" -ge 2 ] || { echo "$usage" >&2; exit 2; }; branch="$2"; shift 2 ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
done
{ [ -n "$sha" ] && [ -n "$summary" ]; } || { echo "$usage" >&2; exit 2; }

note() { printf '%s\n' "$1" >> "$summary"; }

git add -A -- "$target"

# Anything else in the work tree, tracked or not, is a bug upstream: nothing is committed.
stray="$(git status --porcelain --untracked-files=all | cut -c4- | awk -v t="$target/" 'index($0, t) != 1' || true)"
if [ -n "$stray" ]; then
  echo "screen-images-publish: paths outside $target:" >&2
  echo "$stray" >&2
  exit 1
fi

if git diff --cached --quiet; then
  note "Screen images: no image changed, nothing committed."
  exit 0
fi

# The identity goes through the environment too: a runner that exports GIT_AUTHOR_* would win over `-c`.
bot_email='41898283+github-actions[bot]@users.noreply.github.com'
GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL="$bot_email" \
GIT_COMMITTER_NAME='github-actions[bot]' GIT_COMMITTER_EMAIL="$bot_email" \
  git -c user.name='github-actions[bot]' -c user.email="$bot_email" \
  commit -q -m 'chore(screens): update images [skip ci]'

# The race rules (fetch, classify what moved, rebase, push, retry) are shared with the other bot workflows.
exec "$(dirname "${BASH_SOURCE[0]}")/../ci/bot-push.sh" \
  --sha "$sha" --commit HEAD --summary "$summary" \
  --label 'Screen images' --skip-note 'the next master run updates the images.' \
  --ignore 'docs/assets/screens/**' --remote "$remote" --branch "$branch"
