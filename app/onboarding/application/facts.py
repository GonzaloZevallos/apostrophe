"""Reads the owners' facts through their ports, for one business, and hands them to
`progress()`. Read-only: nothing here writes."""

from __future__ import annotations

from dataclasses import dataclass

from app.onboarding.application.ports import BotFacts, StockFacts, UserFacts, VarietyFacts
from app.onboarding.domain.progress import Facts


@dataclass(frozen=True)
class FactSources:
    varieties: VarietyFacts
    stock: StockFacts
    bots: BotFacts
    users: UserFacts


def read_facts(sources: FactSources) -> Facts:
    return Facts(
        varieties=tuple(sources.varieties.varieties()),
        stocked_variety_ids=frozenset(sources.stock.stocked_variety_ids()),
        stock_entries_count=sources.stock.stock_entries_count(),
        bot_saved=sources.bots.is_bot_saved(),
        user_count=sources.users.user_count(),
    )
