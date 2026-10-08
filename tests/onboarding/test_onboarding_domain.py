"""The Onboarding entity (CONTEXT.md: Onboarding): four optional-step passes and the
moment it ended. `end` sets that moment only while it is unset and never moves it."""

from datetime import UTC, datetime, timedelta

from app.onboarding.domain.onboarding import Onboarding, Pass

FIRST = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)


def test_a_new_onboarding_has_no_pass_and_has_not_ended() -> None:
    onboarding = Onboarding.opened()

    assert onboarding.header_footer is None
    assert onboarding.bot is None
    assert onboarding.partner is None
    assert onboarding.categories is None
    assert onboarding.ended_at is None


def test_end_sets_the_moment_while_it_is_unset() -> None:
    onboarding = Onboarding.opened()

    onboarding.end(FIRST)

    assert onboarding.ended_at == FIRST


def test_end_never_moves_a_moment_already_set() -> None:
    onboarding = Onboarding.opened()
    onboarding.end(FIRST)

    onboarding.end(FIRST + timedelta(hours=1))

    assert onboarding.ended_at == FIRST


def test_a_pass_knows_how_it_was_given() -> None:
    assert {Pass.DONE.value, Pass.SKIPPED.value} == {"done", "skipped"}
