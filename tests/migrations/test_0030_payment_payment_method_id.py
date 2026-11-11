"""Migration 0030 gives every existing payment the `payment_method_id` of its own
business's method named by the frozen `method`, and changes no value that existed (the
shared comparator). The downgrade works while no payment has been recorded by id and
refuses after one."""

from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db import make_engine
from tests.migrations.comparator import (
    compare,
    downgrade_to,
    snapshot,
    upgrade_and_compare,
    upgrade_to,
)

PAYMENTS: list[tuple[int, int, str, int | None, int | None]] = [
    # (id, business_id, method, customer_id, sale_id)
    (1, 1, "cash", 1, None),  # a later payment, linked to its customer
    (2, 1, "transfer", None, 1),  # an On-the-spot payment, linked to its sale
    (3, 2, "cash", None, None),
    (4, 2, "transfer", None, None),
]


def _engine_at_0029(tmp_path: Path) -> Engine:
    engine = make_engine(f"sqlite:///{tmp_path / 'apostrophe.db'}")
    upgrade_to(engine, "0028")
    with engine.begin() as connection:
        for business_id in (1, 2):
            connection.execute(
                text("INSERT INTO business (id, name, language) VALUES (:b, :n, 'en')"),
                {"b": business_id, "n": f"Negocio {business_id}"},
            )
        connection.execute(
            text(
                "INSERT INTO customer (id, business_id, name, phone, is_vip) "
                "VALUES (1, 1, 'Ana', '+5491100000001', 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO sale (id, business_id, number, sold_on, customer_id, shipping_charged, "
                "recorded_at) VALUES (1, 1, 1, '2026-09-01', NULL, 0, '2026-09-01 10:00:00')"
            )
        )
        for payment_id, business_id, method, customer_id, sale_id in PAYMENTS:
            connection.execute(
                text(
                    "INSERT INTO payment (id, business_id, paid_on, amount, method, "
                    "customer_id, sale_id, recorded_at) VALUES "
                    "(:i, :b, '2026-09-01', 100, :m, :c, :s, '2026-09-01 10:00:00')"
                ),
                {"i": payment_id, "b": business_id, "m": method, "c": customer_id, "s": sale_id},
            )
    upgrade_to(engine, "0029")
    return engine


def test_every_payment_points_to_its_own_business_s_method_and_nothing_that_existed_changes(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0029(tmp_path)

    after = upgrade_and_compare(engine, "0030")

    with engine.connect() as connection:
        names: dict[int, str] = dict(
            connection.execute(
                text("SELECT id, business_id || ':' || name_key FROM payment_method")
            ).all()
        )
    found = {row["id"]: names[row["payment_method_id"]] for row in after["payment"].values()}
    assert found == {1: "1:cash", 2: "1:transfer", 3: "2:cash", 4: "2:transfer"}
    engine.dispose()


def test_the_comparator_would_catch_a_migration_that_rewrote_a_payment(tmp_path: Path) -> None:
    engine = _engine_at_0029(tmp_path)
    before = snapshot(engine)
    upgrade_to(engine, "0030")
    with engine.begin() as connection:
        connection.execute(text("UPDATE payment SET amount = 999 WHERE id = 1"))

    with pytest.raises(AssertionError, match="amount"):
        compare(before, snapshot(engine))
    engine.dispose()


def test_the_downgrade_restores_the_old_shape_while_no_payment_was_recorded_by_id(
    tmp_path: Path,
) -> None:
    engine = _engine_at_0029(tmp_path)
    before = snapshot(engine)
    upgrade_to(engine, "0030")

    downgrade_to(engine, "0029")

    compare(before, snapshot(engine))
    engine.dispose()


def test_the_downgrade_refuses_once_a_payment_has_no_method_value(tmp_path: Path) -> None:
    engine = _engine_at_0029(tmp_path)
    upgrade_to(engine, "0030")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO payment (business_id, paid_on, amount, method, payment_method_id, "
                "recorded_at) VALUES (1, '2026-10-01', 5, NULL, 1, '2026-10-01 10:00:00')"
            )
        )

    with pytest.raises(Exception, match="no method value"):
        downgrade_to(engine, "0029")
    engine.dispose()
