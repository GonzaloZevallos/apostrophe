"""Use-case errors that are not already domain rules (CODING_STANDARDS section 9): a
fixed message, no data."""

from typing import ClassVar


class SaleNotFound(LookupError):
    code: ClassVar[str] = "sale.not_found"

    def __init__(self) -> None:
        super().__init__("no such sale")
