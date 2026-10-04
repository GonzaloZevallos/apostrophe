#!/usr/bin/env bash
# Serves the app to every device on the home network (docs/adr/0002).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
export APOSTROPHE_WEB_DIST="${APOSTROPHE_WEB_DIST:-web/dist}"
# No --workers: the pinned catalog's per-business lock lives in one process's memory
# (ADR-0014). More than one worker would bring back double posts and stale edits.
exec uv run --no-project uvicorn app.main:create_app --factory \
  --host 0.0.0.0 --port "${APOSTROPHE_PORT:-8000}" --no-access-log
