"""The `Sales` port over SQLAlchemy, for one business (docs/adr/0004, docs/adr/0007).

Every statement filters on that business; a sale of another business is, from here, a
sale that does not exist. `customer_id` on `sale` and `payment` is written only by
`add` and by `assign_customer`'s guarded updates (`WHERE ... customer_id IS NULL`):
`assign_customer` raises `CustomerAlreadyAssigned` when the `sale` update matches no
row, which is the only place this repository raises a domain error. `delete` removes
the lines and the payment explicitly, before the sale itself."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime
from typing import cast

from sqlalchemy import delete as sa_delete
from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.sales.adapters.tables import PaymentRow, SaleLineRow, SaleRow
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import (
    CustomerAlreadyAssigned,
    OnTheSpotPayment,
    PaymentMethod,
    Sale,
    SaleLine,
)
from app.shared.grams import Grams


class SqlSales:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, sale: Sale) -> Sale:
        row = SaleRow(
            business_id=self._business_id,
            sale_date=sale.date,
            customer_id=sale.customer_id,
            shipping_charged=sale.shipping_charged,
            note=sale.note,
            recorded_at=sale.recorded_at,
        )
        self._session.add(row)
        self._session.flush()

        for position, line in enumerate(sale.lines):
            self._session.add(self._line_row(row.id, line, position))

        if sale.payment is not None:
            self._session.add(self._payment_row(row.id, sale.payment, sale.recorded_at))

        self._session.flush()
        return self._assemble(row)

    def get(self, sale_id: int) -> Sale | None:
        row = self._row(sale_id)
        return None if row is None else self._assemble(row)

    def list(self, date_from: date | None, date_to: date | None) -> list[Sale]:
        statement = select(SaleRow).where(SaleRow.business_id == self._business_id)
        if date_from is not None:
            statement = statement.where(SaleRow.sale_date >= date_from)
        if date_to is not None:
            statement = statement.where(SaleRow.sale_date <= date_to)
        statement = statement.order_by(SaleRow.sale_date.desc(), SaleRow.id.desc())
        return [self._assemble(row) for row in self._session.scalars(statement)]

    def assign_customer(self, sale_id: int, customer_id: int) -> None:
        # `Session.execute` answers the generic `Result`; an `UPDATE` always gives
        # back a `CursorResult`, which is where `rowcount` lives.
        result = cast(
            CursorResult[tuple[object, ...]],
            self._session.execute(
                update(SaleRow)
                .where(
                    SaleRow.id == sale_id,
                    SaleRow.business_id == self._business_id,
                    SaleRow.customer_id.is_(None),
                )
                .values(customer_id=customer_id)
            ),
        )
        if result.rowcount == 0:
            raise CustomerAlreadyAssigned()
        self._session.execute(
            update(PaymentRow)
            .where(
                PaymentRow.sale_id == sale_id,
                PaymentRow.business_id == self._business_id,
                PaymentRow.customer_id.is_(None),
            )
            .values(customer_id=customer_id)
        )
        self._session.flush()

    def delete(self, sale_id: int) -> None:
        self._session.execute(
            sa_delete(SaleLineRow).where(
                SaleLineRow.sale_id == sale_id, SaleLineRow.business_id == self._business_id
            )
        )
        self._session.execute(
            sa_delete(PaymentRow).where(
                PaymentRow.sale_id == sale_id, PaymentRow.business_id == self._business_id
            )
        )
        self._session.execute(
            sa_delete(SaleRow).where(
                SaleRow.id == sale_id, SaleRow.business_id == self._business_id
            )
        )
        self._session.flush()

    def _row(self, sale_id: int) -> SaleRow | None:
        statement = select(SaleRow).where(
            SaleRow.id == sale_id, SaleRow.business_id == self._business_id
        )
        return self._session.scalar(statement)

    def _line_rows(self, sale_id: int) -> Sequence[SaleLineRow]:
        # A plain `list[...]` return annotation would, under `from __future__ import
        # annotations`, resolve `list` to `SqlSales.list` instead of the builtin,
        # since this class also has a method named `list`; `Sequence` sidesteps it.
        statement = (
            select(SaleLineRow)
            .where(SaleLineRow.sale_id == sale_id, SaleLineRow.business_id == self._business_id)
            .order_by(SaleLineRow.position)
        )
        return [row for row in self._session.scalars(statement)]

    def _payment_row(
        self, sale_id: int, payment: OnTheSpotPayment, recorded_at: datetime
    ) -> PaymentRow:
        return PaymentRow(
            business_id=self._business_id,
            paid_on=payment.paid_on,
            amount=payment.amount,
            method=payment.method.value,
            customer_id=payment.customer_id,
            sale_id=sale_id,
            recorded_at=recorded_at,
        )

    def _find_payment_row(self, sale_id: int) -> PaymentRow | None:
        statement = select(PaymentRow).where(
            PaymentRow.sale_id == sale_id, PaymentRow.business_id == self._business_id
        )
        return self._session.scalar(statement)

    def _line_row(self, sale_id: int, line: SaleLine, position: int) -> SaleLineRow:
        return SaleLineRow(
            business_id=self._business_id,
            sale_id=sale_id,
            variety_id=line.variety_id,
            grams_hundredths=line.grams.hundredths,
            pricing_rule=line.pricing_rule.value,
            price_per_gram=line.price_per_gram,
            line_total=line.line_total,
            position=position,
        )

    def _assemble(self, row: SaleRow) -> Sale:
        lines = tuple(_sale_line(r) for r in self._line_rows(row.id))
        payment_row = self._find_payment_row(row.id)
        payment = None if payment_row is None else _payment(payment_row)
        return Sale(
            date=row.sale_date,
            customer_id=row.customer_id,
            shipping_charged=row.shipping_charged,
            note=row.note,
            lines=lines,
            payment=payment,
            recorded_at=row.recorded_at,
            id=row.id,
        )


def _sale_line(row: SaleLineRow) -> SaleLine:
    return SaleLine(
        variety_id=row.variety_id,
        grams=Grams(row.grams_hundredths),
        pricing_rule=PricingRule(row.pricing_rule),
        price_per_gram=row.price_per_gram,
        line_total=row.line_total,
        id=row.id,
    )


def _payment(row: PaymentRow) -> OnTheSpotPayment:
    return OnTheSpotPayment(
        paid_on=row.paid_on,
        amount=row.amount,
        method=PaymentMethod(row.method),
        customer_id=row.customer_id,
        id=row.id,
    )
