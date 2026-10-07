"""The HTTP shapes of a customer. Bare: no pydantic length or pattern constraint, so
every rule stays the domain's and its message is a fixed string (ADR-0005). `PATCH` is
partial: `model_fields_set` is how `CustomerPatchIn` tells a field left out from a field
explicitly sent as `null`, which clears `phone` and `channel` but is refused for `name`
and `vip`."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.customers.application.errors import RequiredFieldCleared
from app.customers.application.manage_customers import UNCHANGED, CustomerChanges, Unchanged
from app.customers.application.ports import CustomerBalance, Standing
from app.customers.domain.customer import Channel, Customer


class CustomerIn(BaseModel):
    name: str
    phone: str | None = None
    channel: Channel | None = None
    vip: bool = False


class CustomerPatchIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    channel: Channel | None = None
    vip: bool | None = None

    def to_changes(self) -> CustomerChanges:
        present = self.model_fields_set
        return CustomerChanges(
            name=_required(self.name, "name" in present, "name"),
            phone=self.phone if "phone" in present else UNCHANGED,
            channel=self.channel if "channel" in present else UNCHANGED,
            vip=_required(self.vip, "vip" in present, "vip"),
        )


# A customer with no sales recorded has nothing for `Balances.for_customers` to
# answer (CustomerBalance.for_customers`'s own contract: absent, not an error) — this
# is the $0/settled default every `CustomerOut.of` falls back to.
NO_BALANCE = CustomerBalance(balance=0, owing_since=None, standing="settled")


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str | None
    channel: Channel | None
    vip: bool
    balance: int
    owing_since: date | None
    standing: Standing

    @classmethod
    def of(cls, customer: Customer, balance: CustomerBalance = NO_BALANCE) -> "CustomerOut":
        assert customer.id is not None, "only stored customers go out"
        return cls(
            id=customer.id,
            name=customer.name.value,
            phone=customer.phone.value if customer.phone is not None else None,
            channel=customer.channel,
            vip=customer.vip,
            balance=balance.balance,
            owing_since=balance.owing_since,
            standing=balance.standing,
        )


def _required[T](
    value: T | None, present: bool, field: Literal["name", "vip"]
) -> T | Unchanged:
    if not present:
        return UNCHANGED
    if value is None:
        raise RequiredFieldCleared(field)
    return value
