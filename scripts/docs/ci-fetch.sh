# Sourced by install-ci-tools.sh (and by its tests); never executed. Defines `fetch`, the download of
# one pinned release archive: a file already present with the right sha256 is used as is (a cache
# hit, no network), anything else is downloaded with retries on every error, including a 5xx.
# The only environment knob is CI_FETCH_RETRY_DELAY (seconds between retries); the URL is always
# the caller's. Writes only the file it is given.

# fetch <tool> <version> <url> <sha256> <file>
fetch() {
  local tool="$1" version="$2" url="$3" sha256="$4" file="$5"

  if [ -e "$file" ]; then
    if echo "$sha256  $file" | sha256sum --check --strict --status -; then
      return 0
    fi
    rm -f "$file"
  fi

  if ! curl --fail --silent --show-error --location \
    --retry 5 --retry-delay "${CI_FETCH_RETRY_DELAY:-5}" --retry-all-errors \
    --connect-timeout 20 --max-time 120 --retry-max-time 300 \
    --output "$file" "$url"; then
    rm -f "$file"
    echo "::error title=CI infrastructure::could not download $tool $version from GitHub releases after retries; this is a download failure, not a docs failure" >&2
    return 1
  fi

  if ! echo "$sha256  $file" | sha256sum --check --strict --status -; then
    rm -f "$file"
    echo "::error title=CI infrastructure::checksum mismatch for $tool $version after download" >&2
    return 1
  fi
}
