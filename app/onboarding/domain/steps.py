"""The six steps of the Onboarding, in order (CONTEXT.md: Onboarding). The first two are
required; the other four are optional and are the only ones a pass can be recorded for."""

from __future__ import annotations

from enum import IntEnum
from typing import Final


class Step(IntEnum):
    VARIETY = 1
    STOCK = 2
    CATALOG_MESSAGE = 3
    BOT = 4
    PARTNER = 5
    CATEGORIES = 6


REQUIRED_STEPS: Final = (Step.VARIETY, Step.STOCK)
OPTIONAL_STEPS: Final = (Step.CATALOG_MESSAGE, Step.BOT, Step.PARTNER, Step.CATEGORIES)
