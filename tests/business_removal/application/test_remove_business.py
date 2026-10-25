"""`dry_run` and `remove_business` over fake ports (fault injection), the declared
seam for this subtask: every guard that must leave the business whole, and the
boundary the `committed`/`commit_attempted` flags draw between "roll back and clean
up", "commit outcome unknown, keep the file" and "never touch the file again" (the
plan's invariants)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.business_removal.application.export_file import ExportFile
from app.business_removal.application.remove_business import (
    BUSY_MESSAGE,
    CONFIRMATION_FAILED_MESSAGE,
    FAILED_MESSAGE,
    INTERRUPTED_MESSAGE,
    NO_BUSINESS_MESSAGE,
    Confirm,
    Interrupted,
    Output,
    RecordsChanged,
    StorageBusy,
    dry_run,
    remove_business,
)
from app.business_removal.application.schema_rows import DeletedIds, SchemaRows
from app.business_removal.domain.business_ref import BusinessRef
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table
from app.shared.transaction import Transaction

NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
EMAIL = "owner@example.com"
BUSINESS = BusinessRef(id=1, name="La Huerta", language="en")


def _col(name: str, type_: ColumnType = ColumnType.INTEGER) -> Column:
    return Column(name, type_, nullable=False, primary_key=False)


def _pk() -> Column:
    return Column("id", ColumnType.INTEGER, nullable=False, primary_key=True)


def _schema() -> Schema:
    business = Table("business", (_pk(), _col("name", ColumnType.TEXT)), ())
    customer = Table(
        "customer",
        (_pk(), _col("business_id"), _col("name", ColumnType.TEXT)),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    # Withheld but owns its own `business_id` (docs/adr/0019): deleted and counted,
    # never exported -- the fake schema needs one so the "deleted only" line this
    # module's tests check for has something real to report.
    invitation = Table(
        "invitation",
        (_pk(), _col("business_id")),
        (ForeignKey(("business_id",), "business", ("id",)),),
    )
    return Schema((business, customer, invitation))


def _unowned_schema() -> Schema:
    # No `business_id`, not a platform table: the run must refuse before it reads
    # anything (the input `unowned_tables` must reject).
    mystery = Table("mystery", (_pk(), _col("value", ColumnType.TEXT)), ())
    tables = list(_schema().tables) + [mystery]
    return Schema(tuple(tables))


def _rows() -> dict[str, list[dict[str, Any]]]:
    return {
        "business": [{"id": 1, "name": "La Huerta"}],
        "customer": [{"id": 5, "business_id": 1, "name": "Juana"}],
    }


@dataclass
class FakeSchemaRows:
    _schema: Schema
    _business: BusinessRef | None
    _table_rows: dict[str, list[dict[str, Any]]]
    _invitation_count: int = 2
    _mismatch: bool = False
    _delete_fails: BaseException | None = None
    _business_of_fails: BaseException | None = None
    delete_calls: list[tuple[str, ...]] = field(default_factory=list)

    def schema(self) -> Schema:
        return self._schema

    def business_of(self, email: str) -> BusinessRef | None:
        if self._business_of_fails is not None:
            raise self._business_of_fails
        return self._business if email == EMAIL else None

    def rows(self, table: str, business_id: int) -> list[dict[str, Any]]:
        return self._table_rows.get(table, [])

    def withheld_count(self, table: str, business_id: int) -> int:
        return self._invitation_count

    def delete_business(self, business_id: int, order: tuple[str, ...]) -> DeletedIds:
        self.delete_calls.append(order)
        if self._delete_fails is not None:
            raise self._delete_fails
        tables: dict[str, frozenset[int]] = {}
        for name in order:
            if name == "invitation":
                continue
            ids = frozenset(row["id"] for row in self._table_rows.get(name, []))
            if self._mismatch and name == "customer":
                ids = frozenset()
            tables[name] = ids
        return DeletedIds(
            tables=tables,
            withheld_counts={"invitation": self._invitation_count},
            login_guard_count=1,
        )


class FakeExportFile:
    """Mirrors `FileExportFile`'s own `discard`/`keep` semantics: `discard()` removes
    only a file this instance "created" (tracked by `exists`), is idempotent, and
    does nothing once `keep()` was called."""

    def __init__(self, fail_on: str | None = None) -> None:
        self.prepared = False
        self.written: tuple[str, dict[str, Any]] | None = None
        self.exists = False
        self.kept = False
        self.discard_calls = 0
        self.fail_on = fail_on

    def prepare(self) -> Path:
        self.prepared = True
        return Path("/fake-export-dir")

    def write_durably(self, name: str, document: dict[str, Any]) -> Path:
        if self.fail_on == "write":
            raise RuntimeError("disk full")
        self.written = (name, document)
        self.exists = True
        return Path("/fake-export-dir") / name

    def read_back(self, path: Path) -> dict[str, Any]:
        if self.fail_on == "read_back":
            raise RuntimeError("disk error")
        assert self.written is not None
        return self.written[1]

    def discard(self) -> None:
        self.discard_calls += 1
        if self.kept:
            return
        self.exists = False

    def keep(self) -> None:
        self.kept = True


class FakeConfirm:
    def __init__(self, answer: str | None | BaseException) -> None:
        self._answer = answer

    def ask(self, prompt: str) -> str | None:
        if isinstance(self._answer, BaseException):
            raise self._answer
        return self._answer


class FakeTransaction:
    def __init__(self) -> None:
        self.committed = False
        self.rolled_back = False

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class FakeTransactionThatFailsToCommit:
    """`commit()` raises, as a dropped connection might: `rollback()` is tracked so
    a test can show it is never called once the commit was attempted (the plan's
    invariant -- the outcome is unknown, not "rolled back")."""

    def __init__(self) -> None:
        self.rolled_back = False

    def commit(self) -> None:
        raise RuntimeError("connection dropped")

    def rollback(self) -> None:
        self.rolled_back = True


class FakeOutput:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def line(self, text: str) -> None:
        self.lines.append(text)


class OutputFailsOnce:
    """Raises `exc` the first time `line` is called after `fail_after` lines have
    already gone through, then behaves like `FakeOutput` from then on -- the one way
    a "right after commit" port failure differs from a persistently broken pipe."""

    def __init__(self, fail_after: int, exc: BaseException) -> None:
        self.lines: list[str] = []
        self._fail_after = fail_after
        self._exc = exc
        self._raised = False

    def line(self, text: str) -> None:
        if not self._raised and len(self.lines) == self._fail_after:
            self._raised = True
            raise self._exc
        self.lines.append(text)


class BrokenPipeAfter:
    """Like `OutputFailsOnce`, but every call from `fail_after` onward raises
    `BrokenPipeError` -- a pipe, once broken, stays broken."""

    def __init__(self, fail_after: int) -> None:
        self.lines: list[str] = []

    def line(self, text: str) -> None:
        if len(self.lines) >= 1:
            raise BrokenPipeError()
        self.lines.append(text)


def _clock() -> datetime:
    return NOW


def _remove(
    schema_rows: SchemaRows,
    export_file: ExportFile | None = None,
    confirm: Confirm | None = None,
    transaction: Transaction | None = None,
    output: Output | None = None,
    email: str = EMAIL,
) -> int:
    """Runs `remove_business` over whichever fakes the caller passes, defaulting
    each to a fresh, unremarkable fake. Only `int` comes back (`remove_business`'s
    own return type): a caller that wants to inspect a fake afterwards keeps its own
    reference to the concrete instance it built, never one narrowed to a Protocol
    (CODING_STANDARDS section 6; the plan's invariant -- no `Any` for a port)."""
    return remove_business(
        schema_rows,
        export_file if export_file is not None else FakeExportFile(),
        confirm if confirm is not None else FakeConfirm("La Huerta\n"),
        transaction if transaction is not None else FakeTransaction(),
        output if output is not None else FakeOutput(),
        _clock,
        email,
    )


def test_dry_run_names_the_business_and_counts_by_table_writing_nothing() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    output = FakeOutput()

    result = dry_run(schema_rows, output, EMAIL)

    assert result == 0
    assert output.lines[0] == "La Huerta"
    assert "customer: 1" in output.lines
    assert output.lines[-1] == "invitation: 2 (deleted only)"


def test_dry_run_reports_an_unknown_email_and_does_nothing() -> None:
    schema_rows = FakeSchemaRows(_schema(), None, {})
    output = FakeOutput()

    result = dry_run(schema_rows, output, "nobody@example.com")

    assert result == 1
    assert output.lines == [NO_BUSINESS_MESSAGE]


def test_dry_run_refuses_a_schema_with_a_table_that_has_no_business_id() -> None:
    schema_rows = FakeSchemaRows(_unowned_schema(), BUSINESS, _rows())
    output = FakeOutput()

    result = dry_run(schema_rows, output, EMAIL)

    assert result == 1
    assert "mystery" in output.lines[0]


def test_dry_run_ends_in_a_fixed_message_when_a_port_raises() -> None:
    # `business_of` can hit a database error whose own text might carry the email
    # it was given; the use case must never let that text, or a traceback, out.
    schema_rows = FakeSchemaRows(
        _schema(), BUSINESS, _rows(), _business_of_fails=RuntimeError(EMAIL)
    )
    output = FakeOutput()

    result = dry_run(schema_rows, output, EMAIL)

    assert result == 1
    assert output.lines == [FAILED_MESSAGE]


def test_remove_business_succeeds_end_to_end() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 0
    assert transaction.committed is True
    assert export_file.exists is True
    assert any(line.startswith("Export written:") for line in output.lines)
    assert output.lines[-1].startswith("Business removed; export kept at")
    assert not any("nothing deleted" in line.lower() for line in output.lines)


def test_remove_business_refuses_a_schema_with_a_table_that_has_no_business_id() -> None:
    schema_rows = FakeSchemaRows(_unowned_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction)

    assert result == 1
    assert export_file.prepared is False
    assert transaction.committed is False


def test_remove_business_ends_in_a_fixed_message_when_business_of_raises() -> None:
    schema_rows = FakeSchemaRows(
        _schema(), BUSINESS, _rows(), _business_of_fails=RuntimeError(EMAIL)
    )
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert output.lines == [FAILED_MESSAGE]
    assert export_file.prepared is False
    assert transaction.committed is False
    assert transaction.rolled_back is True


def test_remove_business_reports_an_unknown_email_and_touches_nothing() -> None:
    schema_rows = FakeSchemaRows(_schema(), None, {})
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(
        schema_rows,
        export_file=export_file,
        transaction=transaction,
        output=output,
        email="nobody@example.com",
    )

    assert result == 1
    assert output.lines == [NO_BUSINESS_MESSAGE]
    assert export_file.prepared is False
    assert transaction.committed is False


def test_a_wrong_name_leaves_everything_and_writes_no_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(
        schema_rows,
        export_file=export_file,
        confirm=FakeConfirm("Wrong Name\n"),
        transaction=transaction,
        output=output,
    )

    assert result == 1
    assert output.lines[-1] == CONFIRMATION_FAILED_MESSAGE
    assert export_file.written is None
    assert transaction.committed is False


def test_eof_at_the_prompt_leaves_everything_and_writes_no_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(
        schema_rows,
        export_file=export_file,
        confirm=FakeConfirm(None),
        transaction=transaction,
        output=output,
    )

    assert result == 1
    assert output.lines[-1] == CONFIRMATION_FAILED_MESSAGE
    assert export_file.written is None
    assert transaction.committed is False


def test_keyboard_interrupt_at_the_prompt_leaves_everything_and_writes_no_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(
        schema_rows,
        export_file=export_file,
        confirm=FakeConfirm(KeyboardInterrupt()),
        transaction=transaction,
        output=output,
    )

    assert result == 1
    assert output.lines[-1] == INTERRUPTED_MESSAGE
    assert export_file.written is None
    assert transaction.committed is False
    assert transaction.rolled_back is True


def test_a_failed_write_rolls_back_and_leaves_no_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile(fail_on="write")
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.rolled_back is True
    assert transaction.committed is False
    assert export_file.exists is False
    assert output.lines[-1] == FAILED_MESSAGE


def test_a_failed_read_back_rolls_back_and_removes_the_file_this_run_wrote() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile(fail_on="read_back")
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.rolled_back is True
    assert transaction.committed is False
    assert export_file.exists is False
    assert output.lines[-1] == FAILED_MESSAGE


def test_a_mismatch_between_exported_and_deleted_ids_rolls_back_and_removes_the_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows(), _mismatch=True)
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.rolled_back is True
    assert transaction.committed is False
    assert export_file.exists is False
    assert output.lines[-1] == str(RecordsChanged())


