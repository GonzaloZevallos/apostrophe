#!/usr/bin/env bash
# Serves the app to every device on the home network (docs/adr/0002).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec uv run --no-project uvicorn app.main:create_app --factory \
  --host 0.0.0.0 --port "${APOSTROPHE_PORT:-8000}" --no-access-log
