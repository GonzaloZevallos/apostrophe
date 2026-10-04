#!/usr/bin/env bash
# Serves the app on the home network (docs/adr/0002) and, published, behind Render's
# own TLS-terminating proxy (docs/adr/0014, docs/adr/0015): the only place uvicorn is
# ever started. `--no-access-log` keeps every request's address and path out of the
# log (CODING_STANDARDS section 9); `--no-proxy-headers` keeps uvicorn itself from
# trusting `X-Forwarded-For` — only `ClientAddress` (app/accounts/adapters/deps.py)
# ever reads it, and only from a configured trusted proxy.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
export APOSTROPHE_WEB_DIST="${APOSTROPHE_WEB_DIST:-web/dist}"
# Render sets $PORT; the home network sets $APOSTROPHE_PORT (or takes the default).
exec uv run --no-project uvicorn app.main:create_app --factory \
  --host 0.0.0.0 --port "${PORT:-${APOSTROPHE_PORT:-8000}}" \
  --no-access-log --no-proxy-headers
