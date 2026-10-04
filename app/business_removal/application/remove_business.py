"""The two use cases the operator's command runs: `dry_run` names a business and
counts what a real run would touch, writing nothing; `remove_business` exports it and
then deletes it, inside one transaction, only after the export file was written and
read back unchanged (the plan's invariants).

Nothing here imports anything but the standard library, this package and
`app.shared` (CODING_STANDARDS section 1): `signal` is blocked only around the one
`commit()` call, and never installs a handler -- that is the CLI's job, since
installing a process-wide signal handler is not something a use case should do on
its own.
"""

from __future__ import annotations

import signal
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from app.business_removal.application.export_file import ExportFile
from app.business_removal.application.schema_rows import SchemaRows
from app.business_removal.domain.classification import (
    delete_order,
    secret_columns,
    unowned_tables,
)
from app.business_removal.domain.confirmation import name_matches
from app.business_removal.domain.exclusions import (
    BUSINESS_TABLE,
    INVITATION_TABLE,
    LOGIN_GUARD_TABLE,
)
from app.business_removal.domain.export_document import Business, build_document, id_sets
from app.business_removal.domain.labels import owned_tables, unlabelled_tables
from app.business_removal.domain.naming import file_name, terminal_name
from app.business_removal.domain.reconciliation import reconcile
from app.business_removal.domain.schema import Schema
from app.shared.transaction import Transaction

Clock = Callable[[], datetime]

# Blocked around the single `commit()` call, so a signal cannot land between the
# write and the flag that says it happened (the plan's invariant).
_BLOCKED_SIGNALS = {signal.SIGINT, signal.SIGHUP, signal.SIGTERM}

NO_BUSINESS_MESSAGE = "No business for that email."
CONFIRMATION_FAILED_MESSAGE = "Nothing deleted: the typed name did not match."
INTERRUPTED_MESSAGE = "Interrupted: nothing deleted."
BUSY_MESSAGE = "Database busy: nothing deleted. Run it again."
FAILED_MESSAGE = "Failed: nothing deleted."


class Confirm(Protocol):
    def ask(self, prompt: str) -> str | None:
        """The operator's answer, trailing newline and all; `None` for EOF or a
        cancel. Never raises for a plain "no": `KeyboardInterrupt` is the one
        exception a real terminal can still raise through this, and the use case
        treats it like any other interruption."""
        ...


class Output(Protocol):
    def line(self, text: str) -> None: ...


class Interrupted(Exception):
    """Raised by the CLI's own SIGHUP/SIGTERM handlers to unwind the run the same
    way `KeyboardInterrupt` (SIGINT) already does on its own."""


class StorageBusy(Exception):
    """A port raises this when the database was too busy with another business's
    own writes to finish; the operator is told to run the command again rather than
    being shown anything about why."""


class RecordsChanged(Exception):
    """The ids read back from the export file no longer match what the delete
    returned: something changed the business's rows during the run. The message
    names no table and no row, only that the run must be repeated."""

    def __init__(self) -> None:
        super().__init__("Records changed during the run: nothing deleted. Run it again.")


def dry_run(schema_rows: SchemaRows, output: Output, email: str) -> int:
    """Names the business found from `email` and counts, by table, what a real run
    would export and delete. Writes nothing, asks nothing. Nothing this function
    does can leave a traceback on the way out: every exception, including one
    raised by a port, ends in one fixed message and `1` (the plan's invariant)."""
    try:
        schema = schema_rows.schema()
        refusal = _schema_refusal(schema)
        if refusal is not None:
            output.line(refusal)
            return 1
        business = schema_rows.business_of(email)
        if business is None:
            output.line(NO_BUSINESS_MESSAGE)
            return 1

        output.line(terminal_name(business.name))
        for table_name in owned_tables(schema):
            count = len(schema_rows.rows(table_name, business.id))
            output.line(f"{table_name}: {count}")
        count = schema_rows.invitation_count(business.id)
        output.line(f"{INVITATION_TABLE}: {count} (deleted only)")
        return 0
    except SystemExit:
        raise
    except BaseException as exc:
        output.line(failure_message(exc))
        return 1


