"""The negative control for `cli_main_clock_violations`: every shape of call to a CLI
`main` that leaves its clock unnamed. One violation per call, in this order."""

import app.business_removal.adapters.cli
from app.accounts.adapters import cli as accounts_cli
from app.accounts.adapters.cli import main
from app.spreadsheet_import.adapters.cli import main as import_main

OPTIONS: dict[str, object] = {}

main(["invite-business"])
main(["invite-business"], clock=None)
import_main([])
accounts_cli.main(["invite-business"])
main(["invite-business"], **OPTIONS)
app.business_removal.adapters.cli.main(["someone@example.com"])
