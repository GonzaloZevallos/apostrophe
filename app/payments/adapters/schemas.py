"""The HTTP shapes of payments and accounts (plan, "Contract"). Bare pydantic models:
every rule stays the domain's, and every refusal's message is a fixed string
(ADR-0005).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.money_schema import MoneyAmount, MoneyOut
from app.payments.application.record_payment import CandidateOutcome, RecordedPayment
from app.payments.application.view_accounts import Debtor, Debtors
from app.payments.domain.account import Account
from app.payments.domain.account import AccountRow as DomainAccountRow
from app.payments.domain.account import CreditRow as DomainCreditRow
from app.payments.domain.account import PaymentRow as DomainPaymentRow
from app.payments.domain.account import SaleRow as DomainSaleRow
from app.payments.domain.settlement import Split, Standing
from app.shared.payment_method import PaymentMethodLabel

# A row's own `date` field shadows the `date` type for any field declared after it in
# the same class body (the same trap `app.sales.adapters.schemas.SaleDate` sidesteps).
PaymentDate = date


class PaymentPreviewIn(BaseModel):
    paid_on: PaymentDate
    amount: MoneyAmount


class PaymentIn(BaseModel):
    paid_on: PaymentDate
    amount: MoneyAmount
    payment_method_id: int | None = None


class AppliedToOut(BaseModel):
    sale_id: int
    sale_date: PaymentDate
    amount: MoneyOut

    @classmethod
    def of(cls, split: Split) -> AppliedToOut:
        return cls(sale_id=split.sale_id, sale_date=split.sale_date, amount=Decimal(split.amount))


class AfterOut(BaseModel):
    balance: MoneyOut
    owing_since: PaymentDate | None
    standing: Standing

    @classmethod
    def of(cls, outcome: CandidateOutcome) -> AfterOut:
        return cls(
            balance=Decimal(outcome.balance),
            owing_since=outcome.owing_since,
            standing=outcome.standing,
        )


class PaymentPreviewOut(BaseModel):
    applied_to: list[AppliedToOut]
    after: AfterOut

    @classmethod
    def of(cls, outcome: CandidateOutcome) -> PaymentPreviewOut:
        return cls(
            applied_to=[AppliedToOut.of(split) for split in outcome.applied_to],
            after=AfterOut.of(outcome),
        )


class PaymentMethodLabelOut(BaseModel):
    """A method as a read shows it: its current name and icon, archived or not."""

    id: int
    name: str
    icon: str

    @classmethod
    def of(cls, label: PaymentMethodLabel) -> PaymentMethodLabelOut:
        return cls(id=label.id, name=label.name, icon=label.icon)


class PaymentRefOut(BaseModel):
    id: int
    paid_on: PaymentDate
    amount: MoneyOut
    payment_method_id: int


class AccountPaymentRefOut(BaseModel):
    id: int
    paid_on: PaymentDate
    amount: MoneyOut
    payment_method: PaymentMethodLabelOut


class RecordPaymentOut(BaseModel):
    payment: PaymentRefOut
    applied_to: list[AppliedToOut]
    after: AfterOut

    @classmethod
    def of(cls, recorded: RecordedPayment) -> RecordPaymentOut:
        return cls(
            payment=PaymentRefOut(
                id=recorded.id,
                paid_on=recorded.paid_on,
                amount=Decimal(recorded.amount),
                payment_method_id=recorded.method.value,
            ),
            applied_to=[AppliedToOut.of(split) for split in recorded.outcome.applied_to],
            after=AfterOut.of(recorded.outcome),
        )


class SaleRefOut(BaseModel):
    id: int
    total: MoneyOut
    how_paid: Literal["paid", "owing", "none"]
    payment_method: PaymentMethodLabelOut | None


class SaleAccountRowOut(BaseModel):
    kind: Literal["sale"] = "sale"
    date: PaymentDate
    running_balance: MoneyOut
    standing: Standing
    sale: SaleRefOut


class PaymentAccountRowOut(BaseModel):
    kind: Literal["payment"] = "payment"
    date: PaymentDate
    running_balance: MoneyOut
    standing: Standing
    payment: AccountPaymentRefOut
    applied_to: AppliedToOut


class CreditAccountRowOut(BaseModel):
    kind: Literal["credit"] = "credit"
    date: PaymentDate
    running_balance: MoneyOut
    standing: Standing
    payment: AccountPaymentRefOut
    amount: MoneyOut


AccountRowOut = SaleAccountRowOut | PaymentAccountRowOut | CreditAccountRowOut


def _row_out(row: DomainAccountRow) -> AccountRowOut:
    if isinstance(row, DomainSaleRow):
        return SaleAccountRowOut(
            date=row.date,
            running_balance=Decimal(row.running_balance),
            standing=row.standing,
            sale=SaleRefOut(
                id=row.sale_id,
                total=Decimal(row.total),
                how_paid=row.how_paid,
                payment_method=None
                if row.payment_method is None
                else PaymentMethodLabelOut.of(row.payment_method),
            ),
        )
    if isinstance(row, DomainPaymentRow):
        return PaymentAccountRowOut(
            date=row.date,
            running_balance=Decimal(row.running_balance),
            standing=row.standing,
            payment=AccountPaymentRefOut(
                id=row.payment_id,
                paid_on=row.paid_on,
                amount=Decimal(row.amount),
                payment_method=PaymentMethodLabelOut.of(row.method),
            ),
            applied_to=AppliedToOut.of(row.applied_to),
        )
    assert isinstance(row, DomainCreditRow), "AccountRow is exactly these three kinds"
    return CreditAccountRowOut(
        date=row.date,
        running_balance=Decimal(row.running_balance),
        standing=row.standing,
        payment=AccountPaymentRefOut(
            id=row.payment_id,
            paid_on=row.paid_on,
            amount=Decimal(row.amount),
            payment_method=PaymentMethodLabelOut.of(row.method),
        ),
        amount=Decimal(row.credit_amount),
    )


class AccountOut(BaseModel):
    balance: MoneyOut
    owing_since: PaymentDate | None
    standing: Standing
    rows: list[AccountRowOut]

    @classmethod
    def of(cls, account: Account) -> AccountOut:
        return cls(
            balance=Decimal(account.balance),
            owing_since=account.owing_since,
            standing=account.standing,
            rows=[_row_out(row) for row in account.rows],
        )


class DebtorCustomerOut(BaseModel):
    id: int
    name: str


class DebtorOut(BaseModel):
    customer: DebtorCustomerOut
    balance: MoneyOut
    owing_since: PaymentDate | None
    standing: Standing

    @classmethod
    def of(cls, debtor: Debtor) -> DebtorOut:
        return cls(
            customer=DebtorCustomerOut(id=debtor.customer_id, name=debtor.name),
            balance=Decimal(debtor.balance),
            owing_since=debtor.owing_since,
            standing=debtor.standing,
        )


class DebtorsOut(BaseModel):
    total_owed: MoneyOut
    sales_owing_count: int
    debtors: list[DebtorOut]

    @classmethod
    def of(cls, debtors: Debtors) -> DebtorsOut:
        return cls(
            total_owed=Decimal(debtors.total_owed),
            sales_owing_count=debtors.sales_owing_count,
            debtors=[DebtorOut.of(debtor) for debtor in debtors.debtors],
        )
