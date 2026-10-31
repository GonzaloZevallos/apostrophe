from typing import Protocol

from app.shared.unit import Unit
from app.units.domain.unit import UnitDraft, UnitName


class Units(Protocol):
    """The units of one business: the business is fixed when the store is built, so
    nothing here reaches another business's units (docs/adr/0004). `add` writes without
    committing and returns the unit as stored."""

    def add(self, draft: UnitDraft) -> Unit: ...

    def by_name(self, name: UnitName) -> Unit | None:
        """The unit whose name is `name`, ignoring case and inner spaces."""
        ...
