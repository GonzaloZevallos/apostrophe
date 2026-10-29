"""`Withdrawal.of` and `WithdrawalLine.of` (CODING_STANDARDS section 5: domain unit tests,
no infrastructure)."""

from collections.abc import Callable
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.shared.quantity import Quantity
from app.stock.domain.draw_source import WithdrawalReason
from app.stock.domain.entry import NOTE_MAX_LENGTH
from app.stock.domain.errors import (
    WithdrawalDateInFuture,
    WithdrawalNoLines,
    WithdrawalNoteTooLong,
    WithdrawalNotFound,
    WithdrawalQuantityNotPositive,
    WithdrawalQuantityTooPrecise,
    WithdrawalReasonRequired,
    WithdrawalVarietyNotFound,
)
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine

type Refusal = (
    WithdrawalReasonRequired
    | WithdrawalDateInFuture
    | WithdrawalNoLines
    | WithdrawalQuantityNotPositive
    | WithdrawalQuantityTooPrecise
    | WithdrawalNoteTooLong
    | WithdrawalNotFound
    | WithdrawalVarietyNotFound
)

TODAY = date(2026, 10, 6)
RECORDED_AT = datetime(2026, 10, 6, 12, 0)


def _line(variety_id: int = 1, quantity: str = "5") -> WithdrawalLine:
    return WithdrawalLine.of(variety_id, quantity)


def _withdrawal(
    *,
    reason: WithdrawalReason | str | None = WithdrawalReason.PROMOTION,
    withdrawn_on: date = TODAY,
    note: str | None = None,
    lines: tuple[WithdrawalLine, ...] | None = None,
    today: date = TODAY,
    recorded_at: datetime = RECORDED_AT,
    id: int | None = None,
) -> Withdrawal:
    return Withdrawal.of(
        reason,
        withdrawn_on,
        note,
        (_line(),) if lines is None else lines,
        today,
        recorded_at,
        id,
    )


def test_a_withdrawal_dated_today_is_recorded() -> None:
    withdrawal = _withdrawal()

    assert withdrawal.reason is WithdrawalReason.PROMOTION
    assert withdrawal.withdrawn_on == TODAY
    assert withdrawal.recorded_at == RECORDED_AT
    assert withdrawal.id is None


def test_the_reason_may_come_as_its_raw_value() -> None:
    assert _withdrawal(reason="own_use").reason is WithdrawalReason.OWN_USE


@pytest.mark.parametrize("raw", [None, "", "gift", "Promotion", " promotion"])
def test_a_missing_or_unknown_reason_is_refused(raw: str | None) -> None:
    with pytest.raises(WithdrawalReasonRequired):
        _withdrawal(reason=raw)


def test_a_withdrawal_dated_after_today_is_refused() -> None:
    with pytest.raises(WithdrawalDateInFuture):
        _withdrawal(withdrawn_on=TODAY + timedelta(days=1))


def test_an_earlier_date_is_recorded() -> None:
    assert _withdrawal(withdrawn_on=TODAY - timedelta(days=30)).withdrawn_on == date(2026, 9, 6)


def test_a_withdrawal_with_no_lines_is_refused() -> None:
    with pytest.raises(WithdrawalNoLines):
        _withdrawal(lines=())


def test_the_same_variety_in_several_lines_is_kept_unmerged() -> None:
    lines = (_line(1, "2"), _line(1, "3"), _line(2, "1.5"))

    withdrawal = _withdrawal(lines=lines)

    assert withdrawal.lines == lines
    assert withdrawal.total_quantity == Quantity.of("6.5")


def test_a_line_of_one_hundredth_of_a_gram_is_accepted() -> None:
    assert _line(quantity="0.01").quantity == Quantity(1)


def test_a_line_takes_grams_as_a_decimal_or_an_int() -> None:
    assert WithdrawalLine.of(1, Decimal("2.5")).quantity == Quantity(250)
    assert WithdrawalLine.of(1, 3).quantity == Quantity(300)


@pytest.mark.parametrize("raw", ["0", "0.00", "-1", "-0.01", "abc", "", "NaN", "Infinity"])
def test_a_line_with_grams_not_above_zero_is_refused(raw: str) -> None:
    with pytest.raises(WithdrawalQuantityNotPositive):
        _line(quantity=raw)


