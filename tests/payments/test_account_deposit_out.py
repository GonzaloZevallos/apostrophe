"""A Deposit on the account's API shape: `AccountOut.of` over the domain's own rows,
no database, and the OpenAPI schemas of the Deposit variants (ADR-20261125)."""

from __future__ import annotations

import json
from datetime import date, datetime

from app.main import create_app
from app.payments.adapters.schemas import AccountOut
from app.payments.application.view_accounts import AccountRead
from app.payments.domain.account import account_of
from app.payments.domain.customer_sales import customer_sales
from app.payments.domain.settlement import LaterPaymentEntry
from app.shared.payment_method import PaymentMethodLabel
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram
from tests.payments.builders import deposit_sale

AT = datetime(2026, 9, 1, 10, 0)
CASH = PaymentMethodLabel(1, "Cash", "banknote")
TRANSFER = PaymentMethodLabel(2, "Transfer", "bank")
TODAY = date(2026, 10, 2)


def _out() -> dict[str, object]:
    sales = [deposit_sale(1, date(2026, 9, 1), 5_000, 2_000, CASH)]
    payments = [LaterPaymentEntry(10, date(2026, 9, 5), AT, 1_000, TRANSFER)]
    read = AccountRead(
        account=account_of(sales, payments),
        age_days=None,
        still_owing=(),
        sales=customer_sales(sales, TODAY),
    )
    return AccountOut.of(read).model_dump(mode="json")


def test_the_deposit_row_is_its_own_shape_after_its_sale_row() -> None:
    rows = _out()["rows"]

    assert isinstance(rows, list)
    sale_row, deposit_row, payment_row = rows
    assert sale_row["sale"]["how_paid"] == "deposit"
    assert sale_row["running_balance"] == 5000
    assert deposit_row["kind"] == "deposit"
    assert deposit_row["is_partial"] is True
    assert deposit_row["standing"] == "owes"
    assert deposit_row["deposit"]["sale_id"] == 1
    assert deposit_row["deposit"]["amount"] == 2000
    assert deposit_row["deposit"]["payment_method"]["name"] == "Cash"
    assert payment_row["kind"] == "payment"


def test_no_payment_id_appears_on_the_deposit_row() -> None:
    rows = _out()["rows"]

    assert isinstance(rows, list)
    deposit_row = rows[1]
    assert "payment_id" not in json.dumps(deposit_row)
    assert set(deposit_row) == {
        "kind",
        "date",
        "running_balance",
        "standing",
        "is_partial",
        "deposit",
    }
    assert set(deposit_row["deposit"]) == {"sale_id", "amount", "payment_method"}


def test_the_deposit_schemas_carry_no_payment_id_nor_id(clock: MovableClock) -> None:
    document = create_app(
        SETTINGS,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    ).openapi()
    schemas = document["components"]["schemas"]

    for name in ("DepositAccountRowOut", "DepositRefOut"):
        properties = schemas[name]["properties"]
        assert "payment_id" not in properties
        assert "id" not in properties
    assert schemas["DepositAccountRowOut"]["properties"]["kind"]["const"] == "deposit"
