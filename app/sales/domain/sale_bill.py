"""The sale bill's facts (CONTEXT.md: Sale bill): what a seller may share with a sale's
customer, never text. The payment state and the balance are pure rules over what
settlement reports; a combination that cannot be reconciled raises
`SaleBillInconsistent`, whose message names the rule only — never an id, an amount or
a name.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Literal, assert_never

from app.sales.domain.pricing import PricingRule
from app.shared.payment_method import PaymentMethodId
from app.shared.quantity import Quantity

BillState = Literal["paid", "owed", "none"]
BillRule = Literal["bulk", "gift"]

# `SaleBill.date` names the sale's own date; a bare `date` inside the class body would
# resolve to the field, not the type (same trap as `app.sales.domain.sale.SaleDate`).
BillDate = date


class SaleBillInconsistent(Exception):
    """The payment facts cannot be reconciled, so there is no bill. The message is fixed
    per rule and built from no input."""


@dataclass(frozen=True)
class BillPayment:
    """How the sale was paid; `still_owed` is set only when the state is owed."""

    state: BillState
    still_owed: int | None

    def __post_init__(self) -> None:
        assert (self.state == "owed") == (self.still_owed is not None), (
            "the amount still owed is set exactly when the state is owed"
        )


class PaymentState(StrEnum):
    """Where a sale stands on being paid (CONTEXT.md: Payment state). The values are the
    wire strings."""

    PAID = "paid"
    UNPAID = "unpaid"
    PART_PAID = "part_paid"


def payment_state(
    total: int,
    on_the_spot_method: PaymentMethodId | None,
    has_customer: bool,
    still_owed: int | None,
) -> PaymentState:
    """The one rule that decides a sale's Payment state; the first that applies wins.
    `still_owed` is what settlement reports for this sale, `None` when it does not list
    it. The only place a customer's amount owed is checked against `0..total`."""
    if total == 0:
        return PaymentState.PAID
    if on_the_spot_method is not None:
        if still_owed is not None:
            raise SaleBillInconsistent("a sale paid on the spot is never reported as owed")
        return PaymentState.PAID
    if not has_customer:
        raise SaleBillInconsistent("a sale with no customer is paid on the spot or is a gift")
    if still_owed is None:
        raise SaleBillInconsistent("a customer's sale is missing from settlement")
    if still_owed < 0 or still_owed > total:
        raise SaleBillInconsistent("a sale's amount owed lies outside zero and its total")
    if still_owed == 0:
        return PaymentState.PAID
    if still_owed == total:
        return PaymentState.UNPAID
    return PaymentState.PART_PAID


@dataclass(frozen=True)
class SalePayment:
    """A sale's Payment state with the amount still owed on it, `0` when paid."""

    state: PaymentState
    still_owed: int
    total: int

    def __post_init__(self) -> None:
        assert (self.state is PaymentState.PAID) == (self.still_owed == 0), (
            "a sale is paid exactly when nothing is owed on it"
        )
        assert (self.state is PaymentState.UNPAID) == (
            self.still_owed == self.total and self.total > 0
        ), "a sale is unpaid exactly when all of a positive total is owed"
        assert (self.state is PaymentState.PART_PAID) == (0 < self.still_owed < self.total), (
            "a sale is part-paid exactly when the amount owed lies strictly inside its total"
        )


def sale_payment(
    total: int,
    on_the_spot_method: PaymentMethodId | None,
    has_customer: bool,
    still_owed: int | None,
) -> SalePayment:
    """`payment_state` with the amount: `0` when paid, settlement's figure otherwise."""
    state = payment_state(total, on_the_spot_method, has_customer, still_owed)
    if state is PaymentState.PAID:
        return SalePayment(state, 0, total)
    assert still_owed is not None, "a sale that is not paid has an amount owed"
    return SalePayment(state, still_owed, total)


def bill_payment_of(payment: SalePayment) -> BillPayment:
    """How the Sale bill words a sale's payment: paid, or owed with the amount."""
    if payment.state is PaymentState.PAID:
        return BillPayment("paid", None)
    return BillPayment("owed", payment.still_owed)


def bill_payment(
    total: int,
    on_the_spot_method: PaymentMethodId | None,
    has_customer: bool,
    still_owed: int | None,
) -> BillPayment:
    """A total of 0 is `none`; otherwise the Payment state decides."""
    if total == 0:
        return BillPayment("none", None)
    return bill_payment_of(sale_payment(total, on_the_spot_method, has_customer, still_owed))


def bill_balance(has_customer: bool, balance: int) -> int | None:
    """The customer's whole current account, signed; `None` with no customer or no
    balance."""
    if not has_customer or balance == 0:
        return None
    return balance


def bill_rule(rule: PricingRule) -> BillRule | None:
    """Only bulk and gift are worth telling a customer; every other rule is internal."""
    match rule:
        case PricingRule.BULK:
            return "bulk"
        case PricingRule.GIFT:
            return "gift"
        case PricingRule.LIST | PricingRule.VIP | PricingRule.CUSTOMER_TYPE | PricingRule.SPECIAL:
            return None
        case _:
            assert_never(rule)


@dataclass(frozen=True)
class SaleBillLine:
    product: str
    quantity: Quantity
    amount: int
    rule: BillRule | None
    unit_price: int | None


@dataclass(frozen=True)
class SaleBill:
    business_name: str
    number: int
    date: BillDate
    shipping_charged: int
    total: int
    lines: tuple[SaleBillLine, ...]
    payment: BillPayment
    balance: int | None
