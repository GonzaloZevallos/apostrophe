"""A `VipTypePrices` for a use case driven without a database."""

from collections.abc import Mapping, Sequence
from datetime import date


class NoVipType:
    """A business with no VIP type: nowhere to keep a VIP price, nothing to read."""

    def vip_type_id(self) -> int | None:
        return None

    def record(self, product_id: int, entry_id: int, effective_on: date, price: int) -> None:
        raise AssertionError("a business with no VIP type records no VIP price")

    def prices_of(self, entry_ids: Sequence[int]) -> Mapping[int, int]:
        return {}

    def remove_for_entry(self, entry_id: int) -> None:
        pass

    def remove_for_product(self, product_id: int) -> None:
        pass
