"""`NewSaleSuggestions` for one business (docs/adr/0004): every statement filters
`business_id` on every table it touches, joined ones included, and a payment joins its
method on the composite `(business_id, payment_method_id)` key. Facts only: nothing here
decides what a suggestion is worth, that is the use case's."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payments.adapters.tables import ON_THE_SPOT, PaymentRow
from app.products.adapters.tables import ProductRow
from app.sales.adapters.tables import SaleLineRow, SaleRow
from app.sales.application.ports import LastPaidMethod
from app.sales.domain.pricing import PricingRule


class SqlNewSaleSuggestions:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def recent_customer_ids(self, limit: int) -> list[int]:
        # One ordered scan of the Sales over `(business_id, sold_on)`: the first row of a
        # Customer is their latest Sale (date, then number), so the scan stops as soon as
        # `limit` distinct Customers are seen. Never MAX(number) apart from the date.
        statement = (
            select(SaleRow.customer_id)
            .where(SaleRow.business_id == self._business_id, SaleRow.customer_id.is_not(None))
            .order_by(SaleRow.sold_on.desc(), SaleRow.number.desc())
        )
        seen: list[int] = []
        result = self._session.execute(statement)
        try:
            for (customer_id,) in result:
                # The statement leaves out Sales without a Customer; this narrows the type.
                if customer_id is not None and customer_id not in seen:
                    seen.append(customer_id)
                    if len(seen) == limit:
                        break
        finally:
            result.close()
        return seen

    def most_sold_product_ids(self, start: date, end: date, limit: int) -> list[int]:
        sold = func.sum(SaleLineRow.grams_hundredths)
        statement = (
            select(ProductRow.id)
            .select_from(SaleLineRow)
            .join(
                SaleRow,
                (SaleRow.id == SaleLineRow.sale_id) & (SaleRow.business_id == self._business_id),
            )
            .join(
                ProductRow,
                (ProductRow.id == SaleLineRow.variety_id)
                & (ProductRow.business_id == self._business_id),
            )
            .where(
                SaleLineRow.business_id == self._business_id,
                SaleRow.sold_on >= start,
                SaleRow.sold_on <= end,
                SaleLineRow.pricing_rule != PricingRule.GIFT.value,
                ProductRow.archived_at.is_(None),
            )
            .group_by(ProductRow.id, ProductRow.name_key)
            .having(sold > 0)
            .order_by(sold.desc(), ProductRow.name_key, ProductRow.id)
            .limit(limit)
        )
        return list(self._session.scalars(statement))

    def last_paid_method(self) -> LastPaidMethod | None:
        statement = (
            select(PaymentRow.payment_method_id, PaymentMethodRow.archived_at)
            .join(
                SaleRow,
                (SaleRow.id == PaymentRow.sale_id) & (SaleRow.business_id == self._business_id),
            )
            .join(
                PaymentMethodRow,
                (PaymentMethodRow.business_id == PaymentRow.business_id)
                & (PaymentMethodRow.id == PaymentRow.payment_method_id)
                & (PaymentMethodRow.business_id == self._business_id),
            )
            .where(PaymentRow.business_id == self._business_id, ON_THE_SPOT)
            .order_by(SaleRow.number.desc())
            .limit(1)
        )
        found = self._session.execute(statement).first()
        if found is None:
            return None
        method_id, archived_at = found
        return LastPaidMethod(payment_method_id=method_id, is_archived=archived_at is not None)
