"""What a save of a business's money format changed (docs/adr/0080).

Two flags and nothing else: the router schedules the pinned catalog's upkeep when either
is true, and a save of the values already stored changes neither."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MoneyFormatChange:
    symbol_changed: bool
    decimals_changed: bool

    @property
    def any(self) -> bool:
        return self.symbol_changed or self.decimals_changed
