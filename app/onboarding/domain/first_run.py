"""The first run of a business that is not in the Onboarding (CONTEXT.md: first-run
checklist, Onboarding; docs/adr/0046). Three facts the data cannot say are stored, each
stamped once and never cleared or moved; no checklist step is ever stored. Everything
else is derived on every read by `first_run_element`, the only place that decides slot 1
of Inicio's notices, the checklist's steps and the after-import notice."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

_SECOND_USER = 2


class Stamp(StrEnum):
    """The stored facts, named as their `first_run` columns."""

    CHECKLIST_GONE = "checklist_gone_at"
    IMPORTED = "imported_at"
    IMPORT_NOTICE_OVER = "import_notice_over_at"


class FirstRunKind(StrEnum):
    ONBOARDING = "onboarding"
    CHECKLIST = "checklist"
    START_VARIETIES = "start_varieties"
    NONE = "none"


class StepName(StrEnum):
    PRICED_VARIETY = "priced_variety"
    STOCK_ENTRY = "stock_entry"
    PUBLISHED = "published"
    SECOND_USER = "second_user"


@dataclass(frozen=True)
class FirstRun:
    """What is stored for one business: each stamp is `None` until it happened."""

    checklist_gone_at: datetime | None = None
    imported_at: datetime | None = None
    import_notice_over_at: datetime | None = None


@dataclass(frozen=True)
class ChecklistStep:
    step: StepName
    required: bool
    done: bool


@dataclass(frozen=True)
class FirstRunDecision:
    kind: FirstRunKind
    checklist: tuple[ChecklistStep, ...] | None
    import_notice: bool
    due: frozenset[Stamp]


def first_run_element(
    onboarding_open: bool | None,
    first_run: FirstRun | None,
    priced_today: bool,
    has_stock_entry: bool,
    has_ever_published: bool,
    user_count: int,
) -> FirstRunDecision:
    """`onboarding_open` is `None` when the business has no onboarding row, `True` while
    its Onboarding is open and `False` once it ended. Slot 1 takes the first rule that
    fits; the after-import notice is decided apart and may show beside any of them."""
    stored = first_run if first_run is not None else FirstRun()
    required_met = priced_today and has_stock_entry
    has_no_onboarding = onboarding_open is None

    if onboarding_open:
        kind = FirstRunKind.ONBOARDING
    elif (
        has_no_onboarding
        and stored.imported_at is None
        and stored.checklist_gone_at is None
        and not required_met
    ):
        kind = FirstRunKind.CHECKLIST
    elif not priced_today:
        kind = FirstRunKind.START_VARIETIES
    else:
        kind = FirstRunKind.NONE

    checklist = (
        (
            ChecklistStep(StepName.PRICED_VARIETY, required=True, done=priced_today),
            ChecklistStep(StepName.STOCK_ENTRY, required=True, done=has_stock_entry),
            ChecklistStep(StepName.PUBLISHED, required=False, done=has_ever_published),
            ChecklistStep(StepName.SECOND_USER, required=False, done=user_count >= _SECOND_USER),
        )
        if kind is FirstRunKind.CHECKLIST
        else None
    )

    imported = stored.imported_at is not None
    notice_open = stored.import_notice_over_at is None
    due: set[Stamp] = set()
    if has_no_onboarding and stored.checklist_gone_at is None and required_met:
        due.add(Stamp.CHECKLIST_GONE)
    if imported and notice_open and has_ever_published:
        due.add(Stamp.IMPORT_NOTICE_OVER)

    return FirstRunDecision(
        kind=kind,
        checklist=checklist,
        import_notice=imported and notice_open and not has_ever_published,
        due=frozenset(due),
    )
