from typing import Protocol

from app.varieties.domain.variety import NameHolder, Variety, VarietyName


class Varieties(Protocol):
    """The varieties of one business: the business is fixed when the store is built,
    so nothing here can reach another business's varieties (docs/adr/0004). `add` and
    `save` write without committing and return the variety as stored, with every id."""

    def add(self, variety: Variety) -> Variety: ...

    def get(self, variety_id: int) -> Variety | None:
        """Any variety of the business, archived or not."""
        ...

    def listed(self) -> list[Variety]:
        """The unarchived varieties, by name. There is no read that picks for the caller:
        a caller chooses `listed` or `archived`, or `get` and reads `is_archived`."""
        ...

    def archived(self) -> list[Variety]:
        """The archived varieties, by name."""
        ...

    def save(self, variety: Variety) -> Variety: ...

    def name_holder(
        self, name: VarietyName, *, other_than: int | None = None
    ) -> NameHolder | None:
        """Who holds `name` in this business, archived varieties included."""
        ...
