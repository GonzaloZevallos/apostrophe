"""The HTTP shapes of a sale. Bare: no pydantic length or value constraint, so every
rule stays the domain's and its message is a fixed string (ADR-0005). Quantity are typed
`Decimal` here and become `Quantity` only through `Quantity.of`, at the router."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.money_schema import MoneyAmount, MoneyOut
from app.products.adapters.schemas import QuantityOut
from app.sales.application.ports import LineCost, SaleView, SaleViewCustomer, SaleViewLine
from app.sales.application.view_sales import SaleDetail
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import Sale
from app.sales.domain.sale_bill import BillPayment, BillRule, BillState, SaleBill, SaleBillLine


class PaymentWithMethodIn(BaseModel):
    kind: Literal["method"]
    payment_method_id: int


class PaymentOwingIn(BaseModel):
    kind: Literal["owing"]


# The owing choice is the kind tag of a union, never a string a method's name could equal
# (docs/adr/0082). `null` stays a $0 sale with no payment.
PaymentIn = Annotated[PaymentWithMethodIn | PaymentOwingIn, Field(discriminator="kind")]


class PaymentMethodOut(BaseModel):
    kind: Literal["method"] = "method"
    payment_method_id: int
    name: str
    icon: str


class PaymentOwingOut(BaseModel):
    kind: Literal["owing"] = "owing"


class PaymentNoneOut(BaseModel):
    kind: Literal["none"] = "none"


PaymentOut = Annotated[
    PaymentMethodOut | PaymentOwingOut | PaymentNoneOut, Field(discriminator="kind")
]

# `SaleIn.date` and `SaleOut.date` name the sale's own date; a bare `date` inside
# either class body would otherwise resolve to the field, not the type (same trap as
# `app.sales.domain.sale.SaleDate`).
SaleDate = date


class LineIn(BaseModel):
    product_id: int
    quantity: Decimal
    gift: bool = False
    special_price: MoneyAmount | None = None


class SaleIn(BaseModel):
    date: SaleDate | None = None
    customer_id: int | None = None
    shipping_charged: MoneyAmount = Decimal(0)
    note: str | None = None
    # Optional (docs/adr/0011): omitted means no method and not left owing, so a $0
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
    product_id: int
    product_name: str
    quantity: QuantityOut
    pricing_rule: PricingRule
    price_per_gram: MoneyOut
    line_total: MoneyOut

    @classmethod
    def of(cls, view_line: SaleViewLine) -> "SaleLineOut":
        line = view_line.line
        return cls(
            product_id=line.variety_id,
            product_name=view_line.variety_name,
            quantity=line.quantity.as_decimal(),
            pricing_rule=line.pricing_rule,
            price_per_gram=Decimal(line.price_per_gram),
            line_total=Decimal(line.line_total),
        )


class SaleOut(BaseModel):
    id: int
    number: int
    date: SaleDate
    customer: SaleCustomerOut | None
    shipping_charged: MoneyOut
    note: str | None
    payment: PaymentOut
    total: MoneyOut
    lines: list[SaleLineOut]
    still_owing: bool

    @classmethod
    def of(cls, view: SaleView, still_owing: bool = False) -> "SaleOut":
        sale = view.sale
        assert sale.id is not None, "only stored sales go out"
        return cls(
            id=sale.id,
            number=view.number,
            date=sale.date,
            customer=None if view.customer is None else SaleCustomerOut.of(view.customer),
            shipping_charged=Decimal(sale.shipping_charged),
            note=sale.note,
            payment=_payment_out(sale),
            total=Decimal(sale.total),
            lines=[SaleLineOut.of(line) for line in view.lines],
            still_owing=still_owing,
        )


def _money_or_none(units: int | None) -> Decimal | None:
    return None if units is None else Decimal(units)


def _payment_out(sale: Sale) -> PaymentMethodOut | PaymentOwingOut | PaymentNoneOut:
    if sale.payment is not None:
        label = sale.payment.method
        assert label is not None, "a payment read back carries its method"
        return PaymentMethodOut(payment_method_id=label.id, name=label.name, icon=label.icon)
    return PaymentNoneOut() if sale.total <= 0 else PaymentOwingOut()


class LineCostOut(BaseModel):
    """A sale line's cost of goods (ADR-0009): `costed` is `None` exactly when none of
    the line's grams is costed yet; `pending_quantity` is the part with no lot behind it,
    never folded into `costed` as a $0 cost."""

    costed: MoneyOut | None
    pending_quantity: QuantityOut

    @classmethod
    def of(cls, cost: LineCost) -> "LineCostOut":
        return cls(
            costed=_money_or_none(cost.costed), pending_quantity=cost.pending_quantity.as_decimal()
        )


class SaleLineDetailOut(BaseModel):
    """`SaleLineOut`'s fields plus the line's cost of goods (ADR-0009)."""

    product_id: int
    product_name: str
    quantity: QuantityOut
    pricing_rule: PricingRule
    price_per_gram: MoneyOut
    line_total: MoneyOut
    cost: LineCostOut

    @classmethod
    def of(cls, view_line: SaleViewLine, cost: LineCost) -> "SaleLineDetailOut":
        line = view_line.line
        return cls(
            product_id=line.variety_id,
            product_name=view_line.variety_name,
            quantity=line.quantity.as_decimal(),
            pricing_rule=line.pricing_rule,
            price_per_gram=Decimal(line.price_per_gram),
            line_total=Decimal(line.line_total),
            cost=LineCostOut.of(cost),
        )


class BillPaymentOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: BillState
    still_owed: MoneyOut | None
    method_name: str | None

    @classmethod
    def of(cls, payment: BillPayment) -> "BillPaymentOut":
        return cls(
            state=payment.state,
            still_owed=_money_or_none(payment.still_owed),
            method_name=payment.method_name,
        )


class SaleBillLineOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: str
    quantity: QuantityOut
    amount: MoneyOut
    rule: BillRule | None
    unit_price: MoneyOut | None

    @classmethod
    def of(cls, line: SaleBillLine) -> "SaleBillLineOut":
        return cls(
            product=line.product,
            quantity=line.quantity.as_decimal(),
            amount=Decimal(line.amount),
            rule=line.rule,
            unit_price=_money_or_none(line.unit_price),
        )


class SaleBillOut(BaseModel):
    """The facts a seller may share with a sale's customer (CONTEXT.md: Sale bill),
    closed: no field for the note, the customer, any id, the VIP flag, cost or margin. The
    Sale number is not an id: it is the seller's own count, the same one the detail shows."""

    model_config = ConfigDict(extra="forbid")

    business_name: str
    number: int
    date: SaleDate
    shipping_charged: MoneyOut
    total: MoneyOut
    lines: list[SaleBillLineOut]
    payment: BillPaymentOut
    balance: MoneyOut | None

    @classmethod
    def of(cls, bill: SaleBill) -> "SaleBillOut":
        return cls(
            business_name=bill.business_name,
            number=bill.number,
            date=bill.date,
            shipping_charged=Decimal(bill.shipping_charged),
            total=Decimal(bill.total),
            lines=[SaleBillLineOut.of(line) for line in bill.lines],
            payment=BillPaymentOut.of(bill.payment),
            balance=_money_or_none(bill.balance),
        )


