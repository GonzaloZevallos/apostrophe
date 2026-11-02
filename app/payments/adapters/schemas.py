"""The HTTP shapes of payments and accounts (plan, "Contract"). Bare pydantic models:
every rule stays the domain's, and every refusal's message is a fixed string
(ADR-0005).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field

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
    amount: int


class PaymentIn(BaseModel):
    paid_on: PaymentDate
    amount: int
    payment_method_id: int | None = None


class AppliedToOut(BaseModel):
    sale_id: int
    sale_date: PaymentDate
    amount: int

    @classmethod
    def of(cls, split: Split) -> AppliedToOut:
        return cls(sale_id=split.sale_id, sale_date=split.sale_date, amount=split.amount)


class AfterOut(BaseModel):
    balance: int
    owing_since: PaymentDate | None
    standing: Standing

    @classmethod
    def of(cls, outcome: CandidateOutcome) -> AfterOut:
        return cls(
            balance=outcome.balance, owing_since=outcome.owing_since, standing=outcome.standing
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


class PaymentMethodRefOut(BaseModel):
    """A method as a payment shows it: the id plus the current name and icon, read fresh
    whether or not the method is archived."""

    payment_method_id: int
    name: str
    icon: str

    @classmethod
    def of(cls, label: PaymentMethodLabel) -> PaymentMethodRefOut:
        return cls(payment_method_id=label.id, name=label.name, icon=label.icon)


class PaymentRefOut(PaymentMethodRefOut):
    id: int
    paid_on: PaymentDate
    amount: int

    @classmethod
    def build(
        cls, payment_id: int, paid_on: date, amount: int, label: PaymentMethodLabel
    ) -> PaymentRefOut:
        return cls(
            id=payment_id,
            paid_on=paid_on,
            amount=amount,
            payment_method_id=label.id,
            name=label.name,
            icon=label.icon,
        )


class HowPaidMethodOut(PaymentMethodRefOut):
    kind: Literal["method"] = "method"


class HowPaidOwingOut(BaseModel):
    kind: Literal["owing"] = "owing"


class HowPaidNoneOut(BaseModel):
    kind: Literal["none"] = "none"


HowPaidOut = Annotated[
    HowPaidMethodOut | HowPaidOwingOut | HowPaidNoneOut, Field(discriminator="kind")
]


def _how_paid_out(how_paid: PaymentMethodLabel | Literal["owing", "none"]) -> HowPaidOut:
    if isinstance(how_paid, PaymentMethodLabel):
        return HowPaidMethodOut(
            payment_method_id=how_paid.id, name=how_paid.name, icon=how_paid.icon
        )
    return HowPaidOwingOut() if how_paid == "owing" else HowPaidNoneOut()


class RecordPaymentOut(BaseModel):
    payment: PaymentRefOut
    applied_to: list[AppliedToOut]
    after: AfterOut

    @classmethod
    def of(cls, recorded: RecordedPayment) -> RecordPaymentOut:
        return cls(
            payment=PaymentRefOut.build(
                recorded.id, recorded.paid_on, recorded.amount, recorded.method
            ),
            applied_to=[AppliedToOut.of(split) for split in recorded.outcome.applied_to],
            after=AfterOut.of(recorded.outcome),
        )


class SaleRefOut(BaseModel):
    id: int
    total: int
    how_paid: HowPaidOut


class SaleAccountRowOut(BaseModel):
    kind: Literal["sale"] = "sale"
    date: PaymentDate
    running_balance: int
    standing: Standing
    sale: SaleRefOut


class PaymentAccountRowOut(BaseModel):
    kind: Literal["payment"] = "payment"
    date: PaymentDate
    running_balance: int
    standing: Standing
    payment: PaymentRefOut
    applied_to: AppliedToOut


class CreditAccountRowOut(BaseModel):
    kind: Literal["credit"] = "credit"
    date: PaymentDate
    running_balance: int
    standing: Standing
    payment: PaymentRefOut
    amount: int


AccountRowOut = SaleAccountRowOut | PaymentAccountRowOut | CreditAccountRowOut


def _row_out(row: DomainAccountRow) -> AccountRowOut:
    if isinstance(row, DomainSaleRow):
        return SaleAccountRowOut(
            date=row.date,
            running_balance=row.running_balance,
            standing=row.standing,
            sale=SaleRefOut(id=row.sale_id, total=row.total, how_paid=_how_paid_out(row.how_paid)),
        )
    if isinstance(row, DomainPaymentRow):
        return PaymentAccountRowOut(
            date=row.date,
            running_balance=row.running_balance,
            standing=row.standing,
            payment=PaymentRefOut.build(row.payment_id, row.paid_on, row.amount, row.method),
            applied_to=AppliedToOut.of(row.applied_to),
        )
    assert isinstance(row, DomainCreditRow), "AccountRow is exactly these three kinds"
    return CreditAccountRowOut(
        date=row.date,
        running_balance=row.running_balance,
        standing=row.standing,
        payment=PaymentRefOut.build(row.payment_id, row.paid_on, row.amount, row.method),
        amount=row.credit_amount,
    )


class AccountOut(BaseModel):
    balance: int
    owing_since: PaymentDate | None
    standing: Standing
    rows: list[AccountRowOut]

    @classmethod
    def of(cls, account: Account) -> AccountOut:
        return cls(
            balance=account.balance,
            owing_since=account.owing_since,
            standing=account.standing,
            rows=[_row_out(row) for row in account.rows],
        )


class DebtorCustomerOut(BaseModel):
    id: int
    name: str


class DebtorOut(BaseModel):
    customer: DebtorCustomerOut
    balance: int
    owing_since: PaymentDate | None
    standing: Standing

    @classmethod
    def of(cls, debtor: Debtor) -> DebtorOut:
        return cls(
            customer=DebtorCustomerOut(id=debtor.customer_id, name=debtor.name),
            balance=debtor.balance,
            owing_since=debtor.owing_since,
            standing=debtor.standing,
        )


class DebtorsOut(BaseModel):
    total_owed: int
    sales_owing_count: int
    debtors: list[DebtorOut]

    @classmethod
    def of(cls, debtors: Debtors) -> DebtorsOut:
        return cls(
            total_owed=debtors.total_owed,
            sales_owing_count=debtors.sales_owing_count,
            debtors=[DebtorOut.of(debtor) for debtor in debtors.debtors],
        )
