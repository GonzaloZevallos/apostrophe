"""0026 links every payment to a method by id and freezes `payment.method` (docs/adr/0078).
The shared comparator proves no pre-existing value changed; the rest is what 0026 adds."""

from __future__ import annotations

import pytest
from sqlalchemy import Connection, text
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from tests.migrations.allowed_schema import (
    Allowed,
    Snapshot,
    TableSnapshot,
    compare_migration,
    snapshot,
    step,
    violations,
)

ALLOWED = Allowed(
    relaxed_to_null=frozenset({("payment", "method")}),
    added_not_null=frozenset({("payment", "payment_method_id")}),
)


def _seed(connection: Connection) -> None:
    for business_id, name in ((1, "With payments"), (2, "Other"), (3, "Without payments")):
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (:i, :n, 'en')"),
            {"i": business_id, "n": name},
        )
    for customer_id, business_id in ((1, 1), (2, 2)):
        connection.execute(
            text("INSERT INTO customer (id, business_id, name, vip) VALUES (:i, :b, 'C', 0)"),
            {"i": customer_id, "b": business_id},
        )
    payments = (
        (1, 1, 1, "cash", 500),
        (2, 1, 1, "transfer", 700),
        (3, 2, 2, "transfer", 900),
        (4, 2, 2, "cash", 100),
    )
    for payment_id, business_id, customer_id, method, amount in payments:
        connection.execute(
            text(
                "INSERT INTO payment (id, business_id, paid_on, amount, method, customer_id, "
                "recorded_at) VALUES (:i, :b, '2026-09-20', :a, :m, :c, '2026-09-20 10:00:00')"
            ),
            {"i": payment_id, "b": business_id, "a": amount, "m": method, "c": customer_id},
        )


def _upgraded() -> tuple[Snapshot, Snapshot]:
    return compare_migration(from_revision="0024", to_revision="0026", seed=_seed, allowed=ALLOWED)


def test_no_pre_existing_value_changes_and_only_the_two_allowed_schema_changes_happen() -> None:
    _before, after = _upgraded()

    assert after["payment"].nullable["method"] is True
    assert after["payment"].nullable["payment_method_id"] is False


def test_every_payment_is_linked_to_the_method_of_its_old_value_in_its_own_business() -> None:
    _before, after = _upgraded()
    methods = {(row["business_id"], row["name"]): row["id"] for row in after["payment_method"].rows}

    linked = {row["id"]: row["payment_method_id"] for row in after["payment"].rows}
    assert linked == {
        1: methods[(1, "Cash")],
        2: methods[(1, "Transfer")],
        3: methods[(2, "Transfer")],
        4: methods[(2, "Cash")],
    }
    assert all(row["payment_method_id"] is not None for row in after["payment"].rows)


def test_every_business_even_one_without_payments_has_exactly_cash_and_transfer() -> None:
    _before, after = _upgraded()

    per_business: dict[int, list[tuple[str, str, int]]] = {}
    for row in sorted(after["payment_method"].rows, key=lambda r: r["position"]):
        per_business.setdefault(row["business_id"], []).append(
            (row["name"], row["icon"], row["position"])
        )
    expected = [("Cash", "coins", 1), ("Transfer", "bank", 2)]
    assert per_business == {1: expected, 2: expected, 3: expected}


def test_a_payment_cannot_point_at_another_business_s_method() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1,'A','en')"))
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (2,'B','en')"))
        connection.execute(
            text(
                "INSERT INTO payment_method (id, business_id, name, name_key, icon, position) "
                "VALUES (7, 2, 'Cash', 'cash', 'coins', 1)"
            )
        )
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys = ON"))
        connection.execute(
            text(
                "INSERT INTO payment (business_id, paid_on, amount, payment_method_id, "
                "recorded_at) VALUES (1, '2026-09-20', 5, 7, '2026-09-20 10:00:00')"
            )
        )


def test_the_downgrade_refuses_while_a_payment_has_no_method_value() -> None:
    engine = make_engine("sqlite://")
    step(engine, "upgrade", "0026")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name, language) VALUES (1,'A','en')"))
        connection.execute(
            text(
                "INSERT INTO payment_method (id, business_id, name, name_key, icon, position) "
                "VALUES (1, 1, 'Wallet', 'wallet', 'generic', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO payment (business_id, paid_on, amount, method, payment_method_id, "
                "recorded_at) VALUES (1, '2026-09-20', 5, NULL, 1, '2026-09-20 10:00:00')"
            )
        )

    with pytest.raises(RuntimeError, match="cannot downgrade"):
        step(engine, "downgrade", "0025")


# -- the comparator itself rejects what it must ---------------------------------------------


def _table(rows: list[dict[str, object]], *, nullable: bool = False) -> TableSnapshot:
    return TableSnapshot(
        nullable={"id": False, "amount": nullable},
        types={"id": "INTEGER", "amount": "INTEGER"},
        rows=rows,
    )


def test_the_comparator_rejects_a_changed_value() -> None:
    before = {"payment": _table([{"id": 1, "amount": 500}])}
    after = {"payment": _table([{"id": 1, "amount": 501}])}

    assert violations(before, after, Allowed()) == ["payment.amount of row 0 was 500 and is 501"]


def test_the_comparator_rejects_a_gone_table_a_gone_column_and_a_new_unlisted_column() -> None:
    before = {"payment": _table([]), "sale": _table([])}
    narrower = TableSnapshot(nullable={"id": False}, types={"id": "INTEGER"}, rows=[])
    wider = TableSnapshot(
        nullable={"id": False, "amount": False, "extra": False},
        types={"id": "INTEGER", "amount": "INTEGER", "extra": "INTEGER"},
        rows=[],
    )

    assert violations(before, {"payment": narrower}, Allowed()) == [
        "column payment.amount is gone",
        "table sale is gone",
    ]
    assert violations({"payment": _table([])}, {"payment": wider}, Allowed()) == [
        "column payment.extra was added and is not allowed"
    ]


def test_the_comparator_rejects_a_nullability_change_nobody_listed() -> None:
    before = {"payment": _table([])}
    after = {"payment": _table([], nullable=True)}

    assert violations(before, after, Allowed()) == ["column payment.amount changed nullability"]
    assert (
        violations(before, after, Allowed(relaxed_to_null=frozenset({("payment", "amount")}))) == []
    )


def test_snapshot_reads_the_values_of_a_real_database() -> None:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with engine.connect() as connection:
        taken = snapshot(connection)

    assert "payment" in taken
    assert taken["payment"].nullable["method"] is True
