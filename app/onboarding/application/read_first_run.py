"""`GET /first-run`'s use case (docs/adr/0046): reads what the business has, through the
owners' ports, and hands it to `first_run_element`, the only place that decides slot 1,
the checklist's steps and the after-import notice. It issues no DML: the stamps it finds
due are written by `settle_first_run`, after the answer is built."""

from __future__ import annotations

from dataclasses import dataclass

from app.onboarding.application.ports import (
    BotFacts,
    CatalogFacts,
    FirstRuns,
    Onboardings,
    StockFacts,
    UserFacts,
    VarietyFacts,
)
from app.onboarding.domain.first_run import FirstRunDecision, FirstRunKind, first_run_element


@dataclass(frozen=True)
class FirstRunSources:
    onboardings: Onboardings
    first_runs: FirstRuns
    varieties: VarietyFacts
    stock: StockFacts
    bots: BotFacts
    users: UserFacts
    catalog: CatalogFacts


@dataclass(frozen=True)
class FirstRunRead:
    decision: FirstRunDecision
    nothing_qualifies: bool


def read_first_run(sources: FirstRunSources) -> FirstRunRead:
    onboarding = sources.onboardings.get()
    decision = first_run_element(
        onboarding_open=None if onboarding is None else onboarding.ended_at is None,
        first_run=sources.first_runs.get(),
        priced_today=any(fact.is_priced_today for fact in sources.varieties.varieties()),
        has_stock_entry=sources.stock.stock_entries_count() > 0,
        has_ever_published=sources.bots.has_ever_published(),
        user_count=sources.users.user_count(),
    )
    # Only the checklist's "+ Nueva venta" / "Mandar catálogo" rule needs it, and it costs
    # a qualification pass, so every other kind answers `False` without paying for it.
    nothing_qualifies = (
        decision.kind is FirstRunKind.CHECKLIST and not sources.catalog.any_qualifies()
    )
    return FirstRunRead(decision=decision, nothing_qualifies=nothing_qualifies)
