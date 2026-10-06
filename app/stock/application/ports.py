from collections.abc import Collection
from typing import Protocol

from app.stock.domain.entry import StockEntry
from app.stock.domain.lot_order import SaleLineDraw
from app.stock.domain.threshold import Threshold


class StockEntries(Protocol):
    """The stock entries of one business (docs/adr/0004): built for it, every
    statement filters on it, and it never commits (CODING_STANDARDS section 9) — the
    use case commits once, through `Transaction`. `add` and `save` write without
    committing and return the entry as stored, with its id."""

    def by_id(self, entry_id: int) -> StockEntry | None: ...

    def add(self, entry: StockEntry) -> StockEntry: ...

    def save(self, entry: StockEntry) -> StockEntry: ...

    def remove(self, entry_id: int) -> None: ...

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        """Every stock entry of this business; `None` for every variety, a set to
        narrow to just those (`read_stock`'s full sweep against `line_costs`'s own
        variety, ADR-0009's performance note)."""
        ...


class Draws(Protocol):
    """Sale-line draws on a variety's stock (CONTEXT.md: Draw), read only — a sale's
    own repository owns the write (docs/adr/0004). Built for one business."""

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[SaleLineDraw]:
        """Every sale-line draw of this business; `None` for every variety, a set to
        narrow to just those."""
        ...


class Thresholds(Protocol):
    """A business's low-stock thresholds (CONTEXT.md: Low-stock threshold). Built for
    one business; never commits — the use case commits once, through `Transaction`.
    Turning a threshold off deletes its row rather than storing a null (`clear`)."""

    def get(self, variety_id: int) -> Threshold | None: ...

    def all(self) -> dict[int, Threshold]: ...

    def set(self, variety_id: int, threshold: Threshold) -> None: ...

    def clear(self, variety_id: int) -> None: ...


class VarietyCatalog(Protocol):
    """Whether a variety id belongs to this business, for a stock use case that takes
    one (docs/adr/0004). Built for one business; stock's application layer never
    imports `app.varieties` (CODING_STANDARDS section 1) — only its adapters do."""

    def exists(self, variety_id: int) -> bool: ...

    def listed_ids(self) -> list[int]:
        """The ids of this business's unarchived varieties, for a use case that walks
        them all (`read_stock`'s per-variety rows) rather than looking one up at a time."""
        ...
