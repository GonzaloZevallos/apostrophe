#!/usr/bin/env bash
# The sample app (agentic-system ADR-0040): builds this checkout's front, then serves it on
# a throwaway database seeded through the API. Prints the address, the user and where the
# facts went, and serves until stopped. Never reads `.env` nor touches `apostrophe.db`.
set -euo pipefail
cd "$(dirname "$0")/../.."
npm --prefix web run build >/dev/null
exec uv run --no-project python scripts/design/sample_app.py "$@"
