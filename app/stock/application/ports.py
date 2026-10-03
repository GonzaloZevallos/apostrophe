from typing import Protocol

from app.stock.domain.entry import StockEntry


class StockEntries(Protocol):
    """The stock entries of one business (docs/adr/0004): built for it, every
    statement filters on it, and it never commits (CODING_STANDARDS section 9) — the
    use case commits once, through `Transaction`. `add` and `save` write without
    committing and return the entry as stored, with its id."""

    def by_id(self, entry_id: int) -> StockEntry | None: ...

    def add(self, entry: StockEntry) -> StockEntry: ...

    def save(self, entry: StockEntry) -> StockEntry: ...

    def remove(self, entry_id: int) -> None: ...


class VarietyCatalog(Protocol):
    """Whether a variety id belongs to this business, for a stock use case that takes
    one (docs/adr/0004). Built for one business; stock's application layer never
    imports `app.varieties` (CODING_STANDARDS section 1) — only its adapters do."""

    def exists(self, variety_id: int) -> bool: ...

    def ids(self) -> list[int]:
        """Every variety id of this business, for a use case that walks all of them
        (`read_stock`'s per-variety sweep) rather than looking one up at a time."""
        ...
