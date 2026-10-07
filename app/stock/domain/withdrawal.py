"""A stock withdrawal (CONTEXT.md: Stock withdrawal, Promotion, Own use): grams the
business takes out of its own stock with no sale and no customer.

`Withdrawal.of` is the one constructor recording and editing both go through, so the
same rules apply either way. An edit builds a new `Withdrawal` and passes the existing
`id` and `recorded_at` back in; neither changes. Every refusal message is a fixed
literal: it never repeats the note, the grams or an id (CODING_STANDARDS section 9).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.shared.grams import HUNDREDTHS_PER_GRAM, Grams
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.entry import NOTE_MAX_LENGTH
from app.stock.domain.errors import (
    WithdrawalDateInFuture,
    WithdrawalGramsNotPositive,
    WithdrawalGramsTooPrecise,
    WithdrawalNoLines,
    WithdrawalNoteTooLong,
    WithdrawalReasonRequired,
)


@dataclass(frozen=True)
class WithdrawalLine:
    variety_id: int
    grams: Grams

    def __post_init__(self) -> None:
        if not self.grams.is_positive:
            raise WithdrawalGramsNotPositive("a withdrawal line takes grams above zero")

    @classmethod
    def of(cls, variety_id: int, grams: Decimal | int | str) -> WithdrawalLine:
        try:
            amount = Decimal(grams)
        except InvalidOperation as exc:
            raise WithdrawalGramsNotPositive("a withdrawal line takes grams above zero") from exc
        if not amount.is_finite():
            raise WithdrawalGramsNotPositive("a withdrawal line takes grams above zero")
        scaled = amount * HUNDREDTHS_PER_GRAM
        if scaled != scaled.to_integral_value():
            raise WithdrawalGramsTooPrecise("a withdrawal line allows at most two decimals")
        return cls(variety_id, Grams(int(scaled)))


@dataclass
class Withdrawal:
    reason: WithdrawalReason
    withdrawn_on: date
    note: str | None
    lines: tuple[WithdrawalLine, ...]
    recorded_at: datetime
    id: int | None = None

    @classmethod
    def of(
        cls,
        reason: WithdrawalReason | str | None,
        withdrawn_on: date,
        note: str | None,
        lines: tuple[WithdrawalLine, ...],
        today: date,
        recorded_at: datetime,
        id: int | None = None,
    ) -> Withdrawal:
        try:
            checked_reason = WithdrawalReason(reason or "")
        except ValueError as exc:
            raise WithdrawalReasonRequired("a withdrawal needs a reason") from exc
        if withdrawn_on > today:
            raise WithdrawalDateInFuture("a withdrawal is not dated after today")
        if not lines:
            raise WithdrawalNoLines("a withdrawal has at least one line")
        trimmed = (note or "").strip()
        if len(trimmed) > NOTE_MAX_LENGTH:
            raise WithdrawalNoteTooLong(f"a note has at most {NOTE_MAX_LENGTH} characters")
        return cls(
            reason=checked_reason,
            withdrawn_on=withdrawn_on,
            note=trimmed or None,
            lines=lines,
            recorded_at=recorded_at,
            id=id,
        )

    @property
    def total_grams(self) -> Grams:
        return Grams(sum(line.grams.hundredths for line in self.lines))
