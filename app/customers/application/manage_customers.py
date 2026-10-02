"""The customer use cases: register, look up, edit and find. `edit_customer` takes a
`CustomerChanges`, whose fields default to `UNCHANGED` so a `PATCH` that leaves a field
out leaves it as it was; a field explicitly cleared is the caller's problem to catch
before it gets here (`RequiredFieldCleared`, raised at the HTTP edge, not here)."""

from dataclasses import dataclass
from enum import Enum, auto

from app.customers.application.errors import CustomerNotFound, PhoneTaken
from app.customers.application.ports import Customers
from app.customers.domain.customer import Channel, Customer, CustomerName, PhoneNumber
from app.shared.transaction import Transaction


class Unchanged(Enum):
    UNCHANGED = auto()


UNCHANGED = Unchanged.UNCHANGED


@dataclass(frozen=True)
class CustomerChanges:
    name: str | Unchanged = UNCHANGED
    phone: str | Unchanged = UNCHANGED
    channel: Channel | None | Unchanged = UNCHANGED
    vip: bool | Unchanged = UNCHANGED


def register_customer(
    customers: Customers,
    transaction: Transaction,
    *,
    name: str,
    phone: str,
    channel: Channel | None,
    vip: bool,
) -> Customer:
    customer_name = CustomerName.of(name)
    customer_phone = PhoneNumber.of(phone)
    if customers.phone_taken(customer_phone):
        raise PhoneTaken()
    customer = customers.add(
        Customer(name=customer_name, phone=customer_phone, channel=channel, vip=vip)
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
    transaction: Transaction,
    customer_id: int,
    changes: CustomerChanges,
) -> Customer:
    customer = get_customer(customers, customer_id)

    name = customer.name if isinstance(changes.name, Unchanged) else CustomerName.of(changes.name)

    if isinstance(changes.phone, Unchanged):
        phone = customer.phone
    else:
        phone = PhoneNumber.of(changes.phone)
        if customers.phone_taken(phone, other_than=customer_id):
            raise PhoneTaken()

    channel = customer.channel if isinstance(changes.channel, Unchanged) else changes.channel
    vip = customer.vip if isinstance(changes.vip, Unchanged) else changes.vip

    customer.name = name
    customer.phone = phone
    customer.channel = channel
    customer.vip = vip
    stored = customers.save(customer)
    transaction.commit()
    return stored


def find_customers(customers: Customers, query: str) -> list[Customer]:
    return sorted((c for c in customers.all() if c.matches(query)), key=lambda c: c.sort_key)
