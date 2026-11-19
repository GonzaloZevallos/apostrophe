"""The New sale suggestions (docs/product/sales.md): ids that shorten the choices of a
Sale being recorded on `on`. They never carry a name, a price or an amount."""

from dataclasses import dataclass
from datetime import date

from app.sales.application.ports import NewSaleSuggestions
from app.shared.calendar import trailing_window

SUGGESTIONS_PER_LIST = 8


@dataclass(frozen=True)
class NewSaleSuggestionIds:
    recent_customer_ids: list[int]
    most_sold_product_ids: list[int]
    last_payment_method_id: int | None


def suggest_for_new_sale(port: NewSaleSuggestions, on: date) -> NewSaleSuggestionIds:
    start, end = trailing_window(on)
    last = port.last_paid_method()
    # Pick the Sale first, judge its method after: an archived method is no suggestion,
    # and no older Sale or method stands in for it.
    method_id = None if last is None or last.is_archived else last.payment_method_id
    return NewSaleSuggestionIds(
        recent_customer_ids=port.recent_customer_ids(SUGGESTIONS_PER_LIST),
        most_sold_product_ids=port.most_sold_product_ids(start, end, SUGGESTIONS_PER_LIST),
        last_payment_method_id=method_id,
    )
