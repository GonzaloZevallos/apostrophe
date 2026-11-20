"""Customers' `Balances` and sales' `OwingSales` (`app/customers/application/ports.py`,
`app/sales/application/ports.py`), the two ports those hexagons declare so they can
show a balance or a "still owing" mark without importing `app.payments`
(CODING_STANDARDS section 1; the plan's invariant).

Both read through `SqlLedgers` and settle through `settle()` alone — no sum or walk of
sales against payments happens here a second time. `app/main.py` wires both onto
`app.state.balances` and `app.state.owing_sales`, the same shape `app.state.line_costs`
already uses for stock.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping

from sqlalchemy.orm import Session

from app.customers.application.ports import CustomerBalance
from app.payments.adapters.sql_ledgers import SqlLedgers
from app.payments.domain.settlement import settle
from app.sales.application.ports import CustomerSettlement


class SqlBalances:
    def __init__(self, session: Session, business_id: int) -> None:
        self._ledgers = SqlLedgers(session, business_id)

    def for_customers(self, customer_ids: Collection[int]) -> Mapping[int, CustomerBalance]:
        ledgers = self._ledgers.for_customers(customer_ids)
        balances: dict[int, CustomerBalance] = {}
        for customer_id, ledger in ledgers.items():
            result = settle(ledger)
            balances[customer_id] = CustomerBalance(
                balance=result.balance,
                owing_since=result.owing_since,
                standing=result.standing,
            )
        return balances


class SqlOwingSales:
    def __init__(self, session: Session, business_id: int) -> None:
        self._ledgers = SqlLedgers(session, business_id)

    def owed_of(self, customer_ids: Collection[int]) -> Mapping[int, int]:
        ledgers = self._ledgers.for_customers(customer_ids)
        owed: dict[int, int] = {}
        for ledger in ledgers.values():
            for sale in settle(ledger).sales:
                owed[sale.sale_id] = sale.still_owed
        return owed

    def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
        return frozenset(
            sale_id for sale_id, still_owed in self.owed_of(customer_ids).items() if still_owed > 0
        )

    def settlement_of(self, customer_id: int) -> CustomerSettlement:
        ledger = self._ledgers.for_customers([customer_id]).get(customer_id)
        if ledger is None:
            return CustomerSettlement(0, {})
        result = settle(ledger)
        return CustomerSettlement(
            result.balance, {sale.sale_id: sale.still_owed for sale in result.sales}
        )
