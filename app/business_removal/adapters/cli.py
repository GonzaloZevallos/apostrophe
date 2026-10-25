"""The operator's command: exports one business's data, then deletes it
(docs/adr/0015, docs/product/accounts.md "Removing a business"). Run as:

    scripts/remove-business.sh <email> [--dry-run]

Messages are the operator's, in the operator's language (docs/adr/0050 and its
amendment) -- never a business's: they come from `OperatorWords` over
`Settings.operator_translator()`. The one fixed English line is `refused: <ClassName>`,
for a start the translator could not be built for. Nothing it prints carries an email,
a name, a phone number or an amount -- only the business name, a path and counts
(CODING_STANDARDS section 9). No traceback
is ever printed: everything `dry_run`/`remove_business` do not already catch is
caught here, classified by `failure_message`, and printed as one fixed line.
"""

from __future__ import annotations

import argparse
import signal
import sys
from collections.abc import Callable, Sequence
from types import FrameType
from typing import TextIO, TypeVar

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import ConnectionPoolEntry

from app.business_removal.adapters.export_file import FileExportFile
from app.business_removal.adapters.operator_words import TranslatedOperatorWords
from app.business_removal.adapters.sql_schema_rows import SqlSchemaRows
from app.business_removal.application.operator_words import OperatorWords
from app.business_removal.application.remove_business import (
    Interrupted,
    StorageBusy,
    dry_run,
    failure_message,
    remove_business,
)
from app.business_removal.application.schema_rows import DeletedIds, SchemaRows
from app.business_removal.domain.business_ref import BusinessRef
from app.business_removal.domain.schema import Schema
from app.clock import Clock, system_clock
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.settings import Settings

_T = TypeVar("_T")


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


class _BusyTranslatingSchemaRows:
    """Wraps the real `SchemaRows` adapter so a SQLite "database is locked" error
    -- the one condition the plan names by itself ("Database busy: nothing
    deleted. Run it again.") -- reaches the use case as `StorageBusy`, not a bare
    `OperationalError` that would otherwise be reported as a generic failure. Kept
    here rather than in the adapter: only `adapters/` may import SQLAlchemy to
    recognise the driver's own error."""

    def __init__(self, inner: SchemaRows) -> None:
        self._inner = inner

    def schema(self) -> Schema:
        return self._call(self._inner.schema)

    def business_of(self, email: str) -> BusinessRef | None:
        return self._call(lambda: self._inner.business_of(email))

    def rows(self, table: str, business_id: int) -> list[dict[str, object]]:
        return self._call(lambda: self._inner.rows(table, business_id))

    def withheld_count(self, table: str, business_id: int) -> int:
        return self._call(lambda: self._inner.withheld_count(table, business_id))

    def delete_business(self, business_id: int, order: tuple[str, ...]) -> DeletedIds:
        return self._call(lambda: self._inner.delete_business(business_id, order))

    @staticmethod
    def _call(action: Callable[[], _T]) -> _T:
        try:
            return action()
        except OperationalError as exc:
            if _looks_locked(exc):
                raise StorageBusy("the database was locked") from exc
            raise


def _looks_locked(exc: OperationalError) -> bool:
    text = str(exc).lower()
    return "locked" in text or "busy" in text


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


def _report(output: _StreamOutput, words: OperatorWords, exc: BaseException) -> int:
    if isinstance(exc, OperationalError) and _looks_locked(exc):
        output.line(failure_message(StorageBusy("the database was locked"), words))
    else:
        output.line(failure_message(exc, words))
    return 1


def main(
    argv: Sequence[str] | None = None,
    stdin: TextIO = sys.stdin,
    stdout: TextIO = sys.stdout,
    *,
    clock: Clock = system_clock,
) -> int:
    parser = argparse.ArgumentParser(prog="remove-business")
    parser.add_argument("email")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    output = _StreamOutput(stdout)
    try:
        settings = Settings.from_env()
        words = TranslatedOperatorWords(settings.operator_translator())
    except Exception as exc:
        # Nothing has been installed or written yet: no signal handler, no export file.
        output.line(f"refused: {type(exc).__name__}")
        return 1

    previous_sighup = signal.signal(signal.SIGHUP, _raise_interrupted)
    previous_sigterm = signal.signal(signal.SIGTERM, _raise_interrupted)
    # Built before the inner `try`, so a signal that lands on the way into
    # `remove_business`'s own `except` -- after `write_durably` created a file but
    # before the use case's handler can discard it -- still has something to call
    # `discard()` on here, in the outer handler (the plan's backstop).
    export_file = FileExportFile(settings.export_dir)
    try:
        try:
            engine = _make_engine(settings.database_url)
            upgrade_to_head(engine)
            with Session(engine) as session:
                schema_rows = _BusyTranslatingSchemaRows(SqlSchemaRows(session))
                if args.dry_run:
                    return dry_run(schema_rows, output, words, args.email)
                confirm = _StdinConfirm(stdin, stdout)
                return remove_business(
                    schema_rows, export_file, confirm, session, output, words, clock, args.email
                )
        except SystemExit:
            raise
        except BaseException as exc:
            # `dry_run`/`remove_business` already catch everything that can happen
            # once they are called; this guards engine setup and the migration run,
            # which happen before either does -- nothing escapes as a traceback.
            try:
                export_file.discard()
            except BaseException:
                pass
            return _report(output, words, exc)
    finally:
        signal.signal(signal.SIGHUP, previous_sighup)
        signal.signal(signal.SIGTERM, previous_sigterm)


if __name__ == "__main__":
    raise SystemExit(main())
