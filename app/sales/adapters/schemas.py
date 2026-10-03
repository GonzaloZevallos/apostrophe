"""The HTTP shapes of a sale. Bare: no pydantic length or value constraint, so every
rule stays the domain's and its message is a fixed string (ADR-0005). Grams are typed
`Decimal` here and become `Grams` only through `Grams.of`, at the router."""

from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.sales.application.ports import LineCost
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import PaymentMethod, Sale
from app.varieties.adapters.schemas import GramsOut

# "Owing" and "none" are adapter-only words for a sale with no `OnTheSpotPayment`;
# `PaymentMethod` is still the only declaration of the methods themselves (cash,
# transfer), never copied here as a string literal.
PaymentIn = PaymentMethod | Literal["owing"]
PaymentOut = PaymentMethod | Literal["owing", "none"]

# `SaleIn.date` and `SaleOut.date` name the sale's own date; a bare `date` inside
# either class body would otherwise resolve to the field, not the type (same trap as
# `app.sales.domain.sale.SaleDate`).
SaleDate = date


class LineIn(BaseModel):
    variety_id: int
    grams: Decimal
    gift: bool = False
    special_price: int | None = None


class SaleIn(BaseModel):
    date: SaleDate | None = None
    customer_id: int | None = None
    shipping_charged: int = 0
    note: str | None = None
    payment: PaymentIn
    lines: list[LineIn]


class AssignCustomerIn(BaseModel):
    customer_id: int


class SaleLineOut(BaseModel):
    variety_id: int
    grams: GramsOut
    pricing_rule: PricingRule
    price_per_gram: int
    line_total: int


class SaleOut(BaseModel):
    id: int
    date: SaleDate
    customer_id: int | None
    shipping_charged: int
    note: str | None
    payment: PaymentOut
    total: int
    lines: list[SaleLineOut]

    @classmethod
    def of(cls, sale: Sale) -> "SaleOut":
        assert sale.id is not None, "only stored sales go out"
        return cls(
            id=sale.id,
            date=sale.date,
            customer_id=sale.customer_id,
            shipping_charged=sale.shipping_charged,
            note=sale.note,
            payment=_payment_out(sale),
            total=sale.total,
            lines=[
                SaleLineOut(
                    variety_id=line.variety_id,
                    grams=line.grams.as_decimal(),
                    pricing_rule=line.pricing_rule,
                    price_per_gram=line.price_per_gram,
                    line_total=line.line_total,
                )
                for line in sale.lines
            ],
        )


def _payment_out(sale: Sale) -> PaymentOut:
    if sale.payment is not None:
        return sale.payment.method
    return "none" if sale.total <= 0 else "owing"


class LineCostOut(BaseModel):
    """A sale line's cost of goods (ADR-0009): `costed` is `None` exactly when none of
    the line's grams is costed yet; `pending_grams` is the part with no lot behind it,
    never folded into `costed` as a $0 cost."""

    costed: int | None
    pending_grams: GramsOut

    @classmethod
    def of(cls, cost: LineCost) -> "LineCostOut":
        return cls(costed=cost.costed, pending_grams=cost.pending_grams.as_decimal())


class SaleLineDetailOut(BaseModel):
    variety_id: int
    grams: GramsOut
    pricing_rule: PricingRule
    price_per_gram: int
    line_total: int
    cost: LineCostOut


class SaleDetailOut(BaseModel):
    """`GET /sales/{id}`'s own shape, never the list's: each line's cost of goods is
    allocated fresh on this one read (ADR-0009), so `SaleOut` — used by the list and by
    `PUT .../customer` — never allocates and stays unchanged."""

    id: int
    date: SaleDate
    customer_id: int | None
    shipping_charged: int
    note: str | None
    payment: PaymentOut
    total: int
    lines: list[SaleLineDetailOut]

    @classmethod
    def of(cls, sale: Sale, costs: Sequence[LineCost]) -> "SaleDetailOut":
        assert sale.id is not None, "only stored sales go out"
        assert len(costs) == len(sale.lines), "one LineCost per line, in the same order"
        return cls(
            id=sale.id,
            date=sale.date,
            customer_id=sale.customer_id,
            shipping_charged=sale.shipping_charged,
            note=sale.note,
            payment=_payment_out(sale),
            total=sale.total,
            lines=[
                SaleLineDetailOut(
                    variety_id=line.variety_id,
                    grams=line.grams.as_decimal(),
                    pricing_rule=line.pricing_rule,
                    price_per_gram=line.price_per_gram,
                    line_total=line.line_total,
                    cost=LineCostOut.of(cost),
                )
                for line, cost in zip(sale.lines, costs, strict=True)
            ],
        )


class ReturnedGramsOut(BaseModel):
    variety_id: int
    grams: GramsOut


class DeleteSaleOut(BaseModel):
    """`DELETE /sales/{id}`'s own response: the grams returned per variety, summed from
    the sale's own lines and sorted by `variety_id`."""

    returned: list[ReturnedGramsOut]
