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

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from app.business_removal.application.export_file import ExportFile
from app.business_removal.application.operator_words import OperatorWords
from app.business_removal.application.schema_rows import SchemaRows
from app.business_removal.application.signals import blocked_signals
from app.business_removal.domain.classification import (
    DeleteOrderCycle,
    delete_order,
    has_business_id,
    other_type_columns,
    secret_columns,
    unowned_tables,
)
from app.business_removal.domain.confirmation import name_matches
from app.business_removal.domain.exclusions import (
    BUSINESS_TABLE,
    LOGIN_GUARD_TABLE,
    WITHHELD_TABLES,
)
from app.business_removal.domain.export_document import Business, build_document, id_sets
from app.business_removal.domain.labels import exported_tables, unlabelled_tables
from app.business_removal.domain.naming import file_name, terminal_name
from app.business_removal.domain.reconciliation import reconcile
from app.business_removal.domain.schema import Schema
from app.shared.transaction import Transaction

Clock = Callable[[], datetime]


def withheld_business_tables(schema: Schema) -> tuple[str, ...]:
    """`WITHHELD_TABLES` that carry their own `business_id`, sorted (docs/adr/0019):
    `invitation` and `reset_link`, never `login_guard`, which is withheld too but has
    no `business_id` of its own and is deleted and counted by email instead."""
    present = {table.name for table in schema.tables}
    return tuple(
        sorted(
            name
            for name in WITHHELD_TABLES
            if name in present and has_business_id(schema.table(name))
        )
    )


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
    returned: something changed the business's rows during the run. It names no table
    and no row, and holds no text: the operator's line is `words.records_changed()`."""


def dry_run(schema_rows: SchemaRows, output: Output, words: OperatorWords, email: str) -> int:
    """Names the business found from `email` and counts, by table, what a real run
    would export and delete. Writes nothing, asks nothing. Nothing this function
    does can leave a traceback on the way out: every exception, including one
    raised by a port, ends in one fixed message and `1` (the plan's invariant)."""
    try:
        schema = schema_rows.schema()
        refusal = _schema_refusal(schema, words)
        if refusal is not None:
            output.line(refusal)
            return 1
        business = schema_rows.business_of(email)
        if business is None:
            output.line(words.no_business())
            return 1

        output.line(terminal_name(business.name))
        for table_name in exported_tables(schema):
            count = len(schema_rows.rows(table_name, business.id))
            output.line(words.count_dry(table_name, str(count)))
        for table_name in withheld_business_tables(schema):
            count = schema_rows.withheld_count(table_name, business.id)
            output.line(words.count_withheld_dry(table_name, str(count)))
        return 0
    except SystemExit:
        raise
    except BaseException as exc:
        output.line(failure_message(exc, words))
        return 1


def remove_business(
    schema_rows: SchemaRows,
    export_file: ExportFile,
    confirm: Confirm,
    transaction: Transaction,
    output: Output,
    words: OperatorWords,
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
    commit_attempted = False
    path: Path | None = None
    business = None
    exported_ids: dict[str, frozenset[int]] = {}
    owned: tuple[str, ...] = ()
    try:
        schema = schema_rows.schema()
        refusal = _schema_refusal(schema, words)
        if refusal is not None:
            output.line(refusal)
            return 1
        business = schema_rows.business_of(email)
        if business is None:
            output.line(words.no_business())
            return 1

        order = delete_order(schema)
        owned = exported_tables(schema)
        export_file.prepare()

        typed = confirm.ask(words.prompt(terminal_name(business.name)))
        if typed is None or not name_matches(typed, business.name):
            output.line(words.confirmation_failed())
            return 1

        rows = {name: schema_rows.rows(name, business.id) for name in owned}
        now = _naive_utc(clock())
        document = build_document(Business(business.id, business.name), schema, rows, now)
        name = file_name(business.name, now)
        path = export_file.write_durably(name, document)
        output.line(words.export_written(str(path)))

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

        with blocked_signals():
            export_file.keep()
            commit_attempted = True
            transaction.commit()
            committed = True

        output.line(terminal_name(business.name))
        for table_name in owned:
            exported_count = len(exported_ids.get(table_name, frozenset()))
            deleted_count = len(deleted.tables.get(table_name, frozenset()))
            output.line(
                words.count_exported_deleted(table_name, str(exported_count), str(deleted_count))
            )
        for table_name in sorted(deleted.withheld_counts):
            output.line(words.count_deleted(table_name, str(deleted.withheld_counts[table_name])))
        output.line(words.count_deleted(LOGIN_GUARD_TABLE, str(deleted.login_guard_count)))
        output.line(words.removed(str(path)))
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
                output.line(_rendered(lambda: words.removed(str(path)), exc))
            except SystemExit:
                raise
            except BaseException:
                pass
            return 1
        if commit_attempted:
            # The commit itself raised: whether it was applied is unknown, so
            # nothing here may say "nothing deleted" or report success (PM's
            # ruling). The file is kept -- it may be the only copy left.
            try:
                if business is not None:
                    output.line(terminal_name(business.name))
                for table_name in owned:
                    exported_count = len(exported_ids.get(table_name, frozenset()))
                    output.line(words.count_exported(table_name, str(exported_count)))
                output.line(_rendered(lambda: words.unknown_outcome(str(path)), exc))
            except SystemExit:
                raise
            except BaseException:
                pass
            return 1
        with blocked_signals():
            try:
                export_file.discard()
            except BaseException:
                pass
        try:
            transaction.rollback()
        except SystemExit:
            raise
        except BaseException:
            pass
        output.line(failure_message(exc, words))
        return 1


def _schema_refusal(schema: Schema, words: OperatorWords) -> str | None:
    unowned = unowned_tables(schema)
    if unowned:
        return words.unowned_tables(", ".join(unowned))
    secrets = secret_columns(schema)
    if secrets:
        return words.secret_columns(", ".join(f"{table}.{column}" for table, column in secrets))
    other_types = other_type_columns(schema)
    if other_types:
        return words.other_type_columns(
            ", ".join(f"{table}.{column}" for table, column in other_types)
        )
    unlabelled = unlabelled_tables(schema)
    if unlabelled:
        return words.unlabelled_tables(", ".join(sorted(unlabelled)))
    try:
        delete_order(schema)
    except DeleteOrderCycle as cycle:
        return words.delete_order_cycle(", ".join(cycle.tables))
    return None


def failure_message(exc: BaseException, words: OperatorWords) -> str:
    """The one fixed line a failure before the commit is reported as -- never the
    exception's own text, which might repeat a path or a row (the plan's
    invariant). Public so the CLI's own top-level handler classifies the same way
    for whatever happens outside `dry_run`/`remove_business` themselves (engine
    setup, migrations). A failure line never raises: if rendering it fails, the line
    is the fixed, untranslated `refused: <ClassName of exc>`."""
    return _rendered(lambda: _classified(exc, words), exc)


def _classified(exc: BaseException, words: OperatorWords) -> str:
    if isinstance(exc, RecordsChanged):
        return words.records_changed()
    if isinstance(exc, (Interrupted, KeyboardInterrupt)):
        return words.interrupted()
    if isinstance(exc, StorageBusy):
        return words.busy()
    return words.failed()


def _rendered(render: Callable[[], str], exc: BaseException) -> str:
    try:
        return render()
    except Exception:
        return f"refused: {type(exc).__name__}"


def _naive_utc(instant: datetime) -> datetime:
    return instant.astimezone(UTC).replace(tzinfo=None) if instant.tzinfo is not None else instant
