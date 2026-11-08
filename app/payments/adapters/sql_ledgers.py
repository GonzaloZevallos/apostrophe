"""The `Ledgers` port over SQLAlchemy, for one business (docs/adr/0004): every
statement filters on it, so a ledger always stays inside the business it was built
for. Three statements whatever the number of customers asked for, the cost the plan
budgets: line totals grouped by sale, every payment, every sale — assembled into
`Ledger`s in Python.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payments.adapters.tables import PaymentRow
from app.payments.application.ports import NamedLedger
from app.payments.domain.settlement import LaterPaymentEntry, Ledger, OwedSale
from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.shared.payment_method import PaymentMethodLabel


class SqlLedgers:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def for_customer(self, customer_id: int) -> Ledger | None:
        exists = self._session.execute(
            select(CustomerRow.id).where(
                CustomerRow.id == customer_id, CustomerRow.business_id == self._business_id
            )
        ).first()
        if exists is None:
            return None
        return self._ledgers([customer_id]).get(customer_id, Ledger((), ()))

    def for_customers(self, customer_ids: Collection[int]) -> Mapping[int, Ledger]:
        return self._ledgers(customer_ids)

    def all(self) -> Sequence[NamedLedger]:
        names = self._session.execute(
            select(CustomerRow.id, CustomerRow.name).where(
                CustomerRow.business_id == self._business_id
            )
        ).all()
        ledgers = self._ledgers([row.id for row in names])
        return [
            NamedLedger(id=row.id, name=row.name, ledger=ledgers.get(row.id, Ledger((), ())))
            for row in names
        ]

    def _ledgers(self, customer_ids: Collection[int]) -> dict[int, Ledger]:
        ids = list(customer_ids)
        if not ids:
            return {}

        line_totals = dict(
            self._session.execute(
                select(SaleLineRow.sale_id, func.sum(SaleLineRow.line_total))
                .where(SaleLineRow.business_id == self._business_id)
                .group_by(SaleLineRow.sale_id)
            ).all()
        )

        on_the_spot_methods: dict[int, PaymentMethodLabel] = {}
        later_by_customer: dict[int, list[LaterPaymentEntry]] = {}
        # Display reads join the method whether or not it is archived (docs/adr/0076).
        for payment, method_name, method_icon in self._session.execute(
            select(PaymentRow, PaymentMethodRow.name, PaymentMethodRow.icon)
            .join(
                PaymentMethodRow,
                (PaymentMethodRow.id == PaymentRow.payment_method_id)
                & (PaymentMethodRow.business_id == PaymentRow.business_id),
            )
            .where(
                PaymentRow.business_id == self._business_id,
                PaymentRow.customer_id.in_(ids),
            )
        ):
            label = PaymentMethodLabel(
                id=payment.payment_method_id, name=method_name, icon=method_icon
            )
            if payment.sale_id is not None:
                on_the_spot_methods[payment.sale_id] = label
            else:
                assert payment.customer_id is not None, "a later payment always names a customer"
                later_by_customer.setdefault(payment.customer_id, []).append(
                    LaterPaymentEntry(
                        id=payment.id,
                        paid_on=payment.paid_on,
                        recorded_at=payment.recorded_at,
                        amount=payment.amount,
                        method=label,
                    )
                )

        sales_by_customer: dict[int, list[OwedSale]] = {}
        for sale in self._session.scalars(
            select(SaleRow).where(
                SaleRow.business_id == self._business_id,
                SaleRow.customer_id.in_(ids),
            )
        ):
            assert sale.customer_id is not None, "filtered to sales that have one"
            total = sale.shipping_charged + line_totals.get(sale.id, 0)
            sales_by_customer.setdefault(sale.customer_id, []).append(
                OwedSale(
                    id=sale.id,
                    date=sale.sale_date,
                    recorded_at=sale.recorded_at,
                    total=total,
                    on_the_spot_method=on_the_spot_methods.get(sale.id),
                )
            )

        return {
            customer_id: Ledger(
                sales=tuple(sales_by_customer.get(customer_id, ())),
                payments=tuple(later_by_customer.get(customer_id, ())),
            )
            for customer_id in ids
        }
