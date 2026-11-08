"""`ReasonName` and `WithdrawalReason` with no infrastructure (CODING_STANDARDS §5)."""

import pytest

from app.shared.names import name_key
from app.stock.domain.errors import (
    LastReason,
    ReasonHasWithdrawals,
    ReasonNameBlank,
    ReasonNameTooLong,
)
from app.stock.domain.withdrawal_reason import ReasonName, WithdrawalReason


def test_a_name_is_trimmed_and_collapsed() -> None:
    assert ReasonName.of("  Regalos   a  clientes ").value == "Regalos a clientes"


def test_a_name_exactly_at_the_limit_is_accepted() -> None:
    assert ReasonName.of("x" * 60).value == "x" * 60


@pytest.mark.parametrize("raw", ["", "   "])
def test_a_blank_name_is_refused(raw: str) -> None:
    with pytest.raises(ReasonNameBlank, match="needs a name"):
        ReasonName.of(raw)


def test_a_name_over_the_limit_is_refused() -> None:
    with pytest.raises(ReasonNameTooLong, match="at most 60 characters"):
        ReasonName.of("x" * 61)


def test_two_names_differing_only_in_case_or_spacing_share_a_key() -> None:
    assert ReasonName.of("Marketing").key == ReasonName.of("  MARKETING ").key
    assert ReasonName.of("Own  use").key == name_key("Own use")


def test_a_reason_with_no_withdrawals_and_company_is_removable() -> None:
    reason = WithdrawalReason(id=1, name=ReasonName.of("Marketing"), position=0)

    reason.check_removable(has_withdrawals=False, reason_count=2)  # does not raise


def test_a_reason_with_withdrawals_is_not_removable() -> None:
    reason = WithdrawalReason(id=1, name=ReasonName.of("Marketing"), position=0)

    with pytest.raises(ReasonHasWithdrawals, match="still has withdrawals"):
        reason.check_removable(has_withdrawals=True, reason_count=2)


def test_the_last_reason_is_not_removable() -> None:
    reason = WithdrawalReason(id=1, name=ReasonName.of("Marketing"), position=0)

    with pytest.raises(LastReason, match="at least one reason"):
        reason.check_removable(has_withdrawals=False, reason_count=1)


def test_a_refusal_never_repeats_the_name() -> None:
    reason = WithdrawalReason(id=1, name=ReasonName.of("Secret label"), position=0)

    with pytest.raises(ReasonHasWithdrawals) as caught:
        reason.check_removable(has_withdrawals=True, reason_count=1)

    assert "Secret label" not in str(caught.value)
