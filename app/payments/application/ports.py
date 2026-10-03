"""What payments needs from storage (docs/adr/0001, docs/adr/0004): each port is built
for one business, so a record of another business is, from here, a record that does
not exist.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.payments.domain.settlement import Ledger, PaymentMethod


@dataclass(frozen=True)
class NamedLedger:
    """One customer's id, current name and ledger (`Ledgers.all`'s own shape):
    `debtors` needs the name to break an owing-since tie, never a second query."""

    id: int
    name: str
    ledger: Ledger


@dataclass(frozen=True)
class StoredPayment:
    """What `Payments.get` answers for a payment that exists in this business: its id
    and its `sale_id`, the one fact `delete_payment` needs to tell an on-the-spot
    payment from a later one (the plan's invariant: the delete decides "on the spot"
    only on a row that read returned)."""

    id: int
    sale_id: int | None


class Ledgers(Protocol):
    """A business's customers, read into `settle()`'s own `Ledger` shape. Built for
    one business: every statement filters on it."""

    def for_customer(self, customer_id: int) -> Ledger | None:
        """`None` when the customer does not exist in this business."""
        ...

    def for_customers(self, customer_ids: Collection[int]) -> Mapping[int, Ledger]:
        """A ledger per id that exists in this business; an id that does not is
        simply absent from the mapping."""
        ...

    def all(self) -> Sequence[NamedLedger]:
        """Every customer of this business, each with its own ledger."""
        ...


class Payments(Protocol):
    """Later payments of one business (the plan's invariant: payments' repository
    inserts and deletes only `LATER` rows; sales' repository never writes a row
    without `sale_id`)."""

    def get(self, payment_id: int) -> StoredPayment | None:
        """`None` when the payment does not exist in this business."""
        ...

    def insert_later(
        self,
        customer_id: int,
        paid_on: date,
        amount: int,
        method: PaymentMethod,
        recorded_at: datetime,
    ) -> int:
        """One guarded `INSERT … SELECT`: raises `PaymentAboveBalance` and inserts no
        row when `amount` exceeds the customer's current balance, never a read
        followed by an unconditional insert. Answers the new row's id."""
        ...

    def delete_later(self, payment_id: int) -> int:
        """Guarded by `LATER`, `id` and `business_id`: answers the number of rows
        deleted, 0 or 1."""
        ...
