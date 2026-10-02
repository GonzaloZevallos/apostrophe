"""Use-case errors that are not already domain rules (CODING_STANDARDS section 9): a
fixed message, no data."""


class SaleNotFound(LookupError):
    def __init__(self) -> None:
        super().__init__("no such sale")
