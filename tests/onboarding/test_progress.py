"""progress() (CONTEXT.md: Onboarding): done, passed, count, resume and the targets, all
derived from read-only facts and the stored passes; pure and total."""

from datetime import UTC, datetime

import pytest

from app.onboarding.domain.onboarding import Onboarding, Pass
from app.onboarding.domain.progress import (
    FINISH,
    Facts,
    StepState,
    Target,
    VarietyFact,
    progress,
)
from app.onboarding.domain.steps import Step

ENDED = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)


def facts(
    varieties: tuple[VarietyFact, ...] = (),
    stocked: frozenset[int] = frozenset(),
    entries: int = 0,
    bot_saved: bool = False,
    users: int = 1,
) -> Facts:
    return Facts(
        varieties=varieties,
        stocked_variety_ids=stocked,
        stock_entries_count=entries,
        bot_saved=bot_saved,
        user_count=users,
    )


def onboarding(
    header_footer: Pass | None = None,
    bot: Pass | None = None,
    partner: Pass | None = None,
    categories: Pass | None = None,
    ended_at: datetime | None = None,
) -> Onboarding:
    return Onboarding(header_footer, bot, partner, categories, ended_at)


PRICED = VarietyFact(1, "Amnesia", True)
UNPRICED = VarietyFact(2, "Gelato", False)

ALL_PASSED_ARGS = (Pass.DONE, Pass.DONE, Pass.DONE, Pass.DONE)
ALL_PASSED = onboarding(*ALL_PASSED_ARGS)


def states(result_facts: Facts, stored: Onboarding) -> dict[int, StepState]:
    return {s.step.value: s.state for s in progress(result_facts, stored).steps}


def test_a_fresh_onboarding_has_six_pending_steps_and_resumes_at_the_first() -> None:
    result = progress(facts(), onboarding())

    assert [s.step for s in result.steps] == list(Step)
    assert {s.state for s in result.steps} == {StepState.PENDING}
    assert result.count == 0
    assert result.resume == Step.VARIETY
    assert result.over is False
    assert result.can_skip_rest is False


def test_step_one_is_done_when_some_variety_is_priced_today() -> None:
    assert states(facts((UNPRICED,)), onboarding())[1] == StepState.PENDING
    assert states(facts((UNPRICED, PRICED)), onboarding())[1] == StepState.DONE


def test_step_two_is_done_when_a_stock_entry_exists() -> None:
    assert states(facts(entries=0), onboarding())[2] == StepState.PENDING
    assert states(facts(entries=1), onboarding())[2] == StepState.DONE


def test_steps_three_and_six_follow_their_pass_only() -> None:
    assert states(facts(), onboarding())[3] == StepState.PENDING
    assert states(facts(), onboarding(header_footer=Pass.DONE))[3] == StepState.DONE
    assert states(facts(), onboarding(header_footer=Pass.SKIPPED))[3] == StepState.SKIPPED
    assert states(facts(), onboarding())[6] == StepState.PENDING
    assert states(facts(), onboarding(categories=Pass.DONE))[6] == StepState.DONE
    assert states(facts(), onboarding(categories=Pass.SKIPPED))[6] == StepState.SKIPPED


def test_step_four_is_done_by_a_saved_bot_or_its_done_pass_and_skipped_by_its_skip() -> None:
    assert states(facts(bot_saved=True), onboarding())[4] == StepState.DONE
    assert states(facts(), onboarding(bot=Pass.DONE))[4] == StepState.DONE
    assert states(facts(), onboarding(bot=Pass.SKIPPED))[4] == StepState.SKIPPED
    assert states(facts(bot_saved=True), onboarding(bot=Pass.SKIPPED))[4] == StepState.DONE


def test_step_five_is_done_by_a_second_user_or_its_done_pass_and_skipped_by_its_skip() -> None:
    assert states(facts(users=1), onboarding())[5] == StepState.PENDING
    assert states(facts(users=2), onboarding())[5] == StepState.DONE
    assert states(facts(users=1), onboarding(partner=Pass.DONE))[5] == StepState.DONE
    assert states(facts(users=1), onboarding(partner=Pass.SKIPPED))[5] == StepState.SKIPPED
    assert states(facts(users=3), onboarding(partner=Pass.SKIPPED))[5] == StepState.DONE


def test_the_count_is_the_steps_done_or_skipped() -> None:
    result = progress(facts((PRICED,), entries=1, users=2), onboarding(header_footer=Pass.SKIPPED))

    assert result.count == 4


