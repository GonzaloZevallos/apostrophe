"""The Customers, Products and Sales groups of grouped search, over the stores that own
the rows (GH-1059).

Cost: every request is O(customers + products) of the business, folded in Python,
because `search_order_key` cannot be an SQL `ORDER BY`. Balances and Stock are read only
for the ids already cut to the limit.

Search adds no matching rule of its own: `query.q` goes unchanged to `Customer.matches`,
`name_matches` and `search_order_key`. So a 2-character query with one digit ('#5', '1x')
matches phones by that digit through `Customer.matches`; that is the same-query rule of
the PRD, not a phone rule of search.
"""

from __future__ import annotations

from datetime import date

from app.customers.adapters.schemas import NO_BALANCE
from app.customers.application.ports import Balances, Customers
from app.products.application.ports import Products
from app.search.application.ports import CustomerHit, ProductHit, SaleHit
from app.search.domain.query import SearchQuery
from app.shared.names import name_matches, search_order_key
from app.stock.application.ports import Draws, StockEntries, WithdrawalDraws
from app.stock.application.read_stock import read_varieties_stock


class SqlCustomerSearch:
    def __init__(self, customers: Customers, balances: Balances) -> None:
        self._customers = customers
        self._balances = balances

    def find(self, query: SearchQuery, limit: int) -> list[CustomerHit]:
        found = [c for c in self._customers.all() if c.id is not None and c.matches(query.q)]
        found.sort(key=lambda c: search_order_key(c.name.value, query.q, c.id or 0))
        cut = found[:limit]
        # Only now, for the ids that are returned: the balance is signed, so a Credit
        # stays below 0, and a customer with no ledger reads as the customers router does.
        by_id = self._balances.for_customers([c.id for c in cut if c.id is not None])
        return [
            CustomerHit(c.id, c.name.value, by_id.get(c.id, NO_BALANCE).balance)
            for c in cut
            if c.id is not None
        ]


class SqlProductSearch:
    def __init__(
        self,
        products: Products,
        entries: StockEntries,
        draws: Draws,
        withdrawals: WithdrawalDraws,
        today: date,
    ) -> None:
        self._products = products
        self._entries = entries
        self._draws = draws
        self._withdrawals = withdrawals
        self._today = today

    def find(self, query: SearchQuery, limit: int) -> list[ProductHit]:
        # `listed()` is the unarchived products only: hidden, unpriced and sold-out ones
        # are in it, and are found.
        found = [
            p
            for p in self._products.listed()
            if p.id is not None and name_matches(p.name.value, query.q)
        ]
        found.sort(key=lambda p: search_order_key(p.name.value, query.q, p.id or 0))
        cut = found[:limit]
        stock = read_varieties_stock(
            self._entries,
            self._draws,
            self._withdrawals,
            [p.id for p in cut if p.id is not None],
            self._today,
        )
        return [
            ProductHit(p.id, p.name.value, stock[p.id].level.quantity)
            for p in cut
            if p.id is not None
        ]


class EmptySaleSearch:
    """The Sales group answers nothing until its own part."""

    def find(self, query: SearchQuery, limit: int) -> list[SaleHit]:
        return []
