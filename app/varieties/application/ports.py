from typing import Protocol

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
