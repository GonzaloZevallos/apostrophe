from typing import Protocol

from app.shared.pricing_settings import PricingSettings
from app.varieties.domain.variety import Variety, VarietyName


class Varieties(Protocol):
    """The varieties of one business: the business is fixed when the store is built,
    so nothing here can reach another business's varieties (docs/adr/0004). `add` and
    `save` write without committing and return the variety as stored, with every id."""

    def add(self, variety: Variety) -> Variety: ...

    def get(self, variety_id: int) -> Variety | None: ...

    def all(self) -> list[Variety]: ...

    def save(self, variety: Variety) -> Variety: ...

    def name_taken(self, name: VarietyName, *, other_than: int | None = None) -> bool: ...


class PricingSettingsReader(Protocol):
    """The business's pricing switches, read through the one port varieties declares for
    them (docs/adr/0006); the pricing_settings hexagon implements it, wired in
    `app/main.py`. A business with no row is an error, never a default (docs/adr/0031)."""

    def current(self) -> PricingSettings: ...