class SaleDetailOut(BaseModel):
    """`GET /sales/{id}`'s own shape, never the list's: the same labelled read shape as
    `SaleOut` (docs/adr/0011), plus each line's cost of goods, allocated fresh on this
    one read (ADR-0009), so `SaleOut` — used by the list and by every write — never
    allocates."""

    id: int
    number: int
    date: SaleDate
    customer: SaleCustomerOut | None
    shipping_charged: MoneyOut
    note: str | None
    payment: PaymentOut
    total: MoneyOut
    lines: list[SaleLineDetailOut]
    total_quantity: QuantityOut
    still_owing: bool
    bill: SaleBillOut | None

    @classmethod
    def of(cls, detail: SaleDetail) -> "SaleDetailOut":
        view, costs = detail.view, detail.costs
        sale = view.sale
        assert sale.id is not None, "only stored sales go out"
        assert len(costs) == len(view.lines), "one LineCost per line, in the same order"
        return cls(
            id=sale.id,
            number=view.number,
            date=sale.date,
            customer=None if view.customer is None else SaleCustomerOut.of(view.customer),
            shipping_charged=Decimal(sale.shipping_charged),
            note=sale.note,
            payment=_payment_out(sale),
            total=Decimal(sale.total),
            lines=[
                SaleLineDetailOut.of(line, cost)
                for line, cost in zip(view.lines, costs, strict=True)
            ],
            total_quantity=sale.total_quantity.as_decimal(),
            still_owing=detail.still_owing,
            bill=None if detail.bill is None else SaleBillOut.of(detail.bill),
        )


class ReturnedQuantityOut(BaseModel):
    product_id: int
    quantity: QuantityOut


class DeleteSaleOut(BaseModel):
    """`DELETE /sales/{id}`'s own response: the quantity returned per product, summed from
    the sale's own lines and sorted by `product_id`."""

    returned: list[ReturnedQuantityOut]
