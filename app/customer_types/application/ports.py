from typing import Protocol

from app.customer_types.domain.customer_type import CustomerType


class CustomerTypes(Protocol):
    """The customer types of one business: the business is fixed when the store is
    built, so nothing here can reach another business's types (docs/adr/0004). `add`
    and `save` write without committing and return the type as stored, with its id."""

    def list(self) -> list[CustomerType]: ...

    def by_id(self, type_id: int) -> CustomerType | None: ...

    def by_key(self, key: str) -> CustomerType | None: ...

    def add(self, customer_type: CustomerType) -> CustomerType: ...

    def save(self, customer_type: CustomerType) -> CustomerType: ...

    def delete_unused(self, type_id: int) -> bool:
        """Deletes the type only if no customer is in it, in one statement, and says
        whether it did: the guard against a customer joining after the count."""
        ...


class CustomersInType(Protocol):
    """Implemented in `customers/adapters` and handed to this hexagon's router, so
    `customer_types` never imports `app.customers`."""

    def count(self, type_id: int) -> int: ...
