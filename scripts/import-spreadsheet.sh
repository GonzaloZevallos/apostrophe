#!/usr/bin/env bash
# Loads an .xlsx export of Control_de_ventas_y_gastos into one business, once, on
# switch day (docs/product/import.md). Run with --dry-run first.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec uv run --no-project python -m app.spreadsheet_import.adapters.cli "$@"
