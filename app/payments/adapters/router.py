"""The payments routes (plan, "Contract"): preview and record a later payment, a
customer's account, deleting a payment, and who owes across the business. Every
figure comes from `settle()`/`account_of()` (`app/payments/domain/`); nothing here
computes a balance.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.money_route import MoneyJsonRoute
from app.payments.adapters.schemas import (
    AccountOut,
    DebtorsOut,
    PaymentIn,
    PaymentPreviewIn,
    PaymentPreviewOut,
    RecordPaymentOut,
)
from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.adapters.sql_payments import SqlPayments
from app.payments.application.delete_payment import delete_payment as delete_payment_use_case
from app.payments.application.errors import CustomerNotFound, OnTheSpot, PaymentNotFound
from app.payments.application.ports import AvailableMethods, MoneyFormatReader
from app.payments.application.record_payment import preview_payment as preview_payment_use_case
from app.payments.application.record_payment import record_payment as record_payment_use_case
from app.payments.application.view_accounts import account as account_use_case
from app.payments.application.view_accounts import debtors as debtors_use_case
from app.payments.domain.payment import (
    PaymentAboveBalance,
    PaymentAmountInvalid,
    PaymentFutureDate,
    PaymentMethodRequired,
)
from app.shared.money import TooManyDecimals
from app.shared.payment_method import PaymentMethodUnavailable

# Two routers, like `app.sales.adapters.router` and `app.customers.adapters.router`
# have their own prefixes: payments' own routes under `/payments`, and the two that
# name a customer under `/customers`. `app.main` includes both behind the session
# gate.
router = APIRouter(prefix="/payments", tags=["payments"], route_class=MoneyJsonRoute)
customers_router = APIRouter(prefix="/customers", tags=["payments"], route_class=MoneyJsonRoute)

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_ledgers(session: SessionDep, business_id: CurrentBusinessId) -> SqlLedgers:
    return SqlLedgers(session, business_id)


def get_payments(session: SessionDep, business_id: CurrentBusinessId) -> SqlPayments:
    return SqlPayments(session, business_id)


def get_available_methods(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> AvailableMethods:
    # Payments never imports `app.payment_methods` (CODING_STANDARDS section 1):
    # `app/main.py` hangs the real implementation on `app.state.available_methods`.
    factory = cast(Callable[[Session, int], AvailableMethods], request.app.state.available_methods)
    return factory(session, business_id)


MethodsDep = Annotated[AvailableMethods, Depends(get_available_methods)]


def get_money_format(
    request: Request, session: SessionDep, business_id: CurrentBusinessId
) -> MoneyFormatReader:
    # Payments never imports `app.money_format` (docs/adr/0055): `app/main.py` hangs
    # `SqlMoneyFormat` on `app.state.payments_money_format` as a factory.
    factory = cast(
        Callable[[Session, int], MoneyFormatReader], request.app.state.payments_money_format
    )
    return factory(session, business_id)


MoneyFormatDep = Annotated[MoneyFormatReader, Depends(get_money_format)]
LedgersDep = Annotated[SqlLedgers, Depends(get_ledgers)]
PaymentsDep = Annotated[SqlPayments, Depends(get_payments)]

as_http = TranslateErrors(
    [
        (404, (CustomerNotFound, PaymentNotFound, PaymentMethodUnavailable)),
        (409, (OnTheSpot,)),
        (
            422,
            (
                PaymentAboveBalance,
                PaymentFutureDate,
                PaymentAmountInvalid,
                PaymentMethodRequired,
                TooManyDecimals,
            ),
        ),
    ]
)


@customers_router.post("/{customer_id}/payments/preview")
def preview_payment(
    customer_id: int,
    body: PaymentPreviewIn,
    ledgers: LedgersDep,
    money_format: MoneyFormatDep,
    today: TodayDep,
) -> PaymentPreviewOut:
    with as_http:
        outcome = preview_payment_use_case(
            ledgers, money_format, customer_id, body.paid_on, body.amount, today
        )
        return PaymentPreviewOut.of(outcome)


@customers_router.post("/{customer_id}/payments", status_code=201)
def record_payment(
    customer_id: int,
    body: PaymentIn,
    ledgers: LedgersDep,
    payments: PaymentsDep,
    methods: MethodsDep,
    money_format: MoneyFormatDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> RecordPaymentOut:
    with as_http:
        recorded = record_payment_use_case(
            ledgers,
            payments,
            methods,
            money_format,
            session,
            customer_id,
            body.paid_on,
            body.amount,
            body.payment_method_id,
            today,
            clock(),
        )
        return RecordPaymentOut.of(recorded)


@customers_router.get("/{customer_id}/account")
def get_account(customer_id: int, ledgers: LedgersDep) -> AccountOut:
    with as_http:
        return AccountOut.of(account_use_case(ledgers, customer_id))


@router.delete("/{payment_id}", status_code=204)
def delete_payment(payment_id: int, payments: PaymentsDep, session: SessionDep) -> None:
    with as_http:
        delete_payment_use_case(payments, session, payment_id)


@router.get("/debtors")
def get_debtors(ledgers: LedgersDep) -> DebtorsOut:
    return DebtorsOut.of(debtors_use_case(ledgers))
