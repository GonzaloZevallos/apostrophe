#!/usr/bin/env bash
# Prints a link that lets one user choose a new password, once, within 24 hours
# (docs/adr/0019). The operator never sees or chooses the password itself.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec uv run --no-project python -m app.accounts.adapters.cli reset-password "$1"
