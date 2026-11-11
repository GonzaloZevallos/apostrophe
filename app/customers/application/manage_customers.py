"""The customer use cases: register, look up, edit and find. `edit_customer` takes a
`CustomerChanges`, whose fields default to `UNCHANGED` so a `PATCH` that leaves a field
out leaves it as it was; a field explicitly cleared is the caller's problem to catch
before it gets here (`RequiredFieldCleared`, raised at the HTTP edge, not here)."""

from dataclasses import dataclass
from enum import Enum, auto

from app.customers.application.errors import CustomerNotFound, CustomerTypeNotFound, PhoneTaken
from app.customers.application.ports import (
    Customers,
    CustomerTypes,
    PhoneCountryReader,
    PricingSettingsReader,
)
from app.customers.domain.customer import Customer, CustomerName, PhoneNumber
from app.shared.phone_country import PhoneCountry
from app.shared.transaction import Transaction


class Unchanged(Enum):
    UNCHANGED = auto()


UNCHANGED = Unchanged.UNCHANGED


@dataclass(frozen=True)
class CustomerChanges:
    name: str | Unchanged = UNCHANGED
    phone: str | None | Unchanged = UNCHANGED
    customer_type_id: int | None | Unchanged = UNCHANGED


def register_customer(
    customers: Customers,
    settings: PricingSettingsReader,
    phone_country: PhoneCountryReader,
    types: CustomerTypes,
    transaction: Transaction,
    *,
    name: str,
    phone: str | None,
    customer_type_id: int | None,
) -> Customer:
    _require_existing(types, customer_type_id)
    # While the customer types are off a customer is created with none (docs/adr/0059).
    stored_type = customer_type_id if settings.current().is_vip_customers else None
    return _register(customers, transaction, name, phone, phone_country.current(), stored_type)


def register_imported_customer(
    customers: Customers,
    transaction: Transaction,
    *,
    name: str,
    phone: str | None,
    customer_type_id: int | None,
) -> Customer:
    """The spreadsheet import's own write. The import hands in the VIP type id of a VIP
    of the sheet, and the frozen `vip` mark is never written (docs/adr/0070). Its numbers
    are Argentine whatever the business's Phone country (docs/adr/0082)."""
    return _register(customers, transaction, name, phone, PhoneCountry.AR, customer_type_id)


def _register(
    customers: Customers,
    transaction: Transaction,
    name: str,
    phone: str | None,
    country: PhoneCountry | None,
    customer_type_id: int | None,
) -> Customer:
    customer_name = CustomerName.of(name)
    customer_phone = PhoneNumber.optional(phone, country)
    if customer_phone is not None and customers.phone_taken(customer_phone):
        raise PhoneTaken()
    customer = customers.add(
        Customer(
            name=customer_name,
            phone=customer_phone,
            customer_type_id=customer_type_id,
        )
    )
    transaction.commit()
    return customer


def get_customer(customers: Customers, customer_id: int) -> Customer:
    customer = customers.get(customer_id)
    if customer is None:
        raise CustomerNotFound()
    return customer


def edit_customer(
    customers: Customers,
    settings: PricingSettingsReader,
    phone_country: PhoneCountryReader,
    types: CustomerTypes,
    transaction: Transaction,
    customer_id: int,
    changes: CustomerChanges,
) -> Customer:
    customer = get_customer(customers, customer_id)

    name = customer.name if isinstance(changes.name, Unchanged) else CustomerName.of(changes.name)

    if isinstance(changes.phone, Unchanged):
        phone = customer.phone
    elif customer.phone is not None and changes.phone == customer.phone.value:
        # The stored value sent back as it is stays as it is, whatever the Phone country
        # is now: it is neither normalised again nor looked up (docs/adr/0082).
        phone = customer.phone
    else:
        phone = PhoneNumber.optional(changes.phone, phone_country.current())
        if phone is not None and customers.phone_taken(phone, other_than=customer_id):
            raise PhoneTaken()

    if not isinstance(changes.customer_type_id, Unchanged):
        _require_existing(types, changes.customer_type_id)
    # While the customer types are off the stored type is left as it is, whatever was sent.
    if isinstance(changes.customer_type_id, Unchanged) or not settings.current().is_vip_customers:
        customer_type_id = customer.customer_type_id
    else:
        customer_type_id = changes.customer_type_id

    customer.name = name
    customer.phone = phone
    customer.customer_type_id = customer_type_id
    stored = customers.save(customer)
    transaction.commit()
    return stored


def _require_existing(types: CustomerTypes, customer_type_id: int | None) -> None:
    """A type id that is not one of this business's answers `CustomerTypeNotFound`, the
    same for an id that never existed and for another business's, switch on or off."""
    if customer_type_id is not None and not types.exists(customer_type_id):
        raise CustomerTypeNotFound()


def find_customers(customers: Customers, query: str) -> list[Customer]:
    return sorted((c for c in customers.all() if c.matches(query)), key=lambda c: c.sort_key)
