from enum import Enum
from typing import Protocol

from app.varieties.domain.variety import Variety, VarietyName


class NameHolder(Enum):
    """Who holds a name within the business: a live variety or an archived one."""

    LIVE = "live"
    ARCHIVED = "archived"


class Varieties(Protocol):
    """The varieties of one business: the business is fixed when the store is built,
    so nothing here can reach another business's varieties (docs/adr/0004). `add` and
    `save` write without committing and return the variety as stored, with every id.
    There is no `all()`: a reader chooses `listed()` or `archived()`, or `get()` and
    reads `is_archived` itself."""

    def add(self, variety: Variety) -> Variety: ...

    def get(self, variety_id: int) -> Variety | None: ...

    def listed(self) -> list[Variety]: ...

    def archived(self) -> list[Variety]: ...

    def save(self, variety: Variety) -> Variety: ...

    def name_holder(
        self, name: VarietyName, *, other_than: int | None = None
    ) -> NameHolder | None: ...
