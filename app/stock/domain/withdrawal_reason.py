"""A business's own list of withdrawal reasons (CONTEXT.md: Withdrawal reason).

The name follows the shared name rule (`app/shared/names.py`), as an expense category's
does. "Has withdrawals" is never stored: `check_removable` is handed the fact, read by
the repository at the moment of the call. Withdrawals link to a reason by its id
(`Withdrawal.reason_id`).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem
from app.stock.domain.errors import (
    LastReason,
    ReasonHasWithdrawals,
    ReasonNameBlank,
    ReasonNameTooLong,
)

NAME_MAX_LENGTH = 60


@dataclass(frozen=True)
class ReasonName:
    """A reason's name, with inner whitespace collapsed. Two names that differ only in
    case are the same name (`key`)."""

    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise ReasonNameBlank("a reason needs a name")
        if problem is NameProblem.UNTRIMMED:
            raise ReasonNameBlank("a reason name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise ReasonNameTooLong(f"a reason name has at most {NAME_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> ReasonName:
        return cls(collapse_spaces(raw))

    @property
    def key(self) -> str:
        return name_key(self.value)


@dataclass
class WithdrawalReason:
    id: int
    name: ReasonName
    position: int

    def rename(self, name: ReasonName) -> None:
        self.name = name

    def check_removable(self, has_withdrawals: bool, reason_count: int) -> None:
        """Raises `ReasonHasWithdrawals` when a withdrawal of any date is filed under
        this reason, `LastReason` when it is the business's only one."""
        if has_withdrawals:
            raise ReasonHasWithdrawals()
        if reason_count <= 1:
            raise LastReason()
