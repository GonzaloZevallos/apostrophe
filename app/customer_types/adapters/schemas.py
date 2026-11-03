"""The HTTP shapes of a customer type. On the way in the icon is a bare string the domain
checks, so an unknown key answers 422 with its own code rather than a generic validation
error. `is_vip` is never a request field: pydantic ignores an extra one."""

from typing import Annotated

from pydantic import BaseModel, Field

from app.customer_types.domain.customer_type import CustomerType, CustomerTypeIcon

# The OpenAPI document names the closed set, derived from the one enum and never listed a
# second time, while validation stays in the domain: a typed field would answer an unknown
# key with the generic `RequestInvalid` instead of `customer_type.icon_unknown`.
IconKey = Annotated[
    str, Field(json_schema_extra={"enum": [icon.value for icon in CustomerTypeIcon]})
]


class CustomerTypeIn(BaseModel):
    name: str
    icon: IconKey | None = None


class CustomerTypePatchIn(BaseModel):
    name: str | None = None
    icon: IconKey | None = None


class CustomerTypeOut(BaseModel):
    id: int
    name: str
    icon: CustomerTypeIcon
    is_vip: bool

    @classmethod
    def of(cls, customer_type: CustomerType) -> "CustomerTypeOut":
        assert customer_type.id is not None, "only stored customer types go out"
        return cls(
            id=customer_type.id,
            name=customer_type.name.value,
            icon=customer_type.icon,
            is_vip=customer_type.is_vip,
        )
