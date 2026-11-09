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
from sqlalchemy.orm import InstrumentedAttribute, Session
from sqlalchemy.sql.elements import ColumnElement

from app.accounts.adapters.tables import BusinessRow
from app.customer_types.adapters.vip_type import SqlVipType
from app.customers.adapters.tables import CustomerRow
from app.db import flush_or_refuse, money_scale_factor, money_stored_value, scaled
from app.payments.adapters.tables import PaymentRow
from app.products.adapters.tables import ProductRow
from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.sales.application.ports import SaleView, SaleViewCustomer, SaleViewLine
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import (
    CustomerAlreadyAssigned,
    OnTheSpotPayment,
    PaymentMethod,
    Sale,
    SaleLine,
)
from app.shared.money import Money
from app.shared.quantity import Quantity


class SqlSales:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, sale: Sale) -> Sale:
        # The only place a Sale number is given (docs/adr/0073): one UPDATE ... RETURNING
        # on the business's counter, before anything else is written, inside the use
        # case's single commit. A save that fails rolls the increment back with it.
        number = self._session.execute(
            update(BusinessRow)
            .where(BusinessRow.id == self._business_id)
            .values(last_sale_number=BusinessRow.last_sale_number + 1)
            .returning(BusinessRow.last_sale_number)
        ).scalar_one()
        row = SaleRow(
            business_id=self._business_id,
            number=number,
            sale_date=sale.date,
            customer_id=sale.customer_id,
            shipping_charged=self._stored(sale.shipping_charged),
            note=sale.note,
            recorded_at=sale.recorded_at,
        )
        self._session.add(row)
        self._session.flush()

        for position, line in enumerate(sale.lines):
            self._session.add(self._line_row(row.id, line, position))

        if sale.payment is not None:
            self._session.add(self._payment_row(row.id, sale.payment, sale.recorded_at))

        flush_or_refuse(self._session)
        stored = self._assemble(row.id)
        assert stored is not None, "the sale just added still exists"
        return stored

    def get(self, sale_id: int) -> Sale | None:
        return self._assemble(sale_id)

    def list(self, date_from: date | None, date_to: date | None) -> list[Sale]:
        statement = select(SaleRow.id).where(SaleRow.business_id == self._business_id)
        if date_from is not None:
            statement = statement.where(SaleRow.sale_date >= date_from)
        if date_to is not None:
            statement = statement.where(SaleRow.sale_date <= date_to)
        statement = statement.order_by(SaleRow.sale_date.desc(), SaleRow.id.desc())
        return [
            sale
            for sale_id in self._session.scalars(statement).all()
            if (sale := self._assemble(sale_id)) is not None
        ]

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

    def get_view(self, sale_id: int) -> SaleView | None:
        views = self._views(sale_ids=[sale_id])
        return views[0] if views else None

    def list_views(self, date_from: date | None, date_to: date | None) -> Sequence[SaleView]:
        return self._views(date_from=date_from, date_to=date_to)

    def _views(
        self,
        *,
        sale_ids: Sequence[int] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Sequence[SaleView]:
        """`SaleViews` (docs/adr/0011): two statements whatever the number of sales.
        The first joins the sale to its customer and its payment, both filtered on
        this business in their `ON` clause as well as the sale's own `WHERE`; the
        second joins every listed sale's lines to their variety, the same way."""
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            select(
                SaleRow,
                scaled(SaleRow.shipping_charged, factor),
                CustomerRow.id,
                CustomerRow.name,
                CustomerRow.customer_type_id,
                PaymentRow.id,
                PaymentRow.paid_on,
                scaled(PaymentRow.amount, factor),
                PaymentRow.method,
                PaymentRow.customer_id,
            )
            .outerjoin(
                CustomerRow,
                (CustomerRow.id == SaleRow.customer_id)
                & (CustomerRow.business_id == self._business_id),
            )
            .outerjoin(
                PaymentRow,
                (PaymentRow.sale_id == SaleRow.id) & (PaymentRow.business_id == self._business_id),
            )
            .where(SaleRow.business_id == self._business_id)
        )
        if sale_ids is not None:
            statement = statement.where(SaleRow.id.in_(sale_ids))
        statement = statement.where(*_dated_conditions(SaleRow.sale_date, date_from, date_to))
        statement = statement.order_by(SaleRow.sale_date.desc(), SaleRow.id.desc())

        rows = self._session.execute(statement).all()
        vip_type_id = SqlVipType(self._session, self._business_id).id()
        ids = [row[0].id for row in rows]
        lines_by_sale = self._line_views_by_sale(ids)

        views = []
        for row in rows:
            sale_row, shipping = row[0], _units(row[1])
            customer_id, customer_name, customer_type_id = row[2], row[3], row[4]
            payment_id, paid_on, amount, method, payment_customer_id = row[5:10]
            customer = (
                None
                if customer_id is None
                else SaleViewCustomer(
                    id=customer_id,
                    name=customer_name,
                    vip=customer_type_id is not None and customer_type_id == vip_type_id,
                )
            )
            payment = (
                None
                if payment_id is None
                else OnTheSpotPayment(
                    paid_on=paid_on,
                    amount=_units(amount),
                    method=PaymentMethod(method),
                    customer_id=payment_customer_id,
                    id=payment_id,
                )
            )
            lines = lines_by_sale.get(sale_row.id, ())
            sale = Sale(
                date=sale_row.sale_date,
                customer_id=sale_row.customer_id,
                shipping_charged=shipping,
                note=sale_row.note,
                lines=tuple(view_line.line for view_line in lines),
                payment=payment,
                recorded_at=sale_row.recorded_at,
                id=sale_row.id,
                number=sale_row.number,
            )
            views.append(SaleView(sale=sale, customer=customer, lines=lines))
        return views

    def _line_views_by_sale(self, sale_ids: Sequence[int]) -> dict[int, tuple[SaleViewLine, ...]]:
        if not sale_ids:
            return {}
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            select(
                SaleLineRow,
                scaled(SaleLineRow.price_per_gram, factor),
                scaled(SaleLineRow.line_total, factor),
                ProductRow.name,
            )
            .join(
                ProductRow,
                (ProductRow.id == SaleLineRow.variety_id)
                & (ProductRow.business_id == self._business_id),
            )
            .where(
                SaleLineRow.business_id == self._business_id,
                SaleLineRow.sale_id.in_(sale_ids),
            )
            .order_by(SaleLineRow.sale_id, SaleLineRow.position)
        )
        grouped: dict[int, list[SaleViewLine]] = {}
        for line_row, price_per_gram, line_total, variety_name in self._session.execute(
            statement
        ).all():
            grouped.setdefault(line_row.sale_id, []).append(
                SaleViewLine(
                    line=_sale_line(line_row, _units(price_per_gram), _units(line_total)),
                    variety_name=variety_name,
                )
            )
        return {sale_id: tuple(lines) for sale_id, lines in grouped.items()}

    def _stored(self, units: int) -> int:
        """A domain amount, whole units, as the integer this business's column holds."""
        return money_stored_value(self._session, self._business_id, Money.of_units(units))

    def _line_rows(self, sale_id: int) -> Sequence[SaleLine]:
        # A plain `list[...]` return annotation would, under `from __future__ import
        # annotations`, resolve `list` to `SqlSales.list` instead of the builtin,
        # since this class also has a method named `list`; `Sequence` sidesteps it.
        factor = money_scale_factor(self._session, self._business_id)
        statement = (
            select(
                SaleLineRow,
                scaled(SaleLineRow.price_per_gram, factor),
                scaled(SaleLineRow.line_total, factor),
            )
            .where(SaleLineRow.sale_id == sale_id, SaleLineRow.business_id == self._business_id)
            .order_by(SaleLineRow.position)
        )
        return [
            _sale_line(row, _units(price_per_gram), _units(line_total))
            for row, price_per_gram, line_total in self._session.execute(statement).all()
        ]

    def _payment_row(
        self, sale_id: int, payment: OnTheSpotPayment, recorded_at: datetime
    ) -> PaymentRow:
        return PaymentRow(
            business_id=self._business_id,
            paid_on=payment.paid_on,
            amount=self._stored(payment.amount),
            method=payment.method.value,
            customer_id=payment.customer_id,
            sale_id=sale_id,
            recorded_at=recorded_at,
        )

    def _find_payment(self, sale_id: int) -> OnTheSpotPayment | None:
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(PaymentRow, scaled(PaymentRow.amount, factor)).where(
            PaymentRow.sale_id == sale_id, PaymentRow.business_id == self._business_id
        )
        found = self._session.execute(statement).first()
        return None if found is None else _payment(found[0], _units(found[1]))

    def _line_row(self, sale_id: int, line: SaleLine, position: int) -> SaleLineRow:
        return SaleLineRow(
            business_id=self._business_id,
            sale_id=sale_id,
            variety_id=line.variety_id,
            grams_hundredths=line.quantity.hundredths,
            pricing_rule=line.pricing_rule.value,
            price_per_gram=self._stored(line.price_per_gram),
            line_total=self._stored(line.line_total),
            position=position,
        )

    def _assemble(self, sale_id: int) -> Sale | None:
        factor = money_scale_factor(self._session, self._business_id)
        found = self._session.execute(
            select(SaleRow, scaled(SaleRow.shipping_charged, factor)).where(
                SaleRow.id == sale_id, SaleRow.business_id == self._business_id
            )
        ).first()
        if found is None:
            return None
        row, shipping = found
        return Sale(
            date=row.sale_date,
            customer_id=row.customer_id,
            shipping_charged=_units(shipping),
            note=row.note,
            lines=tuple(self._line_rows(row.id)),
            payment=self._find_payment(row.id),
            recorded_at=row.recorded_at,
            id=row.id,
            number=row.number,
        )


