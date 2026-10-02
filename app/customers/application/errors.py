"""Use-case errors. Every one carries a fixed message and no data: no phone number, no
digit and no customer name ever reaches an exception's message (CODING_STANDARDS 9,
ADR-0005)."""

from typing import Literal


class CustomerNotFound(LookupError):
    def __init__(self) -> None:
        super().__init__("no such customer")


class PhoneTaken(ValueError):
    def __init__(self) -> None:
        super().__init__("that phone number already belongs to a customer")


class RequiredFieldCleared(ValueError):
    """`field` names which required field a `PATCH` tried to clear with `null`. It is a
    fixed identifier, not data: it never carries what was sent."""

    def __init__(self, field: Literal["name", "phone", "vip"]) -> None:
        super().__init__(f"{field} cannot be cleared")
