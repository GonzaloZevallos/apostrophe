"""`suggest_for_new_sale` against a fake `NewSaleSuggestions` port: the limit, the window
and the archived-fact rule live in the use case, never in the adapter."""

from dataclasses import dataclass, field
from datetime import date

from app.sales.application.ports import LastPaidMethod
from app.sales.application.suggest_for_new_sale import SUGGESTIONS_PER_LIST, suggest_for_new_sale
from app.shared.calendar import trailing_window

ON = date(2026, 11, 19)


@dataclass
class FakePort:
    last: LastPaidMethod | None = None
    customers: list[int] = field(default_factory=lambda: [3, 1])
    products: list[int] = field(default_factory=lambda: [9, 4])
    customer_limits: list[int] = field(default_factory=list)
    product_calls: list[tuple[date, date, int]] = field(default_factory=list)
    last_calls: int = 0

    def recent_customer_ids(self, limit: int) -> list[int]:
        self.customer_limits.append(limit)
        return self.customers

    def most_sold_product_ids(self, start: date, end: date, limit: int) -> list[int]:
        self.product_calls.append((start, end, limit))
        return self.products

    def last_paid_method(self) -> LastPaidMethod | None:
        self.last_calls += 1
        return self.last


def test_a_live_method_is_answered_by_its_id() -> None:
    port = FakePort(last=LastPaidMethod(payment_method_id=7, is_archived=False))

    answer = suggest_for_new_sale(port, ON)

    assert answer.last_payment_method_id == 7
    assert answer.recent_customer_ids == [3, 1]
    assert answer.most_sold_product_ids == [9, 4]


def test_an_archived_method_is_null_and_the_port_is_not_asked_again() -> None:
    port = FakePort(last=LastPaidMethod(payment_method_id=7, is_archived=True))

    answer = suggest_for_new_sale(port, ON)

    assert answer.last_payment_method_id is None
    assert port.last_calls == 1


def test_no_paid_sale_is_null() -> None:
    port = FakePort(last=None)

    assert suggest_for_new_sale(port, ON).last_payment_method_id is None
    assert port.last_calls == 1


def test_each_list_is_asked_for_eight_over_the_trailing_window() -> None:
    port = FakePort()

    suggest_for_new_sale(port, ON)

    start, end = trailing_window(ON)
    assert SUGGESTIONS_PER_LIST == 8
    assert port.customer_limits == [8]
    assert port.product_calls == [(start, end, 8)]
