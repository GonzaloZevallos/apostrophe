"""The payments routes (plan, "Contract"): preview and record a later payment, a
customer's account, deleting a payment, and who owes across the business. Every
figure comes from `settle()`/`account_of()` (`app/payments/domain/`); nothing here
computes a balance.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
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

# Two routers, like `app.sales.adapters.router` and `app.customers.adapters.router`
# have their own prefixes: payments' own routes under `/payments`, and the two that
# name a customer under `/customers`. `app.main` includes both behind the session
# gate.
router = APIRouter(prefix="/payments", tags=["payments"])
customers_router = APIRouter(prefix="/customers", tags=["payments"])

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_ledgers(session: SessionDep, business_id: CurrentBusinessId) -> SqlLedgers:
    return SqlLedgers(session, business_id)


def get_payments(session: SessionDep, business_id: CurrentBusinessId) -> SqlPayments:
    return SqlPayments(session, business_id)


LedgersDep = Annotated[SqlLedgers, Depends(get_ledgers)]
PaymentsDep = Annotated[SqlPayments, Depends(get_payments)]

as_http = TranslateErrors(
    [
        (404, (CustomerNotFound, PaymentNotFound)),
        (409, (OnTheSpot,)),
        (
            422,
            (
                PaymentAboveBalance,
                PaymentFutureDate,
                PaymentAmountInvalid,
                PaymentMethodRequired,
            ),
        ),
    ]
)


@customers_router.post("/{customer_id}/payments/preview")
def preview_payment(
    customer_id: int, body: PaymentPreviewIn, ledgers: LedgersDep, today: TodayDep
) -> PaymentPreviewOut:
    with as_http:
        outcome = preview_payment_use_case(ledgers, customer_id, body.paid_on, body.amount, today)
        return PaymentPreviewOut.of(outcome)


@customers_router.post("/{customer_id}/payments", status_code=201)
def record_payment(
    customer_id: int,
    body: PaymentIn,
    ledgers: LedgersDep,
    payments: PaymentsDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> RecordPaymentOut:
    with as_http:
        recorded = record_payment_use_case(
            ledgers,
            payments,
            session,
            customer_id,
            body.paid_on,
            body.amount,
            body.method,
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
