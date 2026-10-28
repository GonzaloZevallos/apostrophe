"""`SqlStockWithdrawals` over a real database (CODING_STANDARDS section 5, ADR-0031):
the repository for `stock_withdrawal` and its lines, built for one business. Varieties
come from the `client` fixtures over HTTP; only the repository is built directly."""

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.shared.quantity import Quantity
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.adapters.tables import StockWithdrawalLineRow
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine
from app.products.adapters.tables import ProductRow

AT = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
DAY = date(2026, 10, 1)
TODAY = date(2026, 10, 2)


def _variety(client: TestClient, name: str) -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _business_of(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(ProductRow).where(ProductRow.id == variety_id))
        assert row is not None
        return row.business_id


def _withdrawal(
    *lines: tuple[int, str],
    reason: WithdrawalReason = WithdrawalReason.PROMOTION,
    withdrawal_id: int | None = None,
    recorded_at: datetime = AT,
) -> Withdrawal:
    return Withdrawal.of(
        reason,
        DAY,
        None,
        tuple(WithdrawalLine.of(variety_id, quantity) for variety_id, quantity in lines),
        TODAY,
        recorded_at,
        id=withdrawal_id,
    )


def test_a_withdrawal_reads_back_with_its_lines_in_the_given_order(
    client: TestClient, engine: Engine
) -> None:
    first = _variety(client, "Lavanda")
    second = _variety(client, "Menta")
    business_id = _business_of(engine, first)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        stored = repository.add(_withdrawal((second, "2"), (first, "3.5")))
        assert stored.id is not None

        read = repository.by_id(stored.id)

    assert read is not None
    assert [(line.variety_id, line.quantity) for line in read.lines] == [
        (second, Quantity.of("2")),
        (first, Quantity.of("3.5")),
    ]
    assert (read.reason, read.withdrawn_on, read.recorded_at) == (
        WithdrawalReason.PROMOTION,
        DAY,
        AT,
    )


def test_a_replace_keeps_id_and_recorded_at_and_reordering_lines_never_trips_the_unique_position(
    client: TestClient, engine: Engine
) -> None:
    first = _variety(client, "Lavanda")
    second = _variety(client, "Menta")
    business_id = _business_of(engine, first)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        stored = repository.add(_withdrawal((first, "1"), (second, "2")))
        assert stored.id is not None

        later = datetime(2026, 10, 2, 9, 0, tzinfo=UTC)
        replaced = repository.replace(
            _withdrawal(
                (second, "2"),
                (first, "1"),
                reason=WithdrawalReason.OWN_USE,
                withdrawal_id=stored.id,
                recorded_at=later,
            )
        )
        read = repository.by_id(stored.id)

    assert replaced.id == stored.id
    assert read is not None
    assert read.recorded_at == AT
    assert read.reason is WithdrawalReason.OWN_USE
    assert [line.variety_id for line in read.lines] == [second, first]


def test_a_replace_with_fewer_lines_leaves_no_stale_line(
    client: TestClient, engine: Engine
) -> None:
    first = _variety(client, "Lavanda")
    second = _variety(client, "Menta")
    business_id = _business_of(engine, first)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        stored = repository.add(_withdrawal((first, "1"), (second, "2")))
        assert stored.id is not None
        repository.replace(_withdrawal((first, "4"), withdrawal_id=stored.id))

        lines = session.scalars(select(StockWithdrawalLineRow)).all()

    assert [(line.variety_id, line.grams_hundredths) for line in lines] == [(first, 400)]


def test_remove_deletes_the_header_and_its_lines(client: TestClient, engine: Engine) -> None:
    variety_id = _variety(client, "Lavanda")
    business_id = _business_of(engine, variety_id)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        stored = repository.add(_withdrawal((variety_id, "1")))
        assert stored.id is not None
        repository.remove(stored.id)

        assert repository.by_id(stored.id) is None
        assert session.scalars(select(StockWithdrawalLineRow)).all() == []


def test_another_business_withdrawal_is_invisible(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client, "Lavanda")
    business_id = _business_of(engine, variety_id)
    other_variety = int(other_client.post("/varieties", json={"name": "Menta"}).json()["id"])
    other_business_id = _business_of(engine, other_variety)
    assert other_business_id != business_id

    with Session(engine) as session:
        stored = SqlStockWithdrawals(session, business_id).add(_withdrawal((variety_id, "1")))
        assert stored.id is not None
        foreign = SqlStockWithdrawals(session, other_business_id)

        assert foreign.by_id(stored.id) is None
        assert foreign.for_varieties(None) == []
        assert foreign.for_varieties({variety_id}) == []
        assert foreign.movements_of(variety_id) == []


def test_for_varieties_answers_one_draw_per_line_and_narrows(
    client: TestClient, engine: Engine
) -> None:
    first = _variety(client, "Lavanda")
    second = _variety(client, "Menta")
    business_id = _business_of(engine, first)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        stored = repository.add(
            _withdrawal((first, "1"), (second, "2"), reason=WithdrawalReason.OWN_USE)
        )

        everything = repository.for_varieties(None)
        narrowed = repository.for_varieties({second})

    assert [(d.variety_id, d.position, d.quantity, d.reason) for d in everything] == [
        (first, 0, Quantity.of("1"), WithdrawalReason.OWN_USE),
        (second, 1, Quantity.of("2"), WithdrawalReason.OWN_USE),
    ]
    assert [(d.variety_id, d.withdrawal_id, d.day, d.recorded_at) for d in narrowed] == [
        (second, stored.id, DAY, AT)
    ]


def test_movements_of_a_variety_sum_that_variety_grams_per_withdrawal(
    client: TestClient, engine: Engine
) -> None:
    first = _variety(client, "Lavanda")
    second = _variety(client, "Menta")
    business_id = _business_of(engine, first)

    with Session(engine) as session:
        repository = SqlStockWithdrawals(session, business_id)
        repository.add(_withdrawal((first, "1"), (second, "9"), (first, "2.5")))
        repository.add(_withdrawal((second, "4")))

        movements = repository.movements_of(first)

    assert [(m.reason, m.quantity) for m in movements] == [
        (WithdrawalReason.PROMOTION, Quantity.of("3.5"))
    ]
