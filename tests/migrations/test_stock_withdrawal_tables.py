"""Migration 0012's stock withdrawal tables (CONTEXT.md: Stock withdrawal), read from
the schema `upgrade_to_head` really builds: the reason's check constraint lists exactly
the reasons the domain knows, and refuses any other value."""

import re

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.stock.domain.draw_source import WithdrawalReason


def _migrated() -> Engine:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    return engine


def _insert_header(engine: Engine, reason: str) -> None:
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'b')"))
        connection.execute(
            text(
                "INSERT INTO stock_withdrawal (business_id, reason, withdrawn_on, recorded_at) "
                "VALUES (1, :reason, '2026-10-01', '2026-10-01 12:00:00')"
            ),
            {"reason": reason},
        )


def test_the_reason_check_lists_exactly_the_domains_reasons() -> None:
    engine = _migrated()

    checks = inspect(engine).get_check_constraints("stock_withdrawal")

    assert [check["name"] for check in checks] == ["ck_stock_withdrawal_reason"]
    listed = set(re.findall(r"'([a-z_]+)'", checks[0]["sqltext"]))
    assert listed == {reason.value for reason in WithdrawalReason}


def test_a_reason_the_domain_does_not_know_is_refused_by_the_database() -> None:
    engine = _migrated()

    with pytest.raises(IntegrityError):
        _insert_header(engine, "gift")


def test_a_known_reason_is_accepted() -> None:
    engine = _migrated()

    _insert_header(engine, WithdrawalReason.OWN_USE.value)


def test_two_lines_of_one_withdrawal_cannot_share_a_position() -> None:
    engine = _migrated()
    _insert_header(engine, WithdrawalReason.PROMOTION.value)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO variety (id, business_id, name, name_key) VALUES (1, 1, 'v', 'v')")
        )
    line = (
        "INSERT INTO stock_withdrawal_line "
        "(business_id, stock_withdrawal_id, variety_id, position, grams_hundredths) "
        "VALUES (1, 1, 1, 0, 100)"
    )
    with engine.begin() as connection:
        connection.execute(text(line))

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text(line))
