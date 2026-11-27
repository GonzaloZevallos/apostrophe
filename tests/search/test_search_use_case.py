"""`search`: a short query calls no port; any other passes the group limit to each."""

from app.search.application.ports import CustomerHit, ProductHit, SaleHit
from app.search.application.search import search
from app.search.domain.query import SearchQuery
from app.shared.money import Money
from app.shared.quantity import Quantity


class RaisingSales:
    def find(self, query: SearchQuery, limit: int) -> list[SaleHit]:
        raise AssertionError("a short query calls no port")


class RaisingCustomers:
    def find(self, query: SearchQuery, limit: int) -> list[CustomerHit]:
        raise AssertionError("a short query calls no port")


class RaisingProducts:
    def find(self, query: SearchQuery, limit: int) -> list[ProductHit]:
        raise AssertionError("a short query calls no port")


class RecordingSales:
    def __init__(self) -> None:
        self.calls: list[tuple[SearchQuery, int]] = []

    def find(self, query: SearchQuery, limit: int) -> list[SaleHit]:
        self.calls.append((query, limit))
        return []


class RecordingCustomers:
    def __init__(self, hits: list[CustomerHit]) -> None:
        self.hits = hits
        self.calls: list[tuple[SearchQuery, int]] = []

    def find(self, query: SearchQuery, limit: int) -> list[CustomerHit]:
        self.calls.append((query, limit))
        return self.hits


class RecordingProducts:
    def __init__(self, hits: list[ProductHit]) -> None:
        self.hits = hits
        self.calls: list[tuple[SearchQuery, int]] = []

    def find(self, query: SearchQuery, limit: int) -> list[ProductHit]:
        self.calls.append((query, limit))
        return self.hits


def test_a_short_query_returns_three_empty_lists_and_calls_no_port() -> None:
    for raw in ("", "a", "#"):
        result = search(SearchQuery.of(raw), RaisingSales(), RaisingCustomers(), RaisingProducts())
        assert (result.sales, result.customers, result.products) == ([], [], [])


def test_a_normal_query_passes_five_to_each_port_and_returns_their_lists() -> None:
    customer = CustomerHit(1, "Ana", Money(500))
    product = ProductHit(2, "Rose", Quantity(1000))
    sales, customers, products = (
        RecordingSales(),
        RecordingCustomers([customer]),
        RecordingProducts([product]),
    )
    query = SearchQuery.of("an")

    result = search(query, sales, customers, products)

    assert sales.calls == [(query, 5)]
    assert customers.calls == [(query, 5)]
    assert products.calls == [(query, 5)]
    assert result.sales == []
    assert result.customers == [customer]
    assert result.products == [product]
