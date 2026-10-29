#!/usr/bin/env bash
# Installs the pinned CI-only tools of the `docs` job (ADR-0066): oasdiff and lychee into
# $RUNNER_TEMP/bin (on $GITHUB_PATH), and the Mermaid CLI under $RUNNER_TEMP/mmdc. Every version
# and checksum of these tools lives here and nowhere else. Writes nothing into the repository.
set -euo pipefail

OASDIFF_VERSION="1.35.0"
OASDIFF_SHA256="a8023002fcb2eaa7f5758148a9303cb63d33b939886df312268bc0fc7b939140"
LYCHEE_VERSION="0.24.2"
LYCHEE_SHA256="1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a"
MERMAID_CLI_VERSION="12.0.0"

: "${RUNNER_TEMP:?RUNNER_TEMP is not set}"
: "${GITHUB_PATH:?GITHUB_PATH is not set}"

bin_dir="$RUNNER_TEMP/bin"
mkdir -p "$bin_dir" "$RUNNER_TEMP/downloads"

fetch() { # fetch <url> <sha256> <file>
  curl --fail --silent --show-error --location --output "$3" "$1"
  echo "$2  $3" | sha256sum --check --strict -
}

oasdiff_tgz="$RUNNER_TEMP/downloads/oasdiff.tar.gz"
fetch "https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz" \
  "$OASDIFF_SHA256" "$oasdiff_tgz"
tar -xzf "$oasdiff_tgz" -C "$bin_dir" oasdiff

lychee_tgz="$RUNNER_TEMP/downloads/lychee.tar.gz"
fetch "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz" \
  "$LYCHEE_SHA256" "$lychee_tgz"
tar -xzf "$lychee_tgz" -C "$bin_dir" --strip-components=1 lychee-x86_64-unknown-linux-gnu/lychee

echo "$bin_dir" >> "$GITHUB_PATH"

# The Mermaid CLI renders with the same mermaid the front ships: the exact version of web/package.json.
mermaid_version="$(node -p 'const p = require("./web/package.json"); (p.dependencies || {}).mermaid || (p.devDependencies || {}).mermaid || ""')"
if ! [[ "$mermaid_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "web/package.json must pin mermaid to a bare x.y.z, found: '$mermaid_version'" >&2
  exit 1
fi

# An override needs a manifest, so the install is a throwaway package: the CLI at its literal
# version, mermaid at the front's, and an override that makes the CLI's own mermaid the same one.
mmdc_dir="$RUNNER_TEMP/mmdc"
mkdir -p "$mmdc_dir"
cat > "$mmdc_dir/package.json" <<JSON
{
  "name": "mmdc-render",
  "private": true,
  "dependencies": {
    "@mermaid-js/mermaid-cli": "$MERMAID_CLI_VERSION",
    "mermaid": "$mermaid_version"
  },
  "overrides": { "mermaid": "$mermaid_version" }
}
JSON
npm install --prefix "$mmdc_dir" --no-fund --no-audit

# Chromium for the render: kept under $RUNNER_TEMP too (the render script reads the same cache dir),
# and installed explicitly because npm may not run puppeteer's own postinstall.
export PUPPETEER_CACHE_DIR="$RUNNER_TEMP/puppeteer-cache"
"$mmdc_dir/node_modules/.bin/puppeteer" browsers install chrome-headless-shell

# Every mermaid in the tree must be the pinned one.
npm ls --prefix "$mmdc_dir" --all --json mermaid | PIN="$mermaid_version" node -e '
const tree = JSON.parse(require("fs").readFileSync(0, "utf8"));
const found = [];
const walk = (deps) => {
  for (const [name, node] of Object.entries(deps || {})) {
    if (name === "mermaid") found.push(node.version);
    walk(node.dependencies);
  }
};
walk(tree.dependencies);
const bad = found.filter((v) => v !== process.env.PIN);
if (found.length === 0 || bad.length > 0) {
  console.error("mermaid in the render tree must be only " + process.env.PIN + ", found: " + JSON.stringify(found));
  process.exit(1);
}
console.log("mermaid " + process.env.PIN + " x" + found.length);
'
