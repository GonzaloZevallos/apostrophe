from collections.abc import Mapping, Sequence
from datetime import date

from sqlalchemy.orm import Session

from app.customer_types.adapters.sql_customer_type_prices import SqlCustomerTypePrices
from app.customer_types.adapters.vip_type import SqlVipType


class SqlVipTypePrices:
    """The `VipTypePrices` port over the business's VIP type and its type-price rows
    (docs/adr/0059). Built for one business; writes flush, the use case commits. With no
    VIP type there is nowhere to store a VIP price and nothing to read."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._vip_type = SqlVipType(session, business_id)
        self._prices = SqlCustomerTypePrices(session, business_id)

    def vip_type_id(self) -> int | None:
        return self._vip_type.id()

    def record(self, product_id: int, entry_id: int, effective_on: date, price: int) -> None:
        type_id = self._vip_type.id()
        assert type_id is not None, "a VIP price is recorded only where the business has the type"
        self._prices.add(type_id, product_id, effective_on, price, entry_id)

    def prices_of(self, entry_ids: Sequence[int]) -> Mapping[int, int]:
        type_id = self._vip_type.id()
        if type_id is None:
            return {}
        return self._prices.prices_of_type(type_id, entry_ids)

    def remove_for_entry(self, entry_id: int) -> None:
        self._prices.remove_for_entry(entry_id)

    def remove_for_product(self, product_id: int) -> None:
        self._prices.remove_for_product(product_id)
