"""The positive control for `cli_main_clock_violations`: calls naming their clock, and a
`main` that is not a CLI's, which the rule must not match."""

from datetime import UTC, datetime

from app.accounts.adapters import cli as accounts_cli
from app.accounts.adapters.cli import main
from app.spreadsheet_import.adapters.cli import main as import_main
from scripts import ci_verdict

FIXED = datetime(2026, 1, 1, tzinfo=UTC)

main(["invite-business"], clock=lambda: FIXED)
import_main([], clock=lambda: FIXED)
accounts_cli.main(["invite-business"], clock=lambda: FIXED)
ci_verdict.main([])
