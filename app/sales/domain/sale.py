"""The `Sale` aggregate (CONTEXT.md: Sale, Sale line, Sale without a customer, Gift,
Special price, Shipping charged, Note; ADR-0003).

`Sale` is the one root: lines and the on-the-spot payment are built with it, by
`Sale.record`, and never assembled piecemeal. Every line's price per gram and pricing
rule are computed once, there, and stored; nothing later recomputes them (docs/adr/0003).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime
from enum import StrEnum

from app.sales.domain.pricing import PriceQuote, PricingRule, SaleRuleBroken, price_line
from app.shared.grams import Grams

NOTE_MAX_LENGTH = 200

# `Sale.date` names the field CONTEXT.md gives a sale (its own date); every other use
# of the `date` type inside this class refers to this alias instead, since a bare
# `date` inside the class body would otherwise resolve to that field, not the type.
SaleDate = date


class NoLines(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a sale needs at least one line")


class SaleDateInFuture(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a sale cannot be dated in the future")


class NegativeShipping(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("shipping charged cannot be negative")


class NoteTooLong(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__(f"a note has at most {NOTE_MAX_LENGTH} characters")


class PaymentRequired(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a sale needs a payment method, or to be left owing")


class OwingWithoutCustomer(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("a sale left owing needs a customer")


class UnknownVariety(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("the variety does not exist")


class UnknownCustomer(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("the customer does not exist")


class CustomerAlreadyAssigned(SaleRuleBroken):
    def __init__(self) -> None:
        super().__init__("the sale already has a customer")


class PaymentMethod(StrEnum):
    CASH = "cash"
    TRANSFER = "transfer"


@dataclass(frozen=True)
class CustomerFact:
    """What `CustomerFacts.get` answers for a customer who exists in the business."""

    id: int
    vip: bool


@dataclass(frozen=True)
class SaleLine:
    """One variety and its grams within a sale (CONTEXT.md: Sale line), with the price
    per gram it was sold at, the rule that priced it, and the authoritative line total."""

    variety_id: int
    grams: Grams
    pricing_rule: PricingRule
    price_per_gram: int
    line_total: int
    id: int | None = None

    def __post_init__(self) -> None:
        # These never fail from `Sale.record` (`price_line` already enforces them);
        # they guard the persistence adapter, which rebuilds a `SaleLine` straight
        # from a stored row with no pricing pass in between.
        assert self.grams.is_positive, "a sale line always has grams above zero"
        assert self.price_per_gram >= 0, "a sale line's price per gram is never negative"
        assert self.line_total >= 0, "a sale line's total is never negative"


@dataclass(frozen=True)
class OnTheSpotPayment:
    """Money received on the sale's date, paid in full (CONTEXT.md: Payment). Its
    customer always equals its sale's customer, including after `assign_customer`."""

    paid_on: date
    amount: int
    method: PaymentMethod
    customer_id: int | None
    id: int | None = None

    def __post_init__(self) -> None:
        assert self.amount > 0, "an on-the-spot payment is always for a positive amount"


@dataclass(frozen=True)
class LineRequest:
    """One line as asked for recording, together with its already-resolved current
    price quote (`PriceBook.for_variety(...).current`, or `None` with no price that
    day). Reference resolution (does the variety exist) happens before this is built."""

    variety_id: int
    grams: Grams
    quote: PriceQuote | None
    gift: bool = False
    special_price: int | None = None

    # No `__post_init__` here: a non-positive `grams` (and the other pricing rules)
    # must still reach `price_line` via `Sale.record` and come back as the matching
    # `SaleRuleBroken` (422), never as an `AssertionError` raised at construction.


@dataclass
class Sale:
    """The aggregate root (CONTEXT.md: Sale): a date, at most one customer, shipping
    charged, an optional note, one or more lines and an optional on-the-spot payment.
    `total` is always the sum of the stored line totals plus shipping charged — never
    recomputed from price times grams."""

    date: date
    customer_id: int | None
    shipping_charged: int
    note: str | None
    lines: tuple[SaleLine, ...]
    payment: OnTheSpotPayment | None
    recorded_at: datetime
    id: int | None = None

    @property
    def total(self) -> int:
        return sum((line.line_total for line in self.lines), 0) + self.shipping_charged

    def assign_customer(self, customer_id: int) -> None:
        """Only on a sale that has none (CONTEXT.md: Sale without a customer): a
        sale's customer is never replaced, and its payment's customer always follows."""
        if self.customer_id is not None:
            raise CustomerAlreadyAssigned()
        self.customer_id = customer_id
        if self.payment is not None:
            self.payment = replace(self.payment, customer_id=customer_id)

    @classmethod
    def record(
        cls,
        *,
        sale_date: SaleDate,
        today: SaleDate,
        customer_id: int | None,
        customer: CustomerFact | None,
        shipping_charged: int,
        note: str | None,
        lines: Sequence[LineRequest],
        method: PaymentMethod | None,
        left_owing: bool,
        recorded_at: datetime,
    ) -> Sale:
        """Build and validate a whole sale at once (ADR-0003): every reference is
        already resolved by the caller (`customer` is the fact for `customer_id`,
        each line's `quote` is that variety's current price on `sale_date`). Refuses
        whole, never half-built, on the first rule broken."""
        if sale_date > today:
            raise SaleDateInFuture()
        if not lines:
            raise NoLines()
        if shipping_charged < 0:
            raise NegativeShipping()

        trimmed_note = note.strip() if note is not None else None
        if trimmed_note == "":
            trimmed_note = None
        if trimmed_note is not None and len(trimmed_note) > NOTE_MAX_LENGTH:
            raise NoteTooLong()

        vip = customer.vip if customer is not None else False
        priced_lines = tuple(cls._price(request, vip=vip) for request in lines)
        total = sum((line.line_total for line in priced_lines), 0) + shipping_charged

        payment = cls._payment(
            total=total,
            sale_date=sale_date,
            customer_id=customer_id,
            method=method,
            left_owing=left_owing,
        )

        return cls(
            date=sale_date,
            customer_id=customer_id,
            shipping_charged=shipping_charged,
            note=trimmed_note,
            lines=priced_lines,
            payment=payment,
            recorded_at=recorded_at,
        )

    @staticmethod
    def _price(request: LineRequest, *, vip: bool) -> SaleLine:
        priced = price_line(
            gift=request.gift,
            special_price=request.special_price,
            vip=vip,
            quote=request.quote,
            grams=request.grams,
        )
        return SaleLine(
            variety_id=request.variety_id,
            grams=request.grams,
            pricing_rule=priced.rule,
            price_per_gram=priced.price_per_gram,
            line_total=priced.line_total,
        )

    @staticmethod
    def _payment(
        *,
        total: int,
        sale_date: SaleDate,
        customer_id: int | None,
        method: PaymentMethod | None,
        left_owing: bool,
    ) -> OnTheSpotPayment | None:
        if total <= 0:
            return None
        if method is not None:
            return OnTheSpotPayment(
                paid_on=sale_date, amount=total, method=method, customer_id=customer_id
            )
        if left_owing:
            if customer_id is None:
                raise OwingWithoutCustomer()
            return None
        raise PaymentRequired()
