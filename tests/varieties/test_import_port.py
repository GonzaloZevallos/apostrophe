"""`VarietiesImport` over a real database (the plan's invariant: an owner's import
adapter writes only its own hexagon's tables, called only with `NoCommit` except at
the end of a real run).

A business comes from the `client` fixture over HTTP (CODING_STANDARDS section 5);
only `VarietiesImport` itself, the seam under test, is built and called directly.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow
from app.shared.grams import Grams
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import Refusal, VarietyKey
from app.spreadsheet_import.domain.rows import PriceHistoryRow, SheetRef
from app.varieties.adapters.import_port import VarietiesImport

REF = SheetRef(sheet="Ajustes", row=37)


def _business_id(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == email))
        assert row is not None
        return row.business_id


def _price_row(
    *,
    row: int = 37,
    variety: str = "Blue Dream",
    effective: date = date(2026, 1, 1),
    list_price: int = 1_000,
    bulk_price: int | None = None,
    bulk_minimum: Grams | None = None,
) -> PriceHistoryRow:
    return PriceHistoryRow(
        ref=SheetRef(sheet="Ajustes", row=row),
        variety=variety,
        effective=effective,
        list_price=list_price,
        bulk_price=bulk_price,
        bulk_minimum=bulk_minimum,
    )


def test_has_records_is_false_for_a_fresh_business(client: TestClient, engine: Engine) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        assert imports.has_records() is False


def test_has_records_is_true_once_a_variety_is_written(client: TestClient, engine: Engine) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        imports.write_variety("Blue Dream", NoCommit())
        session.commit()
        assert imports.has_records() is True


def test_check_name_answers_the_key_and_display_name_for_a_good_name(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        result = imports.check_name("  Blue   Dream ")
        assert isinstance(result, VarietyKey)
        assert result.name == "Blue Dream"
        assert result.key == VarietyKey(key="blue dream", name="Blue Dream").key


def test_check_name_refuses_an_empty_name(client: TestClient, engine: Engine) -> None:
    business_id = _business_id(engine, "uno@example.com")
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        result = imports.check_name("   ")
        assert isinstance(result, Refusal)
        assert result.code == "variety.name_invalid"


def test_check_price_history_flags_a_duplicate_effective_date_aligned_to_its_row(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    rows = [
        _price_row(row=37, effective=date(2026, 1, 1), list_price=1_000),
        _price_row(row=38, effective=date(2026, 1, 1), list_price=1_200),
    ]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        results = imports.check_price_history(rows, keys)

    assert results[0] is None
    assert isinstance(results[1], Refusal)
    assert results[1].code == "variety.duplicate_effective_date"


def test_check_price_history_flags_a_bulk_price_not_below_the_list_price(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    rows = [
        _price_row(
            row=37,
            list_price=1_000,
            bulk_price=1_000,
            bulk_minimum=Grams.of(10),
        )
    ]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        results = imports.check_price_history(rows, keys)

    assert len(results) == 1
    assert isinstance(results[0], Refusal)
    assert results[0].code == "variety.price_entry_invalid"


def test_check_price_history_flags_a_bulk_price_with_no_bulk_minimum(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    rows = [_price_row(row=37, list_price=1_000, bulk_price=800, bulk_minimum=None)]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        results = imports.check_price_history(rows, keys)

    assert len(results) == 1
    assert isinstance(results[0], Refusal)
    assert results[0].code == "variety.price_entry_invalid"


def test_check_price_history_flags_a_bulk_minimum_with_no_bulk_price(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    rows = [_price_row(row=37, list_price=1_000, bulk_price=None, bulk_minimum=Grams.of(10))]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        results = imports.check_price_history(rows, keys)

    assert len(results) == 1
    assert isinstance(results[0], Refusal)
    assert results[0].code == "variety.price_entry_invalid"


def test_check_price_history_flags_a_list_price_at_or_below_zero(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    rows = [_price_row(row=37, list_price=0)]
    keys = {"Blue Dream": "blue dream"}
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        results = imports.check_price_history(rows, keys)

    assert len(results) == 1
    assert isinstance(results[0], Refusal)
    assert results[0].code == "variety.price_entry_invalid"


def test_write_variety_then_write_price_entry_round_trips_through_a_real_session(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine, "uno@example.com")
    row = _price_row(
        effective=date(2026, 2, 1),
        list_price=900,
        bulk_price=700,
        bulk_minimum=Grams.of(5),
    )
    with Session(engine) as session:
        imports = VarietiesImport(session, business_id)
        variety_id = imports.write_variety("Blue Dream", NoCommit())
        imports.write_price_entry(variety_id, row, NoCommit())
        session.commit()

    with Session(engine) as session:
        from app.varieties.adapters.sql_varieties import SqlVarieties

        stored = SqlVarieties(session, business_id).get(variety_id)
        assert stored is not None
        assert stored.name.value == "Blue Dream"
        assert len(stored.price_entries) == 1
        entry = stored.price_entries[0]
        assert entry.list_price == 900
        assert entry.bulk is not None
        assert entry.bulk.price == 700
        assert entry.bulk.minimum == Grams.of(5)
        assert entry.vip_price == 700  # the import writes VIP price = bulk price
