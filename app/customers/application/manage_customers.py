"""The customer use cases: register, look up, edit and find. `edit_customer` takes a
`CustomerChanges`, whose fields default to `UNCHANGED` so a `PATCH` that leaves a field
out leaves it as it was; a field explicitly cleared is the caller's problem to catch
before it gets here (`RequiredFieldCleared`, raised at the HTTP edge, not here)."""

from dataclasses import dataclass
from enum import Enum, auto

from app.customers.application.errors import CustomerNotFound, PhoneTaken
from app.customers.application.ports import Customers, PricingSettingsReader
from app.customers.domain.customer import Channel, Customer, CustomerName, PhoneNumber
from app.shared.transaction import Transaction


class Unchanged(Enum):
    UNCHANGED = auto()


UNCHANGED = Unchanged.UNCHANGED


@dataclass(frozen=True)
class CustomerChanges:
    name: str | Unchanged = UNCHANGED
    phone: str | None | Unchanged = UNCHANGED
    channel: Channel | None | Unchanged = UNCHANGED
    vip: bool | Unchanged = UNCHANGED


def register_customer(
    customers: Customers,
    settings: PricingSettingsReader,
    transaction: Transaction,
    *,
    name: str,
    phone: str | None,
    channel: Channel | None,
    vip: bool,
) -> Customer:
    # While Clientes VIP is off a customer is never created VIP (docs/adr/0034).
    is_vip = vip and settings.current().is_vip_customers
    return _register(customers, transaction, name, phone, channel, is_vip)


def register_imported_customer(
    customers: Customers,
    transaction: Transaction,
    *,
    name: str,
    phone: str | None,
    vip: bool,
) -> Customer:
    """The spreadsheet import's own write: it has already switched Clientes VIP on when
    the sheet has a VIP customer, so the mark is stored as the sheet says."""
    return _register(customers, transaction, name, phone, None, vip)


def _register(
    customers: Customers,
    transaction: Transaction,
    name: str,
    phone: str | None,
    channel: Channel | None,
    is_vip: bool,
) -> Customer:
    customer_name = CustomerName.of(name)
    customer_phone = PhoneNumber.optional(phone)
    if customer_phone is not None and customers.phone_taken(customer_phone):
        raise PhoneTaken()
    customer = customers.add(
        Customer(name=customer_name, phone=customer_phone, channel=channel, vip=is_vip)
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
    transaction: Transaction,
    customer_id: int,
    changes: CustomerChanges,
) -> Customer:
    customer = get_customer(customers, customer_id)

    name = customer.name if isinstance(changes.name, Unchanged) else CustomerName.of(changes.name)

    if isinstance(changes.phone, Unchanged):
        phone = customer.phone
    else:
        phone = PhoneNumber.optional(changes.phone)
        if phone is not None and customers.phone_taken(phone, other_than=customer_id):
            raise PhoneTaken()

    channel = customer.channel if isinstance(changes.channel, Unchanged) else changes.channel
    # While Clientes VIP is off the stored mark is left as it is, whatever was sent.
    if isinstance(changes.vip, Unchanged) or not settings.current().is_vip_customers:
        vip = customer.vip
    else:
        vip = changes.vip

    customer.name = name
    customer.phone = phone
    customer.channel = channel
    customer.vip = vip
    stored = customers.save(customer)
    transaction.commit()
    return stored


def find_customers(customers: Customers, query: str) -> list[Customer]:
    return sorted((c for c in customers.all() if c.matches(query)), key=lambda c: c.sort_key)
