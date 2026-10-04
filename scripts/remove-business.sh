#!/usr/bin/env bash
# Exports one business's data, then deletes it (docs/adr/0014).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec uv run --no-project python -m app.business_removal.adapters.cli "$@"
