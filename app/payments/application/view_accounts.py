"""A customer's account, and who owes across the business (CONTEXT.md: Payment,
Balance, Owing since, Sales still owing). Both come only from `settle()`/`account_of`
(`app/payments/domain/`): nothing here sums or walks sales against payments itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.payments.application.errors import CustomerNotFound
from app.payments.application.ports import Ledgers
from app.payments.domain.account import Account, account_of
from app.payments.domain.settlement import Standing, settle
from app.shared.names import fold


def account(ledgers: Ledgers, customer_id: int) -> Account:
    ledger = ledgers.for_customer(customer_id)
    if ledger is None:
        raise CustomerNotFound()
    return account_of(ledger.sales, ledger.payments)


@dataclass(frozen=True)
class Debtor:
    customer_id: int
    name: str
    balance: int
    owing_since: date | None
    standing: Standing


@dataclass(frozen=True)
class Debtors:
    total_owed: int
    sales_owing_count: int
    debtors: tuple[Debtor, ...]


def debtors(ledgers: Ledgers) -> Debtors:
    """Every customer with a standing of `owes`, oldest debt first, ties by `fold`ed
    name then id (the plan's invariant: every ordering of customers by name uses
    `fold`, in Python). `total_owed` sums only those balances; `sales_owing_count` is
    the size of the union of every customer's `still_owing`, counted once even when
    a sale has no customer (`settle` never sees one, since `Ledgers` only reads sales
    that have a customer)."""
    total_owed = 0
    sales_owing: set[int] = set()
    rows: list[Debtor] = []
    for named in ledgers.all():
        result = settle(named.ledger)
        sales_owing |= result.still_owing
        if result.standing != "owes":
            continue
        total_owed += result.balance
        rows.append(
            Debtor(
                customer_id=named.id,
                name=named.name,
                balance=result.balance,
                owing_since=result.owing_since,
                standing=result.standing,
            )
        )

    def sort_key(debtor: Debtor) -> tuple[date, str, int]:
        # A balance above $0 always leaves at least one sale still owing (the walk
        # can never spend more of a payment than the business's sales owe in total),
        # so `owing_since` is never `None` here.
        assert debtor.owing_since is not None
        return (debtor.owing_since, fold(debtor.name), debtor.customer_id)

    rows.sort(key=sort_key)
    return Debtors(total_owed=total_owed, sales_owing_count=len(sales_owing), debtors=tuple(rows))
