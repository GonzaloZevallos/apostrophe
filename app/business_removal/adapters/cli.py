"""The operator's command: exports one business's data, then deletes it
(docs/adr/0014, docs/product/accounts.md "Removing a business"). Run as:

    scripts/remove-business.sh <email> [--dry-run]

Messages are in English, in the style of `invite-business.sh`: the command is not
app copy. Nothing it prints carries an email, a name, a phone number or an amount --
only the business name, a path and counts (CODING_STANDARDS section 9).
"""

from __future__ import annotations

import argparse
import signal
import sys
from collections.abc import Sequence
from types import FrameType
from typing import TextIO

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.orm import Session
from sqlalchemy.pool import ConnectionPoolEntry

from app.business_removal.adapters.export_file import FileExportFile
from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.application.remove_business import Interrupted, dry_run, remove_business
from app.clock import system_clock
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.settings import Settings


class _StdinConfirm:
    """Reads the operator's answer from `stdin`, echoing the prompt to `stdout`
    first. `readline()` answers `""` at EOF, which the port reads as a cancel."""

    def __init__(self, stdin: TextIO, stdout: TextIO) -> None:
        self._stdin = stdin
        self._stdout = stdout

    def ask(self, prompt: str) -> str | None:
        self._stdout.write(prompt)
        self._stdout.flush()
        line = self._stdin.readline()
        return None if line == "" else line


class _StreamOutput:
    def __init__(self, stdout: TextIO) -> None:
        self._stdout = stdout

    def line(self, text: str) -> None:
        self._stdout.write(text + "\n")
        self._stdout.flush()


def _raise_interrupted(_signum: int, _frame: FrameType | None) -> None:
    raise Interrupted()


def _on_connect(dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
    # No residue in the database file once a row is deleted, and a leaving
    # business's own writers never block the delete for long (the plan's invariants).
    dbapi_connection.execute("PRAGMA secure_delete=ON")
    dbapi_connection.execute("PRAGMA busy_timeout=5000")


def _make_engine(database_url: str) -> Engine:
    engine = make_engine(database_url)
    event.listen(engine, "connect", _on_connect)
    return engine


def main(
    argv: Sequence[str] | None = None,
    stdin: TextIO = sys.stdin,
    stdout: TextIO = sys.stdout,
) -> int:
    parser = argparse.ArgumentParser(prog="remove-business")
    parser.add_argument("email")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    settings = Settings.from_env()
    output = _StreamOutput(stdout)

    previous_sighup = signal.signal(signal.SIGHUP, _raise_interrupted)
    previous_sigterm = signal.signal(signal.SIGTERM, _raise_interrupted)
    try:
        engine = _make_engine(settings.database_url)
        upgrade_to_head(engine)
        with Session(engine) as session:
            schema_rows = SqlSchemaRows(session)
            if args.dry_run:
                return dry_run(schema_rows, output, args.email)
            confirm = _StdinConfirm(stdin, stdout)
            export_file = FileExportFile(settings.export_dir)
            return remove_business(
                schema_rows, export_file, confirm, session, output, system_clock, args.email
            )
    finally:
        signal.signal(signal.SIGHUP, previous_sighup)
        signal.signal(signal.SIGTERM, previous_sigterm)


if __name__ == "__main__":
    raise SystemExit(main())
