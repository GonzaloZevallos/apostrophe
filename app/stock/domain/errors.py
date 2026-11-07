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


class EntryQuantityInvalid(ValueError):
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


class WithdrawalReasonRequired(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_required"


class WithdrawalDateInFuture(ValueError):
    code: ClassVar[str] = "stock.withdrawal_date_in_future"


class WithdrawalNoLines(ValueError):
    code: ClassVar[str] = "stock.withdrawal_no_lines"


class WithdrawalQuantityNotPositive(ValueError):
    code: ClassVar[str] = "stock.withdrawal_grams_not_positive"


class WithdrawalQuantityTooPrecise(ValueError):
    code: ClassVar[str] = "stock.withdrawal_grams_too_precise"


class WithdrawalNoteTooLong(ValueError):
    code: ClassVar[str] = "stock.withdrawal_note_too_long"


class WithdrawalNotFound(LookupError):
    code: ClassVar[str] = "stock.withdrawal_not_found"

    def __init__(self) -> None:
        super().__init__("no such stock withdrawal")


class WithdrawalVarietyNotFound(LookupError):
    code: ClassVar[str] = "stock.withdrawal_variety_not_found"

    def __init__(self) -> None:
        super().__init__("no such variety for a stock withdrawal")


class ReasonNameBlank(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_name_blank"


class ReasonNameTooLong(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_name_too_long"


class ReasonNameTaken(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_name_taken"

    def __init__(self) -> None:
        super().__init__("another reason of the business already has that name")


class ReasonHasWithdrawals(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_has_withdrawals"

    def __init__(self) -> None:
        super().__init__("the reason still has withdrawals and cannot be removed")


class LastReason(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_last"

    def __init__(self) -> None:
        super().__init__("a business keeps at least one reason, so the last cannot be removed")


class ReasonCannotMove(ValueError):
    code: ClassVar[str] = "stock.withdrawal_reason_cannot_move"

    def __init__(self) -> None:
        super().__init__("the reason is already at that edge of the list")


class WithdrawalReasonNotFound(LookupError):
    code: ClassVar[str] = "stock.withdrawal_reason_not_found"

    def __init__(self) -> None:
        super().__init__("no such withdrawal reason")
