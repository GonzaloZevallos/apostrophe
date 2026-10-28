"""Record a sale (ADR-0003): every reference is resolved and the whole aggregate is
built and validated — payment included — before the first and only repository call,
`Sales.add`. The use case commits once, at its end, through `Transaction`."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime

from app.sales.application.ports import (
    CustomerFacts,
    PriceBook,
    PricingSettingsReader,
    Sales,
)
from app.sales.domain.sale import LineRequest, PaymentMethod, Sale, UnknownCustomer, UnknownVariety
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class LineInput:
    """One line as the request gave it, grams already turned into `Grams` by
    `Grams.of` at the HTTP edge; nothing here builds a `Grams` any other way."""

    variety_id: int
    quantity: Quantity
    gift: bool = False
    special_price: int | None = None


def record_sale(
    sales: Sales,
    price_book: PriceBook,
    customer_facts: CustomerFacts,
    pricing_settings: PricingSettingsReader,
    transaction: Transaction,
    *,
    sale_date: date,
    today: date,
    customer_id: int | None,
    shipping_charged: int,
    note: str | None,
    lines: Sequence[LineInput],
    method: PaymentMethod | None,
    left_owing: bool,
    recorded_at: datetime,
) -> Sale:
    customer = None
    if customer_id is not None:
        customer = customer_facts.get(customer_id)
        if customer is None:
            raise UnknownCustomer()

    settings = pricing_settings.current()
    requests = [_resolve_line(price_book, sale_date, line) for line in lines]

    sale = Sale.record(
        sale_date=sale_date,
        today=today,
        customer_id=customer_id,
        customer=customer,
        settings=settings,
        shipping_charged=shipping_charged,
        note=note,
        lines=requests,
        method=method,
        left_owing=left_owing,
        recorded_at=recorded_at,
    )
    try:
        stored = sales.add(sale)
    except ReferenceRefused:
        # A variety deleted since it was priced: undo, then ask again. Gone is the
        # sale's own refusal; any other cause is re-raised as it came.
        transaction.rollback()
        if any(price_book.for_variety(r.variety_id, sale_date) is None for r in requests):
            raise UnknownVariety from None
        raise
    transaction.commit()
    return stored


def _resolve_line(price_book: PriceBook, sale_date: date, line: LineInput) -> LineRequest:
    pricing = price_book.for_variety(line.variety_id, sale_date)
    if pricing is None:
        raise UnknownVariety()
    return LineRequest(
        variety_id=line.variety_id,
        quantity=line.quantity,
        quote=pricing.current,
        gift=line.gift,
        special_price=line.special_price,
    )
