"""Why a change of a business's decimals did not happen (docs/adr/0080, amending docs/adr/0058).

Every message is a fixed literal and carries no business id, amount or driver text
(CODING_STANDARDS.md section 9). None has a `code`: the part that wires a route decides
how each is answered."""

from __future__ import annotations


class RescaleBusy(Exception):
    """The database was locked by another writer. Nothing changed; run it again."""

    def __init__(self) -> None:
        super().__init__("the database was busy: nothing changed, run it again")


class AmountTooLargeToRescale(Exception):
    """An amount is too large to be multiplied by 100 inside a 64-bit integer."""

    def __init__(self) -> None:
        super().__init__("an amount is too large to be rescaled: nothing changed")


class RescaleCheckFailed(Exception):
    """A rescaled column did not check out against the column before it."""

    def __init__(self) -> None:
        super().__init__("the rescaled amounts did not check out: nothing changed")


class DecimalsBelowRecordedAmounts(Exception):
    """A lower decimals would hide cents of an amount already recorded."""

    def __init__(self) -> None:
        super().__init__("an amount recorded holds more decimals than the new ones")
