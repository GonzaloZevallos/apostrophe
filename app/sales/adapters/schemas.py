"""The HTTP shapes of a sale. Bare: no pydantic length or value constraint, so every
rule stays the domain's and its message is a fixed string (ADR-0005). Grams are typed
`Decimal` here and become `Grams` only through `Grams.of`, at the router."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.sales.application.ports import SaleView, SaleViewCustomer, SaleViewLine
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
    # Optional (docs/adr/0009): omitted means no method and not left owing, so a $0
    # sale can be sent with no payment at all and `sale.payment_required` is
    # reachable. `"owing"` keeps its own meaning.
    payment: PaymentIn | None = None
    lines: list[LineIn]


class AssignCustomerIn(BaseModel):
    customer_id: int


class SaleCustomerOut(BaseModel):
    id: int
    name: str
    vip: bool

    @classmethod
    def of(cls, customer: SaleViewCustomer) -> "SaleCustomerOut":
        return cls(id=customer.id, name=customer.name, vip=customer.vip)


class SaleLineOut(BaseModel):
    variety_id: int
    variety_name: str
    grams: GramsOut
    pricing_rule: PricingRule
    price_per_gram: int
    line_total: int

    @classmethod
    def of(cls, view_line: SaleViewLine) -> "SaleLineOut":
        line = view_line.line
        return cls(
            variety_id=line.variety_id,
            variety_name=view_line.variety_name,
            grams=line.grams.as_decimal(),
            pricing_rule=line.pricing_rule,
            price_per_gram=line.price_per_gram,
            line_total=line.line_total,
        )


class SaleOut(BaseModel):
    id: int
    date: SaleDate
    customer: SaleCustomerOut | None
    shipping_charged: int
    note: str | None
    payment: PaymentOut
    total: int
    lines: list[SaleLineOut]

    @classmethod
    def of(cls, view: SaleView) -> "SaleOut":
        sale = view.sale
        assert sale.id is not None, "only stored sales go out"
        return cls(
            id=sale.id,
            date=sale.date,
            customer=None if view.customer is None else SaleCustomerOut.of(view.customer),
            shipping_charged=sale.shipping_charged,
            note=sale.note,
            payment=_payment_out(sale),
            total=sale.total,
            lines=[SaleLineOut.of(line) for line in view.lines],
        )


def _payment_out(sale: Sale) -> PaymentOut:
    if sale.payment is not None:
        return sale.payment.method
    return "none" if sale.total <= 0 else "owing"
