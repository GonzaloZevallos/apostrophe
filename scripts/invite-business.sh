#!/usr/bin/env bash
# Prints a link that opens one new business, once, within seven days (docs/adr/0002).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec uv run --no-project python -m app.accounts.adapters.cli invite-business