def remove_business(
    schema_rows: SchemaRows,
    export_file: ExportFile,
    confirm: Confirm,
    transaction: Transaction,
    output: Output,
    clock: Clock,
    email: str,
) -> int:
    """Exports the business found from `email`, asks the operator to type its name
    back, then deletes every row in one transaction -- only once the file has been
    written, fsynced and read back, and only if what was read back names exactly the
    ids the delete returns. Any failure before the commit leaves the business whole
    and removes whatever file this run created; nothing after the commit ever
    touches that file again. Everything, from the first read of the schema onward,
    runs inside the one try below: no exception, from any port, leaves a traceback
    on the way out (the plan's invariant)."""
    committed = False
    path: Path | None = None
    try:
        schema = schema_rows.schema()
        refusal = _schema_refusal(schema)
        if refusal is not None:
            output.line(refusal)
            return 1
        business = schema_rows.business_of(email)
        if business is None:
            output.line(NO_BUSINESS_MESSAGE)
            return 1

        order = delete_order(schema)
        owned = owned_tables(schema)
        export_file.prepare()

        prompt = f"Type the business name ({terminal_name(business.name)}) to remove it: "
        typed = confirm.ask(prompt)
        if typed is None or not name_matches(typed, business.name):
            output.line(CONFIRMATION_FAILED_MESSAGE)
            return 1

        rows = {name: schema_rows.rows(name, business.id) for name in owned}
        now = _naive_utc(clock())
        document = build_document(Business(business.id, business.name), schema, rows, now)
        name = file_name(business.name, now)
        path = export_file.write_durably(name, document)
        output.line(f"Export written: {path}")

        read_back = export_file.read_back(path)
        # `id_sets` only covers the "kinds" (the owned tables other than `business`
        # itself, which the document carries as a header, not a list); the business
        # row is still one exported id, read back from the same file.
        exported_ids = id_sets(read_back)
        exported_ids[BUSINESS_TABLE] = frozenset({read_back[BUSINESS_TABLE]["id"]})
        deleted = schema_rows.delete_business(business.id, order)
        mismatches = reconcile(exported_ids, deleted.tables)
        if mismatches:
            raise RecordsChanged()

        signal.pthread_sigmask(signal.SIG_BLOCK, _BLOCKED_SIGNALS)
        try:
            transaction.commit()
            committed = True
        finally:
            signal.pthread_sigmask(signal.SIG_UNBLOCK, _BLOCKED_SIGNALS)

        output.line(terminal_name(business.name))
        for table_name in owned:
            exported_count = len(exported_ids.get(table_name, frozenset()))
            deleted_count = len(deleted.tables.get(table_name, frozenset()))
            output.line(f"{table_name}: exported {exported_count}, deleted {deleted_count}")
        output.line(f"{INVITATION_TABLE}: deleted {deleted.invitation_count}")
        output.line(f"{LOGIN_GUARD_TABLE}: deleted {deleted.login_guard_count}")
        output.line(f"Business removed; export kept at {path}.")
        return 0
    except SystemExit:
        raise
    except BaseException as exc:
        if committed:
            # Once committed, nothing is ever reported as "nothing deleted": a
            # second failure here (a broken pipe or anything else) is swallowed,
            # not let through to a caller that does not know the delete already
            # happened (the plan's invariant).
            try:
                output.line(f"Business removed; export kept at {path}.")
            except SystemExit:
                raise
            except BaseException:
                pass
            return 1
        transaction.rollback()
        if path is not None:
            export_file.remove(path)
        output.line(failure_message(exc))
        return 1


def _schema_refusal(schema: Schema) -> str | None:
    unowned = unowned_tables(schema)
    if unowned:
        return f"Refusing: table(s) with no business_id: {', '.join(unowned)}"
    secrets = secret_columns(schema)
    if secrets:
        names = ", ".join(f"{table}.{column}" for table, column in secrets)
        return f"Refusing: column(s) that look like a secret: {names}"
    unlabelled = unlabelled_tables(schema)
    if unlabelled:
        return f"Refusing: table(s) with no name or declared label: {', '.join(sorted(unlabelled))}"
    try:
        delete_order(schema)
    except ValueError as exc:
        return f"Refusing: {exc}"
    return None


def failure_message(exc: BaseException) -> str:
    """The one fixed line a failure before the commit is reported as -- never the
    exception's own text, which might repeat a path or a row (the plan's
    invariant). Public so the CLI's own top-level handler classifies the same way
    for whatever happens outside `dry_run`/`remove_business` themselves (engine
    setup, migrations)."""
    if isinstance(exc, RecordsChanged):
        return str(exc)
    if isinstance(exc, (Interrupted, KeyboardInterrupt)):
        return INTERRUPTED_MESSAGE
    if isinstance(exc, StorageBusy):
        return BUSY_MESSAGE
    return FAILED_MESSAGE


def _naive_utc(instant: datetime) -> datetime:
    return instant.astimezone(UTC).replace(tzinfo=None) if instant.tzinfo is not None else instant
