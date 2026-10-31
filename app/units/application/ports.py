from typing import Protocol

from app.shared.unit import Unit
from app.units.domain.unit import UnitDraft, UnitName


class Units(Protocol):
    """The units of one business: the business is fixed when the store is built, so
    nothing here reaches another business's units (docs/adr/0004). `add` and `save` write
    without committing and return the unit as stored."""

    def list(self) -> list[Unit]:
        """Every unit of the business, in the order it created them."""
        ...

    def by_id(self, unit_id: int) -> Unit | None: ...

    def by_name(self, name: UnitName) -> Unit | None:
        """The unit whose name is `name`, ignoring case and inner spaces."""
        ...

    def count(self) -> int: ...

    def add(self, draft: UnitDraft) -> Unit: ...

    def save(self, unit: Unit) -> Unit:
        """Stores the unit's name, label and decimals; a name another unit holds raises
        `UnitNameTaken`."""
        ...

    def lower_decimals(self, unit_id: int, decimals: int) -> bool:
        """Sets the unit's decimals in one guarded statement that holds the whole rule: it
        writes only while no recorded quantity of the unit's products is finer than
        `decimals`. Answers whether it wrote; nothing is committed."""
        ...

    def remove(self, unit_id: int) -> None:
        """Deletes the unit; one a product still references raises `UnitInUse`, the
        foreign key being the backstop of `UnitUse`."""
        ...


class UnitUse(Protocol):
    """How many products of the business use a unit, archived ones included. Declared here,
    implemented by a products adapter: units never reads the product table."""

    def products_using(self, unit_id: int) -> int: ...

    def products_per_unit(self) -> dict[int, int]:
        """The count for every unit some product uses; a unit no product uses is absent."""
        ...
