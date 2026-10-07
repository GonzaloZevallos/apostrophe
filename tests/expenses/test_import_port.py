"""`ExpensesImport` (app/expenses/adapters/import_port.py), the import's seam into
expenses: categories matched or added, expenses checked and written exactly as
expenses' own use cases would, as if entered by hand today (the plan, subtask
`expenses-port`). Real SQLite through the port, a business opened through the
fixtures first (CODING_STANDARDS §5): this is a repository-seam test, not a full
import run, so rows are built by hand.
"""

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.expenses.adapters.import_port import ExpensesImport
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import Refusal
from app.spreadsheet_import.domain.rows import GastoRow, SheetRef

# `client` opens the first (and, in these tests, only) business on a fresh engine.
BUSINESS_ID = 1
TODAY = date(2026, 10, 2)


def _row(
    row: int = 2,
    spent_on: date | None = TODAY,
    category: str | None = "Fletes",
    amount: int | None = 1_000,
    detail: str | None = "una entrega",
    revisar: str | None = None,
) -> GastoRow:
    return GastoRow(
        ref=SheetRef("Gastos", row),
        spent_on=spent_on,
        category=category,
        amount=amount,
        detail=detail,
        revisar=revisar,
    )


def test_write_category_matches_a_seeded_category_whatever_the_case_or_spacing(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        matched_id = port.write_category("  insumos   DE cultivo  ", NoCommit())
        session.commit()

        again_id = port.write_category("Insumos de cultivo", NoCommit())

    assert matched_id == again_id


def test_write_category_adds_a_new_category_when_no_key_matches(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        added_id = port.write_category("Fletes", NoCommit())
        session.commit()

        existing_id = port.write_category("fletes", NoCommit())

    assert added_id == existing_id


def test_category_key_folds_case_and_spacing_to_the_same_key(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        key_one = port.category_key("  Insumos   de Cultivo  ")
        key_two = port.category_key("insumos de cultivo")

    assert key_one == key_two
    assert isinstance(key_one, str)


def test_category_key_refuses_a_blank_name(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.category_key("")

    assert isinstance(result, Refusal)


def test_check_expense_accepts_a_well_formed_row(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(), TODAY)

    assert result is None


def test_check_expense_refuses_a_row_with_no_date(client: TestClient, engine: Engine) -> None:
    """Gastos Revisar text `Falta fecha` (the Human's answer): even if a blank
    Revisar wrongly called this row finished, the owner's own check still blocks it
    (the plan's known risk, "Blank Revisar")."""
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(spent_on=None), TODAY)

    assert isinstance(result, Refusal)


def test_category_key_refuses_a_blank_category(client: TestClient, engine: Engine) -> None:
    """Gastos Revisar text `Falta categoría`: a missing category is a blank raw
    name, refused by the same name rule as any other blank category."""
    row = _row(category=None)
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.category_key(row.category or "")

    assert isinstance(result, Refusal)


def test_check_expense_refuses_a_row_with_no_amount(client: TestClient, engine: Engine) -> None:
    """Gastos Revisar text `Falta monto`."""
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(amount=None), TODAY)

    assert isinstance(result, Refusal)


def test_check_expense_refuses_a_future_date(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(spent_on=date(2026, 10, 3)), TODAY)

    assert isinstance(result, Refusal)


def test_check_expense_refuses_an_amount_at_or_below_zero(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(amount=0), TODAY)

    assert isinstance(result, Refusal)


def test_check_expense_refuses_a_blank_detail(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(detail="   "), TODAY)

    assert isinstance(result, Refusal)


def test_check_expense_refuses_a_detail_over_the_limit(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        result = port.check_expense(_row(detail="x" * 201), TODAY)

    assert isinstance(result, Refusal)


def test_write_expense_records_it_with_the_given_category_and_recorded_at(
    client: TestClient, engine: Engine
) -> None:
    recorded_at = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)
        category_id = port.write_category("Fletes", NoCommit())

        port.write_expense(category_id, _row(), recorded_at, TODAY, NoCommit())
        session.commit()

        assert port.has_records() is True


def test_has_records_is_false_with_only_seeded_categories(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)

        assert port.has_records() is False


def test_has_records_is_false_after_a_category_is_renamed_or_removed(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = ExpensesImport(session, BUSINESS_ID)
        port.write_category("Fletes", NoCommit())
        session.commit()

        assert port.has_records() is False