def test_resume_is_the_first_pending_step() -> None:
    assert progress(facts((PRICED,)), onboarding()).resume == Step.STOCK
    assert progress(facts((PRICED,), entries=1), onboarding()).resume == Step.CATALOG_MESSAGE
    assert (
        progress(facts((PRICED,), entries=1), onboarding(header_footer=Pass.DONE)).resume
        == Step.BOT
    )


def test_resume_skips_an_optional_step_passed_out_of_order() -> None:
    result = progress(facts(), onboarding(header_footer=Pass.DONE, bot=Pass.SKIPPED))

    assert result.resume == Step.VARIETY


def test_resume_is_finish_when_every_step_is_done_or_passed_and_it_has_not_ended() -> None:
    result = progress(facts((PRICED,), entries=1), ALL_PASSED)

    assert result.resume == FINISH
    assert result.count == 6
    assert result.over is False


def test_resume_is_none_only_when_it_has_ended() -> None:
    ended_in_the_middle = progress(facts(), onboarding(ended_at=ENDED))
    ended_at_the_end = progress(
        facts((PRICED,), entries=1), onboarding(*ALL_PASSED_ARGS, ended_at=ENDED)
    )

    assert ended_in_the_middle.over is True
    assert ended_in_the_middle.resume is None
    assert ended_at_the_end.over is True
    assert ended_at_the_end.resume is None


@pytest.mark.parametrize("ended_at", [None, ENDED], ids=["open", "ended"])
@pytest.mark.parametrize("given", [None, Pass.SKIPPED, Pass.DONE])
@pytest.mark.parametrize("entries", [0, 3])
@pytest.mark.parametrize("varieties", [(), (UNPRICED,), (PRICED, UNPRICED)])
def test_resume_is_none_exactly_when_over(
    ended_at: datetime | None,
    given: Pass | None,
    entries: int,
    varieties: tuple[VarietyFact, ...],
) -> None:
    stored = onboarding(given, given, given, given, ended_at)

    result = progress(facts(varieties, entries=entries), stored)

    assert (result.resume is None) == (ended_at is not None)


def test_can_skip_rest_needs_both_required_steps_done() -> None:
    assert progress(facts((PRICED,)), onboarding()).can_skip_rest is False
    assert progress(facts(entries=1), onboarding()).can_skip_rest is False
    assert progress(facts((PRICED,), entries=1), onboarding()).can_skip_rest is True


def test_can_skip_rest_is_false_once_it_is_over() -> None:
    result = progress(facts((PRICED,), entries=1), onboarding(ended_at=ENDED))

    assert result.can_skip_rest is False


def test_the_counts_are_the_varieties_and_the_stock_entries() -> None:
    result = progress(facts((PRICED, UNPRICED), entries=5), onboarding())

    assert result.varieties_count == 2
    assert result.stock_entries_count == 5


def test_the_price_target_is_the_lowest_id_variety_with_no_price_today() -> None:
    unsorted = (VarietyFact(9, "Zkittlez", False), PRICED, VarietyFact(4, "Runtz", False))

    assert progress(facts(unsorted), onboarding()).price_target == Target(4, "Runtz")
    assert progress(facts((PRICED,)), onboarding()).price_target is None
    assert progress(facts(), onboarding()).price_target is None


def test_the_stock_target_is_the_lowest_id_priced_variety_with_no_entry() -> None:
    varieties = (
        VarietyFact(7, "Zkittlez", True),
        VarietyFact(3, "Runtz", True),
        VarietyFact(1, "Gelato", True),
        VarietyFact(2, "Cookies", False),
    )

    result = progress(facts(varieties, stocked=frozenset({1}), entries=1), onboarding())

    assert result.stock_target == Target(3, "Runtz")


def test_the_stock_target_is_none_when_every_priced_variety_has_stock_or_none_is_priced() -> None:
    stocked = progress(facts((PRICED,), stocked=frozenset({1}), entries=1), onboarding())
    unpriced = progress(facts((UNPRICED,)), onboarding())

    assert stocked.stock_target is None
    assert unpriced.stock_target is None


def test_a_stock_entry_of_an_unpriced_variety_is_not_a_target_for_stock() -> None:
    result = progress(facts((UNPRICED,), stocked=frozenset(), entries=0), onboarding())

    assert result.stock_target is None
    assert result.price_target == Target(2, "Gelato")
