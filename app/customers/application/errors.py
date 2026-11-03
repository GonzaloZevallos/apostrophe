"""Use-case errors. Every one carries a fixed message and no data: no phone number, no
digit and no customer name ever reaches an exception's message (CODING_STANDARDS 9,
ADR-0005)."""

from typing import ClassVar, Literal


class CustomerNotFound(LookupError):
    code: ClassVar[str] = "customer.not_found"

    def __init__(self) -> None:
        super().__init__("no such customer")


class CustomerTypeNotFound(LookupError):
    """The type an assignment names does not exist in this business. Another business's
    id answers the same, so a type's existence never leaks across businesses.

    It carries no `code` of its own: the refusal code `customer_type.not_found` belongs
    to `customer_types` (one class per code, `tests/test_refusal_codes.py`), and this
    hexagon's router answers it with that code at the HTTP edge."""

    def __init__(self) -> None:
        super().__init__("no such customer type")


class PhoneTaken(ValueError):
    code: ClassVar[str] = "customer.phone_taken"

    def __init__(self) -> None:
        super().__init__("that phone number already belongs to a customer")


class RequiredFieldCleared(ValueError):
    """`field` names which required field a `PATCH` tried to clear with `null`. It is a
    fixed identifier, not data: it never carries what was sent."""

    code: ClassVar[str] = "customer.required_field_cleared"

    def __init__(self, field: Literal["name"]) -> None:
        super().__init__(f"{field} cannot be cleared")