def _dated_conditions(
    column: InstrumentedAttribute[date], date_from: date | None, date_to: date | None
) -> tuple[ColumnElement[bool], ...]:
    """The inclusive date range `_views` and `between` both filter on (plan:
    "Extract the date predicate into one private helper shared with `_views`"), as
    conditions rather than a rebuilt statement — `Select`'s row-shape generic would
    otherwise collapse under a function boundary. `SqlSales.list` keeps its own copy
    untouched (plan: "Do not touch `SqlSales.list`")."""
    conditions: list[ColumnElement[bool]] = []
    if date_from is not None:
        conditions.append(column >= date_from)
    if date_to is not None:
        conditions.append(column <= date_to)
    return tuple(conditions)


def _units(hundredths: int) -> int:
    """A read amount as whole units; raises `MoneyNotRepresentable` when it has cents."""
    return Money(hundredths).whole_units()


def _sale_line(row: SaleLineRow, price_per_gram: int, line_total: int) -> SaleLine:
    return SaleLine(
        variety_id=row.variety_id,
        quantity=Quantity(row.grams_hundredths),
        pricing_rule=PricingRule(row.pricing_rule),
        price_per_gram=price_per_gram,
        line_total=line_total,
        id=row.id,
    )


def _payment(row: PaymentRow, amount: int) -> OnTheSpotPayment:
    return OnTheSpotPayment(
        paid_on=row.paid_on,
        amount=amount,
        method=PaymentMethod(row.method),
        customer_id=row.customer_id,
        id=row.id,
    )
