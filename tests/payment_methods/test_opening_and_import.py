"""A business opens with "Cash" and "Transfer" in its stored language, and the spreadsheet
import resolves a method by name without committing (docs/adr/0055)."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.payment_methods.adapters.babel_defaults import BabelPaymentMethodDefaults
from app.payment_methods.adapters.import_port import PaymentMethodsImport
from app.payment_methods.adapters.opening import PaymentMethodsOpening
from app.payment_methods.adapters.sql_payment_methods import SqlPaymentMethods
from app.payment_methods.application.manage_methods import archive_method, list_methods
from app.payment_methods.domain.method import PaymentMethodIcon
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog
from app.shared.language import ENGLISH, BusinessLanguage, Language

BUSINESS = 1
NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    with Session(engine) as session:
        session.execute(text("INSERT INTO business (id, name, language) VALUES (1, 'B', 'en')"))
        session.commit()
    yield engine
    engine.dispose()


def test_english_defaults_are_cash_with_coins_then_transfer_with_bank() -> None:
    seeds = BabelPaymentMethodDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(ENGLISH)

    assert [(seed.name.value, seed.icon) for seed in seeds] == [
        ("Cash", PaymentMethodIcon.COINS),
        ("Transfer", PaymentMethodIcon.BANK),
    ]


def test_a_language_with_no_catalog_gets_the_english_defaults() -> None:
    seeds = BabelPaymentMethodDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(
        Language("fr")
    )

    assert [seed.name.value for seed in seeds] == ["Cash", "Transfer"]


def test_opening_a_business_writes_its_defaults_and_leaves_the_commit_to_the_caller(
    engine: Engine,
) -> None:
    with Session(engine) as session:
        PaymentMethodsOpening(
            session, BabelPaymentMethodDefaults(CopyCatalog(DEFAULT_LOCALES_DIR))
        ).opened(BUSINESS, BusinessLanguage(ENGLISH))
        assert [m.name.value for m in list_methods(SqlPaymentMethods(session, BUSINESS))] == [
            "Cash",
            "Transfer",
        ]
        session.rollback()
        assert list_methods(SqlPaymentMethods(session, BUSINESS)) == []


def test_the_import_finds_a_method_by_name_ignoring_case_and_spaces(engine: Engine) -> None:
    with Session(engine) as session:
        methods = SqlPaymentMethods(session, BUSINESS)
        PaymentMethodsOpening(
            session, BabelPaymentMethodDefaults(CopyCatalog(DEFAULT_LOCALES_DIR))
        ).opened(BUSINESS, BusinessLanguage(ENGLISH))
        cash = list_methods(methods)[0].id

        assert PaymentMethodsImport(session, BUSINESS).ensure_by_name(" CASH ") == cash
        assert [m.name.value for m in list_methods(methods)] == ["Cash", "Transfer"]


def test_the_import_creates_a_missing_method_last_with_the_generic_icon(engine: Engine) -> None:
    with Session(engine) as session:
        methods = SqlPaymentMethods(session, BUSINESS)

        created = PaymentMethodsImport(session, BUSINESS).ensure_by_name("Mercado Pago")
        again = PaymentMethodsImport(session, BUSINESS).ensure_by_name("mercadopago")

        assert again == created
        only = list_methods(methods)
        assert [(m.id, m.name.value, m.icon) for m in only] == [
            (created, "Mercado Pago", PaymentMethodIcon.GENERIC)
        ]


def test_the_import_finds_an_archived_method_rather_than_failing_on_its_reserved_name(
    engine: Engine,
) -> None:
    with Session(engine) as session:
        methods = SqlPaymentMethods(session, BUSINESS)
        import_port = PaymentMethodsImport(session, BUSINESS)
        old = import_port.ensure_by_name("Old")
        import_port.ensure_by_name("New")
        archive_method(methods, session, old, NOW)

        assert import_port.ensure_by_name("old") == old


def test_the_import_never_commits(engine: Engine) -> None:
    with Session(engine) as session:
        PaymentMethodsImport(session, BUSINESS).ensure_by_name("Mercado Pago")
        session.rollback()

        assert list_methods(SqlPaymentMethods(session, BUSINESS)) == []
