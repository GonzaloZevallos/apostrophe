"""In-memory stand-ins for the Onboarding's ports, for use-case tests."""

from dataclasses import dataclass, field

from app.onboarding.application.facts import FactSources
from app.onboarding.domain.onboarding import Onboarding
from app.onboarding.domain.progress import VarietyFact


class FakeOnboardings:
    def __init__(self, stored: Onboarding | None) -> None:
        self.stored = stored
        self.saves = 0

    def get(self) -> Onboarding | None:
        return self.stored

    def save(self, onboarding: Onboarding) -> None:
        self.stored = onboarding
        self.saves += 1


@dataclass
class FakeTransaction:
    commits: int = 0
    rollbacks: int = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


@dataclass
class FakeFacts:
    """One fake that plays the four fact ports; tests move its fields between calls."""

    varieties_list: list[VarietyFact] = field(default_factory=list)
    stocked: set[int] = field(default_factory=set)
    entries: int = 0
    bot_saved: bool = False
    users: int = 1

    def varieties(self) -> list[VarietyFact]:
        return list(self.varieties_list)

    def stocked_variety_ids(self) -> set[int]:
        return set(self.stocked)

    def stock_entries_count(self) -> int:
        return self.entries

    def is_bot_saved(self) -> bool:
        return self.bot_saved

    def user_count(self) -> int:
        return self.users

    def sources(self) -> FactSources:
        return FactSources(varieties=self, stock=self, bots=self, users=self)

    def price_and_stock_one_variety(self) -> None:
        self.varieties_list = [VarietyFact(1, "Amnesia", True)]
        self.stocked = {1}
        self.entries = 1
