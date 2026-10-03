"""A variety's low-stock threshold (CONTEXT.md: Low-stock threshold).

Optional, per variety, above zero, with the same two-decimal precision `Grams.of`
already enforces at the parsing boundary. `Threshold.of` only adds "above zero": zero
or a negative threshold would mean "never low", which turning the threshold off
already means — the one it is set to is never one of those two values.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from app.shared.grams import Grams


class ThresholdInvalid(ValueError):
    code: ClassVar[str] = "stock.threshold_invalid"


@dataclass(frozen=True)
class Threshold:
    grams: Grams

    def __post_init__(self) -> None:
        if not self.grams.is_positive:
            raise ThresholdInvalid("a low-stock threshold is above zero")

    @classmethod
    def of(cls, grams: Grams) -> Threshold:
        return cls(grams)
