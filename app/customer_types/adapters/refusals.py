"""The refusal code this hexagon owns for a type that is not the caller's, offered to
`customers.adapters`, whose only edge into `customer_types` is through `adapters`."""

from app.customer_types.domain.customer_type import CustomerTypeNotFound

TYPE_NOT_FOUND_CODE: str = CustomerTypeNotFound.code
