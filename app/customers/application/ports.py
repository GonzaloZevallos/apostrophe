from collections.abc import Collection, Mapping
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from app.customers.domain.customer import Customer, PhoneNumber
from app.shared.pricing_settings import PricingSettings

# The same three values `app.payments.domain.settlement.Standing` declares: customers
# never imports `app.payments` (the plan's invariant), so this Protocol names its own
# literal instead of importing payments' own type. `standing` itself is still derived
# only by payments' `standing_of`; this is only the shape it travels in from there.
Standing = Literal["owes", "credit", "settled"]


@dataclass(frozen=True)
class CustomerBalance:
    """One customer's balance, owing since and standing, as settlement (`app.payments`)
    computes them. `Balances.for_customers` is the one way this hexagon ever sees a
    figure shaped by another customer's sales or payments."""

    balance: int
    owing_since: date | None
    standing: Standing


class Balances(Protocol):
    """Each customer's balance, from settlement (CONTEXT.md: Balance, Owing since).
    Built for one business: every statement filters on it. The one implementation,
    `app.payments.adapters.settlements.SqlBalances`, is wired onto `app.state.balances`
    in `app/main.py` and reached from here only through this port (CODING_STANDARDS
    section 1; the plan's invariant: nothing under `app/customers/` imports
    `app.payments`)."""

    def for_customers(self, customer_ids: Collection[int]) -> Mapping[int, CustomerBalance]:
        """A balance per id that has at least one sale recorded; an id with none is
        simply absent, not an error — the caller supplies the $0/settled default."""
        ...


class Customers(Protocol):
    """The customers of one business: the business is fixed when the store is built, so
    nothing here can reach another business's customers (docs/adr/0004). `add` and
    `save` write without committing and return the customer as stored, with its id."""

    def add(self, customer: Customer) -> Customer: ...

    def get(self, customer_id: int) -> Customer | None: ...

    def all(self) -> list[Customer]: ...

    def save(self, customer: Customer) -> Customer: ...

    def phone_taken(self, phone: PhoneNumber, *, other_than: int | None = None) -> bool: ...


class PricingSettingsReader(Protocol):
    """The business's pricing switches, through the one port customers declares for them
    (docs/adr/0006); the pricing_settings hexagon implements it, wired in `app/main.py`."""

    def current(self) -> PricingSettings: ...
