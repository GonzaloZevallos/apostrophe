from typing import Protocol

from app.customers.domain.customer import Customer, PhoneNumber


class Customers(Protocol):
    """The customers of one business: the business is fixed when the store is built, so
    nothing here can reach another business's customers (docs/adr/0004). `add` and
    `save` write without committing and return the customer as stored, with its id."""

    def add(self, customer: Customer) -> Customer: ...

    def get(self, customer_id: int) -> Customer | None: ...

    def all(self) -> list[Customer]: ...

    def save(self, customer: Customer) -> Customer: ...

    def phone_taken(self, phone: PhoneNumber, *, other_than: int | None = None) -> bool: ...
