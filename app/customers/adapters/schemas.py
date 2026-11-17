"""The HTTP shapes of a customer. Bare: no pydantic length or pattern constraint, so
every rule stays the domain's and its message is a fixed string (ADR-0005). `PATCH` is
partial: `model_fields_set` is how `CustomerPatchIn` tells a field left out from a field
explicitly sent as `null`, which clears `phone` and `customer_type_id` but is refused
for `name`. A `vip` in a body is ignored, like any extra field: membership in the VIP
type is `customer_type_id`'s to say."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.customers.application.errors import RequiredFieldCleared
from app.customers.application.manage_customers import UNCHANGED, CustomerChanges, Unchanged
from app.customers.application.ports import CustomerBalance, Standing
from app.customers.domain.customer import Customer
from app.money_schema import MoneyOut


class CustomerIn(BaseModel):
    name: str
    phone: str | None = None
    # The country a number typed without "+" is read by: a plain string, checked against
    # the list when it is used (docs/adr/20261111-phone-country-per-number).
    phone_country: str | None = None
    customer_type_id: int | None = None


class CustomerPatchIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    phone_country: str | None = None
    customer_type_id: int | None = None

    def to_changes(self) -> CustomerChanges:
        present = self.model_fields_set
        return CustomerChanges(
            name=_required(self.name, "name" in present, "name"),
            phone=self.phone if "phone" in present else UNCHANGED,
            customer_type_id=(
                self.customer_type_id if "customer_type_id" in present else UNCHANGED
            ),
        )


# A customer with no sales recorded has nothing for `Balances.for_customers` to
# answer (CustomerBalance.for_customers`'s own contract: absent, not an error) — this
# is the $0/settled default every `CustomerOut.of` falls back to.
NO_BALANCE = CustomerBalance(balance=0, owing_since=None, standing="settled")


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str | None
    # The phone grouped by its own country's rule, for reading only; null with no phone.
    phone_display: str | None
    vip: bool
    customer_type_id: int | None
    balance: MoneyOut
    owing_since: date | None
    standing: Standing

    @classmethod
    def of(
        cls,
        customer: Customer,
        balance: CustomerBalance = NO_BALANCE,
        vip_type_id: int | None = None,
    ) -> "CustomerOut":
        """`vip` is membership in the business's VIP type, compared here against the id
        the request read once (docs/adr/0070); the frozen column is never read."""
        assert customer.id is not None, "only stored customers go out"
        return cls(
            id=customer.id,
            name=customer.name.value,
            phone=customer.phone.value if customer.phone is not None else None,
            phone_display=customer.phone.display if customer.phone is not None else None,
            vip=vip_type_id is not None and customer.customer_type_id == vip_type_id,
            customer_type_id=customer.customer_type_id,
            balance=Decimal(balance.balance),
            owing_since=balance.owing_since,
            standing=balance.standing,
        )


def _required[T](value: T | None, present: bool, field: Literal["name"]) -> T | Unchanged:
    if not present:
        return UNCHANGED
    if value is None:
        raise RequiredFieldCleared(field)
    return value
