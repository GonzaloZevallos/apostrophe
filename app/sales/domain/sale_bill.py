"""The sale bill's facts (CONTEXT.md: Sale bill): what a seller may share with a sale's
customer, never text. The payment state and the balance are pure rules over what
settlement reports; a combination that cannot be reconciled raises
`SaleBillInconsistent`, whose message names the rule only — never an id, an amount or
a name.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, assert_never

from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import PaymentMethod
from app.shared.quantity import Quantity

BillState = Literal["cash", "transfer", "paid", "owed", "none"]
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


def bill_payment(
    total: int,
    on_the_spot_method: PaymentMethod | None,
    has_customer: bool,
    still_owed: int | None,
) -> BillPayment:
    """The first check that fits wins. `still_owed` is what settlement reports for this
    sale, `None` when it does not list it."""
    if total == 0:
        return BillPayment("none", None)
    if on_the_spot_method is not None:
        if still_owed is not None:
            raise SaleBillInconsistent("a sale paid on the spot is never reported as owed")
        return BillPayment(_spot_state(on_the_spot_method), None)
    if not has_customer:
        raise SaleBillInconsistent("a sale with no customer is paid on the spot or is a gift")
    if still_owed is None:
        raise SaleBillInconsistent("a customer's sale is missing from settlement")
    if still_owed > 0:
        return BillPayment("owed", still_owed)
    return BillPayment("paid", None)


def _spot_state(method: PaymentMethod) -> BillState:
    match method:
        case PaymentMethod.CASH:
            return "cash"
        case PaymentMethod.TRANSFER:
            return "transfer"
        case _:
            assert_never(method)


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
        case PricingRule.LIST | PricingRule.VIP | PricingRule.SPECIAL:
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
    date: BillDate
    shipping_charged: int
    total: int
    lines: tuple[SaleBillLine, ...]
    payment: BillPayment
    balance: int | None
