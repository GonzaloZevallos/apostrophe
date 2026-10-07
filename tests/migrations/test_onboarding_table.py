"""Migration 0015's `onboarding` table (CONTEXT.md: Onboarding; ADR-0035), read from the
schema `upgrade_to_head` really builds: one row per business, each pass limited to the
values the domain knows, no backfill for a business that already existed."""

import re

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.onboarding.domain.onboarding import Pass
from tests.migrations.test_catalog_header_footer_defaults import _upgrade_to

PASS_COLUMNS = ("header_footer_pass", "bot_pass", "partner_pass", "categories_pass")


def _migrated() -> Engine:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'b')"))
    return engine


def _insert(engine: Engine, column: str | None = None, value: str | None = None) -> None:
    columns = "business_id, created_at" + (f", {column}" if column else "")
    values = "1, '2026-10-07 12:00:00'" + (", :value" if column else "")
    with engine.begin() as connection:
        connection.execute(
            text(f"INSERT INTO onboarding ({columns}) VALUES ({values})"), {"value": value}
        )


def test_the_business_is_not_null_and_unique() -> None:
    engine = _migrated()
    inspector = inspect(engine)

    business_id = next(c for c in inspector.get_columns("onboarding") if c["name"] == "business_id")
    uniques = inspector.get_unique_constraints("onboarding")

    assert business_id["nullable"] is False
    assert [(u["name"], u["column_names"]) for u in uniques] == [
        ("uq_onboarding_business_id", ["business_id"])
    ]


def test_a_second_row_for_the_same_business_is_refused() -> None:
    engine = _migrated()
    _insert(engine)

    with pytest.raises(IntegrityError):
        _insert(engine)


@pytest.mark.parametrize("column", PASS_COLUMNS)
def test_each_pass_check_lists_exactly_the_domains_passes(column: str) -> None:
    checks = {c["name"]: c for c in inspect(_migrated()).get_check_constraints("onboarding")}

    listed = set(re.findall(r"'([a-z_]+)'", checks[f"ck_onboarding_{column}"]["sqltext"]))

    assert listed == {value.value for value in Pass}


@pytest.mark.parametrize("column", PASS_COLUMNS)
def test_a_pass_the_domain_does_not_know_is_refused_by_the_database(column: str) -> None:
    engine = _migrated()

    with pytest.raises(IntegrityError):
        _insert(engine, column, "maybe")


@pytest.mark.parametrize("column", PASS_COLUMNS)
def test_a_known_pass_is_stored(column: str) -> None:
    engine = _migrated()

    _insert(engine, column, "skipped")


def test_a_business_that_existed_before_is_given_no_row() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0014")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO business (id, name) VALUES (1, 'Vieja Huerta')"))

    upgrade_to_head(engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM onboarding")).scalar_one() == 0
