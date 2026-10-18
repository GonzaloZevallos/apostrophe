"""The Onboarding's use cases over fake ports: each writes and commits once through the
`Transaction`, or writes nothing and commits nothing."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest

from app.onboarding.application.use_cases import advance, read_progress, record_pass, skip_rest
from app.onboarding.domain.errors import OnboardingNotFound, RequiredStepsUnmet, StepInvalid
from app.onboarding.domain.onboarding import Onboarding, Pass
from app.onboarding.domain.progress import FINISH, Progress, StepState
from app.onboarding.domain.steps import Step
from tests.onboarding.fakes import FakeFacts, FakeOnboardings, FakeTransaction

NOW = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
LATER = NOW + timedelta(hours=2)


Write = Callable[[FakeOnboardings, FakeTransaction, FakeFacts], Progress]


def _pass(onboardings: FakeOnboardings, transaction: FakeTransaction, facts: FakeFacts) -> Progress:
    return record_pass(onboardings, facts.sources(), transaction, LATER, step=3, as_="done")


def _skip_rest(
    onboardings: FakeOnboardings, transaction: FakeTransaction, facts: FakeFacts
) -> Progress:
    return skip_rest(onboardings, facts.sources(), transaction, LATER)


def _advance(
    onboardings: FakeOnboardings, transaction: FakeTransaction, facts: FakeFacts
) -> Progress:
    return advance(onboardings, facts.sources(), transaction, LATER)


WRITES: list[Write] = [_pass, _skip_rest, _advance]


def opened() -> FakeOnboardings:
    return FakeOnboardings(Onboarding.opened())


def test_read_progress_derives_the_answer_and_writes_nothing() -> None:
    onboardings = opened()
    facts = FakeFacts()
    facts.price_and_stock_one_variety()

    result = read_progress(onboardings, facts.sources())

    assert result is not None
    assert result.resume == Step.CATALOG_MESSAGE
    assert onboardings.saves == 0


def test_read_progress_of_a_business_with_no_onboarding_is_not_offered() -> None:
    assert read_progress(FakeOnboardings(None), FakeFacts().sources()) is None


def test_the_last_optional_pass_ends_the_onboarding_in_one_commit() -> None:
    onboardings = FakeOnboardings(Onboarding(Pass.DONE, Pass.SKIPPED, Pass.DONE, None))
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    transaction = FakeTransaction()

    result = record_pass(onboardings, facts.sources(), transaction, NOW, step=6, as_="done")

    assert result.over is True
    assert result.resume is None
    assert onboardings.stored is not None
    assert onboardings.stored.categories is Pass.DONE
    assert onboardings.stored.ended_at == NOW
    assert transaction.commits == 1


def test_a_pass_that_leaves_an_optional_step_pending_does_not_end_it() -> None:
    onboardings = opened()
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    transaction = FakeTransaction()

    result = record_pass(onboardings, facts.sources(), transaction, NOW, step=3, as_="skipped")

    assert result.over is False
    assert result.state_of(Step.CATALOG_MESSAGE) is StepState.SKIPPED
    assert result.resume == Step.BOT
    assert transaction.commits == 1


def test_a_pass_is_recorded_without_ending_while_step_one_is_unmet() -> None:
    onboardings = FakeOnboardings(Onboarding(Pass.DONE, Pass.DONE, Pass.DONE, None))
    facts = FakeFacts()
    facts.entries = 1
    transaction = FakeTransaction()

    result = record_pass(onboardings, facts.sources(), transaction, NOW, step=6, as_="done")

    assert result.over is False
    assert result.resume == Step.VARIETY
    assert onboardings.stored is not None
    assert onboardings.stored.categories is Pass.DONE
    assert onboardings.stored.ended_at is None
    assert transaction.commits == 1


def test_advance_ends_the_onboarding_after_the_price_returns() -> None:
    onboardings = FakeOnboardings(Onboarding(Pass.DONE, Pass.DONE, Pass.DONE, Pass.DONE))
    facts = FakeFacts()
    facts.entries = 1
    transaction = FakeTransaction()

    unmet = advance(onboardings, facts.sources(), transaction, NOW)
    facts.price_and_stock_one_variety()
    met = advance(onboardings, facts.sources(), transaction, LATER)

    assert unmet.over is False
    assert unmet.resume == Step.VARIETY
    assert met.over is True
    assert onboardings.stored is not None
    assert onboardings.stored.ended_at == LATER


def test_advance_does_not_end_while_an_optional_step_is_pending() -> None:
    onboardings = opened()
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    transaction = FakeTransaction()

    result = advance(onboardings, facts.sources(), transaction, NOW)

    assert result.over is False
    assert result.resume == Step.CATALOG_MESSAGE
    assert onboardings.saves == 0
    assert transaction.commits == 0


def test_advance_in_the_finish_state_ends_it() -> None:
    onboardings = FakeOnboardings(Onboarding(Pass.DONE, Pass.DONE, Pass.DONE, Pass.DONE))
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    before = read_progress(onboardings, facts.sources())

    result = advance(onboardings, facts.sources(), FakeTransaction(), NOW)

    assert before is not None
    assert before.resume == FINISH
    assert result.over is True


def test_skip_rest_is_refused_while_a_required_step_is_unmet() -> None:
    onboardings = opened()
    facts = FakeFacts()
    facts.entries = 1
    transaction = FakeTransaction()

    with pytest.raises(RequiredStepsUnmet):
        skip_rest(onboardings, facts.sources(), transaction, NOW)

    assert onboardings.saves == 0
    assert transaction.commits == 0


def test_skip_rest_skips_every_step_not_done_or_passed_and_ends_it() -> None:
    onboardings = FakeOnboardings(Onboarding(header_footer=Pass.DONE))
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    facts.bot_saved = True
    transaction = FakeTransaction()

    result = skip_rest(onboardings, facts.sources(), transaction, NOW)

    assert result.over is True
    assert onboardings.stored is not None
    assert onboardings.stored.header_footer is Pass.DONE
    assert onboardings.stored.bot is None
    assert onboardings.stored.partner is Pass.SKIPPED
    assert onboardings.stored.categories is Pass.SKIPPED
    assert onboardings.stored.ended_at == NOW
    assert transaction.commits == 1


@pytest.mark.parametrize("write", WRITES)
def test_a_write_on_an_onboarding_already_over_stores_nothing(write: Write) -> None:
    ended = Onboarding(ended_at=NOW)
    facts = FakeFacts()
    facts.price_and_stock_one_variety()
    onboardings = FakeOnboardings(ended)
    transaction = FakeTransaction()

    result = write(onboardings, transaction, facts)

    assert result.over is True
    assert onboardings.saves == 0
    assert transaction.commits == 0
    assert ended == Onboarding(ended_at=NOW)


def test_the_end_never_moves_once_set() -> None:
    onboardings = FakeOnboardings(Onboarding(Pass.DONE, Pass.DONE, Pass.DONE, Pass.DONE))
    facts = FakeFacts()
    facts.price_and_stock_one_variety()

    advance(onboardings, facts.sources(), FakeTransaction(), NOW)
    advance(onboardings, facts.sources(), FakeTransaction(), LATER)
    skip_rest(onboardings, facts.sources(), FakeTransaction(), LATER)

    assert onboardings.stored is not None
    assert onboardings.stored.ended_at == NOW


@pytest.mark.parametrize(
    ("step", "as_"),
    [
        (1, "done"),
        (2, "skipped"),
        (0, "done"),
        (7, "done"),
        (-1, "done"),
        (3, "pending"),
        (3, ""),
        (4, "DONE"),
    ],
)
def test_an_invalid_step_or_way_is_refused_and_stores_nothing(step: int, as_: str) -> None:
    onboardings = opened()
    transaction = FakeTransaction()

    with pytest.raises(StepInvalid):
        record_pass(onboardings, FakeFacts().sources(), transaction, NOW, step=step, as_=as_)

    assert onboardings.saves == 0
    assert transaction.commits == 0


def test_a_pass_is_recorded_on_each_optional_step() -> None:
    onboardings = opened()
    facts = FakeFacts()

    for step in (3, 4, 5, 6):
        record_pass(onboardings, facts.sources(), FakeTransaction(), NOW, step=step, as_="done")

    assert onboardings.stored == Onboarding(Pass.DONE, Pass.DONE, Pass.DONE, Pass.DONE)


@pytest.mark.parametrize("write", WRITES)
def test_every_write_with_no_onboarding_raises_not_found_and_commits_nothing(write: Write) -> None:
    onboardings = FakeOnboardings(None)
    transaction = FakeTransaction()

    with pytest.raises(OnboardingNotFound):
        write(onboardings, transaction, FakeFacts())

    assert onboardings.saves == 0
    assert transaction.commits == 0
