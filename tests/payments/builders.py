"""Builders shared by the payments tests."""

from __future__ import annotations

from datetime import date, datetime

from app.payments.domain.settlement import OwedSale
from app.shared.payment_method import PaymentMethodLabel

AT = datetime(2026, 9, 1, 10, 0)


def owed_sale(
    id: int,
    date: date,
    total: int,
    *,
    number: int | None = None,
    recorded_at: datetime = AT,
    on_the_spot_method: PaymentMethodLabel | None = None,
    on_the_spot_amount: int | None = None,
) -> OwedSale:
    """An `OwedSale`; its Sale number is its id unless a test says otherwise. A sale given a
    method is paid in full on the spot unless a test lowers `on_the_spot_amount`."""
    if on_the_spot_amount is None:
        on_the_spot_amount = total if on_the_spot_method is not None else 0
    return OwedSale(
        id=id,
        date=date,
        recorded_at=recorded_at,
        total=total,
        number=id if number is None else number,
        on_the_spot_method=on_the_spot_method,
        on_the_spot_amount=on_the_spot_amount,
    )