@pytest.mark.parametrize("raw", ["0.001", "1.005", "12.345"])
def test_a_line_with_more_than_two_decimals_is_refused(raw: str) -> None:
    with pytest.raises(WithdrawalQuantityTooPrecise):
        _line(quantity=raw)


def test_a_line_built_from_zero_grams_directly_is_refused() -> None:
    with pytest.raises(WithdrawalQuantityNotPositive):
        WithdrawalLine(variety_id=1, quantity=Quantity(0))
    with pytest.raises(WithdrawalQuantityNotPositive):
        WithdrawalLine(variety_id=1, quantity=Quantity(-100))


def test_a_note_of_exactly_the_limit_is_kept() -> None:
    note = "x" * NOTE_MAX_LENGTH

    assert _withdrawal(note=note).note == note


def test_a_note_over_the_limit_is_refused() -> None:
    with pytest.raises(WithdrawalNoteTooLong):
        _withdrawal(note="x" * (NOTE_MAX_LENGTH + 1))


def test_a_note_is_trimmed_before_it_is_measured() -> None:
    padded = "  " + "x" * NOTE_MAX_LENGTH + "  "

    assert _withdrawal(note=padded).note == "x" * NOTE_MAX_LENGTH


@pytest.mark.parametrize("raw", [None, "", "   "])
def test_a_blank_note_means_none(raw: str | None) -> None:
    assert _withdrawal(note=raw).note is None


def test_an_edit_keeps_the_id_and_the_moment_it_was_recorded() -> None:
    original = _withdrawal(id=7)

    edited = Withdrawal.of(
        WithdrawalReason.OWN_USE,
        TODAY - timedelta(days=1),
        "otra",
        (_line(2, "9"),),
        TODAY,
        original.recorded_at,
        original.id,
    )

    assert edited.id == 7
    assert edited.recorded_at == RECORDED_AT
    assert edited.reason is WithdrawalReason.OWN_USE


def test_an_edit_runs_the_same_validation() -> None:
    with pytest.raises(WithdrawalNoLines):
        Withdrawal.of(WithdrawalReason.PROMOTION, TODAY, None, (), TODAY, RECORDED_AT, 7)


def test_every_refusal_carries_its_code() -> None:
    codes: dict[type[Refusal], str] = {
        WithdrawalReasonRequired: "stock.withdrawal_reason_required",
        WithdrawalDateInFuture: "stock.withdrawal_date_in_future",
        WithdrawalNoLines: "stock.withdrawal_no_lines",
        WithdrawalQuantityNotPositive: "stock.withdrawal_grams_not_positive",
        WithdrawalQuantityTooPrecise: "stock.withdrawal_grams_too_precise",
        WithdrawalNoteTooLong: "stock.withdrawal_note_too_long",
        WithdrawalNotFound: "stock.withdrawal_not_found",
        WithdrawalVarietyNotFound: "stock.withdrawal_variety_not_found",
    }

    assert {cls: cls.code for cls in codes} == codes


def test_a_refusal_never_repeats_the_input() -> None:
    note = "secreto-del-festejo" + "x" * NOTE_MAX_LENGTH
    attempts: list[Callable[[], object]] = [
        lambda: _withdrawal(note=note),
        lambda: _line(quantity="12.3456"),
        lambda: _line(quantity="-7.77"),
        lambda: _line(quantity="grams-abc"),
        lambda: _withdrawal(reason="reason-xyz"),
        lambda: _withdrawal(withdrawn_on=date(2030, 1, 2)),
        lambda: _withdrawal(lines=()),
        lambda: _withdrawal(lines=(WithdrawalLine(variety_id=4242, quantity=Quantity(-1)),)),
    ]
    messages = []
    for attempt in attempts:
        with pytest.raises(ValueError) as caught:
            attempt()
        messages.append(str(caught.value))

    for message in messages:
        for leaked in ("secreto", "12.34", "7.77", "777", "abc", "xyz", "2030", "4242"):
            assert leaked not in message


def test_the_not_found_refusals_name_no_id() -> None:
    assert str(WithdrawalNotFound()) and not any(c.isdigit() for c in str(WithdrawalNotFound()))
    assert not any(c.isdigit() for c in str(WithdrawalVarietyNotFound()))
    assert isinstance(WithdrawalNotFound(), LookupError)
    assert isinstance(WithdrawalVarietyNotFound(), LookupError)
