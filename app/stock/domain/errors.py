"""Stock's own domain errors (CONTEXT.md: Stock entry; CODING_STANDARDS section 9): a
message names the rule broken, never the note, the grams or the amount that broke it.
Each carries its own `code`, never one inherited from a shared base, so
`tests/test_refusal_codes.py` finds each refusal exactly once.
"""

from typing import ClassVar


class EntryNotFound(LookupError):
    code: ClassVar[str] = "stock.entry_not_found"

    def __init__(self, entry_id: int) -> None:
        super().__init__(f"no stock entry {entry_id}")


class EntryGramsInvalid(ValueError):
    code: ClassVar[str] = "stock.grams_invalid"


class EntryCostRequired(ValueError):
    code: ClassVar[str] = "stock.cost_required"


class EntryCostInvalid(ValueError):
    code: ClassVar[str] = "stock.cost_invalid"


class EntryCostOnNegativeAdjustment(ValueError):
    code: ClassVar[str] = "stock.cost_on_negative_adjustment"


class EntryDateInFuture(ValueError):
    code: ClassVar[str] = "stock.date_in_future"


class EntryNoteTooLong(ValueError):
    code: ClassVar[str] = "stock.note_too_long"
