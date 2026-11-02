"""The HTTP shapes of a customer type. On the way in the icon is a bare string the domain
checks, so an unknown key answers 422 with its own code rather than a generic validation
error. `is_vip` is never a request field: pydantic ignores an extra one."""

from pydantic import BaseModel

from app.customer_types.domain.customer_type import CustomerType, CustomerTypeIcon


class CustomerTypeIn(BaseModel):
    name: str
    icon: str | None = None


class CustomerTypePatchIn(BaseModel):
    name: str | None = None
    icon: str | None = None


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
