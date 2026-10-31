#!/usr/bin/env bash
# Renders every Mermaid block of the generated pages and of the written architecture pages with
# the pinned mmdc (ADR-0066) into $RUNNER_TEMP, so a diagram the real renderer rejects fails the job. Writes nothing into the repository, and fails
# when it rendered nothing or fewer svg files than there are mermaid blocks.
set -euo pipefail
shopt -s globstar nullglob

: "${RUNNER_TEMP:?RUNNER_TEMP is not set}"

export PUPPETEER_CACHE_DIR="$RUNNER_TEMP/puppeteer-cache"

root="docs/architecture/generated"
written="docs/architecture"
mmdc="$RUNNER_TEMP/mmdc/node_modules/.bin/mmdc"
out="$RUNNER_TEMP/mermaid-render"

if [[ ! -x "$mmdc" ]]; then
  echo "mmdc is not installed at $mmdc" >&2
  exit 1
fi

files=("$root"/**/*.md)
on_disk="$(find "$root" -name '*.md' | wc -l)"
if [[ ${#files[@]} -eq 0 || ${#files[@]} -ne $on_disk ]]; then
  echo "found ${#files[@]} markdown files by glob and $on_disk by find under $root" >&2
  exit 1
fi

# The written pages sit directly under docs/architecture; generated/ is walked above.
pages=("$written"/*.md)
on_disk_pages="$(find "$written" -maxdepth 1 -name '*.md' | wc -l)"
if [[ ${#pages[@]} -eq 0 || ${#pages[@]} -ne $on_disk_pages ]]; then
  echo "found ${#pages[@]} markdown files by glob and $on_disk_pages by find under $written" >&2
  exit 1
fi
files+=("${pages[@]}")

rm -rf "$out"
mkdir -p "$out"
printf '{"args":["--no-sandbox"]}\n' > "$RUNNER_TEMP/puppeteer.json"

blocks=0
for file in "${files[@]}"; do
  target="$out/${file#"$written"/}"
  mkdir -p "$(dirname "$target")"
  "$mmdc" -p "$RUNNER_TEMP/puppeteer.json" -i "$file" -o "$target"
  blocks=$((blocks + $(grep -c '^```mermaid$' "$file" || true)))
done

svgs="$(find "$out" -name '*.svg' | wc -l)"
if [[ $blocks -eq 0 || $svgs -ne $blocks ]]; then
  echo "rendered $svgs svg files for $blocks mermaid blocks" >&2
  exit 1
fi
echo "rendered ${#files[@]} files, $blocks diagrams"