def test_a_failure_during_the_delete_rolls_back_and_removes_the_file() -> None:
    schema_rows = FakeSchemaRows(
        _schema(), BUSINESS, _rows(), _delete_fails=StorageBusy("locked")
    )
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.rolled_back is True
    assert export_file.exists is False
    assert output.lines[-1] == BUSY_MESSAGE


def test_sigterm_mid_delete_rolls_back_and_removes_the_file() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows(), _delete_fails=Interrupted())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.rolled_back is True
    assert export_file.exists is False
    assert output.lines[-1] == INTERRUPTED_MESSAGE


def test_a_port_failure_right_after_commit_keeps_the_file_and_never_says_nothing_deleted() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = OutputFailsOnce(fail_after=1, exc=RuntimeError("terminal gone"))

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.committed is True
    assert export_file.exists is True
    assert not any("nothing deleted" in line.lower() for line in output.lines)
    assert output.lines[-1].startswith("Business removed; export kept at")


def test_a_broken_pipe_on_the_report_is_swallowed_after_commit() -> None:
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransaction()
    output = BrokenPipeAfter(fail_after=1)

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert transaction.committed is True
    assert export_file.exists is True


def test_a_commit_that_raises_keeps_the_file_and_reports_unknown_outcome() -> None:
    # The commit itself raised: whether it landed is unknown, so the file stays --
    # it may be the only copy left of the business's books (PM's ruling) -- and
    # the report never says "deleted" or "nothing deleted", only the business name,
    # the path and the counts exported.
    schema_rows = FakeSchemaRows(_schema(), BUSINESS, _rows())
    export_file = FakeExportFile()
    transaction = FakeTransactionThatFailsToCommit()
    output = FakeOutput()

    result = _remove(schema_rows, export_file=export_file, transaction=transaction, output=output)

    assert result == 1
    assert export_file.kept is True
    assert export_file.exists is True
    assert transaction.rolled_back is False
    assert any(line.startswith("Commit outcome unknown; export kept at") for line in output.lines)
    assert any(line == "La Huerta" for line in output.lines)
    assert any(line.startswith("customer: exported") for line in output.lines)
    assert not any("deleted" in line.lower() for line in output.lines)
