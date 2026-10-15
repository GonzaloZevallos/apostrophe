"""The port the Onboarding declares over its own storage (docs/adr/0006). Built for one
business; a repository writes but never commits (CODING_STANDARDS section 9)."""

from __future__ import annotations

from typing import Protocol

from app.onboarding.domain.onboarding import Onboarding
from app.onboarding.domain.progress import VarietyFact


class Onboardings(Protocol):
    def get(self) -> Onboarding | None:
        """This business's Onboarding, or `None` when it is not offered one."""
        ...

    def save(self, onboarding: Onboarding) -> None:
        """Writes the passes and the end of an Onboarding that exists; flushes."""
        ...


class VarietyFacts(Protocol):
    """Read-only, implemented in `varieties`' adapters."""

    def varieties(self) -> list[VarietyFact]:
        """The listed (unarchived) varieties of the business, in Variedades' name order:
        id, name and whether it has a price today. The order is part of the contract: the
        Onboarding's step-1 targets follow it and the domain never sorts by name."""
        ...


class StockFacts(Protocol):
    """Read-only, implemented in `stock`'s adapters."""

    def stocked_variety_ids(self) -> set[int]:
        """The ids of the varieties that have at least one stock entry."""
        ...

    def stock_entries_count(self) -> int: ...


class BotFacts(Protocol):
    """Read-only, implemented in `pinned_catalog`'s adapters."""

    def is_bot_saved(self) -> bool: ...


class UserFacts(Protocol):
    """Read-only, implemented in `accounts`' adapters."""

    def user_count(self) -> int: ...
