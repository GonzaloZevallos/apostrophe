"""Inicio's setup state, decided in one place (CONTEXT.md: Setup checklist, Bot notice).

`setup_view` is the only code that says whether the checklist or the bot notice shows,
and whether "gone" has to be stored. It is pure: the stored facts and the business's
facts come in, the whole answer goes out; reading and writing both belong to the use
case around it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

StepId = Literal["priced_variety", "stock_entry", "bot_published", "partner"]


@dataclass(frozen=True)
class StoredSetup:
    """Inicio's two stored facts, each only ever turned on."""

    checklist_gone: bool
    bot_notice_dismissed: bool


@dataclass(frozen=True)
class SetupFacts:
    priced_today: bool
    has_stock_entry: bool
    has_sale: bool
    ever_published: bool
    has_partner: bool


@dataclass(frozen=True)
class Step:
    step: StepId
    done: bool
    required: bool


@dataclass(frozen=True)
class SetupView:
    checklist: tuple[Step, ...] | None
    priced_today: bool
    bot_notice: bool
    mark_gone: bool


def setup_view(stored: StoredSetup, facts: SetupFacts) -> SetupView:
    gone = stored.checklist_gone or (facts.priced_today and facts.has_stock_entry)
    checklist = None if gone else _steps(facts)
    bot_notice = (
        gone
        and (facts.has_sale or facts.has_stock_entry)
        and not facts.ever_published
        and not stored.bot_notice_dismissed
    )
    return SetupView(
        checklist=checklist,
        priced_today=facts.priced_today,
        bot_notice=bot_notice,
        mark_gone=gone and not stored.checklist_gone,
    )


def _steps(facts: SetupFacts) -> tuple[Step, ...]:
    return (
        Step("priced_variety", facts.priced_today, required=True),
        Step("stock_entry", facts.has_stock_entry, required=True),
        Step("bot_published", facts.ever_published, required=False),
        Step("partner", facts.has_partner, required=False),
    )
