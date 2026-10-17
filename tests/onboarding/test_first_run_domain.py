"""`first_run_element` (docs/adr/0046): which first-run element slot 1 shows, whether the
after-import notice shows, and which stamps are due -- a pure function of the stored
facts and four data facts, no infrastructure."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime

from app.onboarding.domain.first_run import (
    ChecklistStep,
    FirstRun,
    FirstRunDecision,
    FirstRunKind,
    Stamp,
    StepName,
    first_run_element,
)

AT = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
NOTHING = FirstRun()


def decide(
    onboarding_open: bool | None = None,
    first_run: FirstRun | None = None,
    priced_today: bool = False,
    has_stock_entry: bool = False,
    has_ever_published: bool = False,
    user_count: int = 1,
) -> FirstRunDecision:
    return first_run_element(
        onboarding_open,
        first_run,
        priced_today,
        has_stock_entry,
        has_ever_published,
        user_count,
    )


def test_an_open_onboarding_is_the_element_whatever_the_data_says() -> None:
    decision = decide(onboarding_open=True, priced_today=True, has_stock_entry=True)

    assert decision.kind is FirstRunKind.ONBOARDING
    assert decision.checklist is None
    assert decision.due == frozenset()


def test_a_business_before_the_onboarding_with_steps_unmet_gets_the_checklist() -> None:
    decision = decide(priced_today=True)

    assert decision.kind is FirstRunKind.CHECKLIST
    assert decision.checklist == (
        ChecklistStep(StepName.PRICED_VARIETY, required=True, done=True),
        ChecklistStep(StepName.STOCK_ENTRY, required=True, done=False),
        ChecklistStep(StepName.PUBLISHED, required=False, done=False),
        ChecklistStep(StepName.SECOND_USER, required=False, done=False),
    )
    assert decision.due == frozenset()


def test_the_optional_steps_are_marked_from_the_data_and_never_hold_the_checklist() -> None:
    decision = decide(has_ever_published=True, user_count=2)

    assert decision.kind is FirstRunKind.CHECKLIST
    assert decision.checklist is not None
    assert [(s.step, s.done) for s in decision.checklist] == [
        (StepName.PRICED_VARIETY, False),
        (StepName.STOCK_ENTRY, False),
        (StepName.PUBLISHED, True),
        (StepName.SECOND_USER, True),
    ]

    gone = decide(priced_today=True, has_stock_entry=True)
    assert gone.kind is FirstRunKind.NONE


def test_the_checklist_goes_when_both_required_steps_are_met_and_stamps_it() -> None:
    decision = decide(priced_today=True, has_stock_entry=True)

    assert decision.kind is FirstRunKind.NONE
    assert decision.checklist is None
    assert decision.due == frozenset({Stamp.CHECKLIST_GONE})


def test_the_checklist_never_returns_once_it_has_gone() -> None:
    gone = FirstRun(checklist_gone_at=AT)

    decision = decide(first_run=gone, priced_today=False, has_stock_entry=False)

    assert decision.kind is FirstRunKind.START_VARIETIES
    assert decision.checklist is None
    assert decision.due == frozenset()
    assert decide(first_run=gone, priced_today=True).kind is FirstRunKind.NONE


def test_an_ended_onboarding_never_gets_the_checklist_or_a_stamp() -> None:
    decision = decide(onboarding_open=False, priced_today=True, has_stock_entry=True)

    assert decision.kind is FirstRunKind.NONE
    assert decision.due == frozenset()
    assert decide(onboarding_open=False).kind is FirstRunKind.START_VARIETIES


def test_an_imported_business_never_gets_the_checklist() -> None:
    imported = FirstRun(imported_at=AT)

    assert decide(first_run=imported).kind is FirstRunKind.START_VARIETIES
    assert decide(first_run=imported, priced_today=True).kind is FirstRunKind.NONE


def test_start_varieties_when_no_variety_is_priced_after_the_checklist_is_out_of_the_way() -> None:
    assert decide(onboarding_open=False).kind is FirstRunKind.START_VARIETIES
    assert decide(onboarding_open=False, priced_today=True).kind is FirstRunKind.NONE


def test_the_import_notice_shows_from_the_import_until_dismissed_or_published() -> None:
    imported = FirstRun(imported_at=AT)

    assert decide(first_run=imported).import_notice is True
    assert decide(first_run=imported, has_ever_published=True).import_notice is False
    over = replace(imported, import_notice_over_at=AT)
    assert decide(first_run=over).import_notice is False


def test_no_import_notice_for_a_business_that_was_not_imported() -> None:
    assert decide().import_notice is False
    assert decide(first_run=FirstRun(checklist_gone_at=AT)).import_notice is False
    assert decide(onboarding_open=True).import_notice is False


def test_the_import_notice_alongside_any_element() -> None:
    imported = FirstRun(imported_at=AT)

    assert decide(onboarding_open=True, first_run=imported).import_notice is True
    assert decide(first_run=imported, priced_today=True).import_notice is True


def test_publishing_after_the_import_stamps_the_notice_over_once() -> None:
    imported = FirstRun(imported_at=AT)

    due = decide(first_run=imported, has_ever_published=True).due
    assert due == frozenset({Stamp.IMPORT_NOTICE_OVER})

    over = replace(imported, import_notice_over_at=AT)
    assert decide(first_run=over, has_ever_published=True).due == frozenset()
    assert decide(first_run=imported).due == frozenset()
    assert decide(first_run=NOTHING, has_ever_published=True).due == frozenset()


def test_both_stamps_can_be_due_together() -> None:
    imported_without_gone = FirstRun(imported_at=AT)

    decision = decide(
        first_run=imported_without_gone,
        priced_today=True,
        has_stock_entry=True,
        has_ever_published=True,
    )

    assert decision.due == frozenset({Stamp.CHECKLIST_GONE, Stamp.IMPORT_NOTICE_OVER})


def test_a_stamp_already_set_is_never_due_again() -> None:
    both = FirstRun(checklist_gone_at=AT, imported_at=AT, import_notice_over_at=AT)

    decision = decide(
        first_run=both, priced_today=True, has_stock_entry=True, has_ever_published=True
    )

    assert decision.due == frozenset()
