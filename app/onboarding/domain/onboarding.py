"""The Onboarding (CONTEXT.md: Onboarding): what the data cannot say about a brand-new
business's first run -- how each optional step was passed, and when it ended
(docs/adr/0032). Everything else (done, count, resume) is derived on every read."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class Pass(StrEnum):
    """How an optional step was passed: `DONE` for "Guardar", "Dejar así", a
    successful Probarlo or "Seguir"; `SKIPPED` for "Saltar" and "Saltar el resto"."""

    DONE = "done"
    SKIPPED = "skipped"


@dataclass
class Onboarding:
    header_footer: Pass | None = None
    bot: Pass | None = None
    partner: Pass | None = None
    categories: Pass | None = None
    ended_at: datetime | None = None

    @classmethod
    def opened(cls) -> Onboarding:
        return cls()

    def end(self, at: datetime) -> None:
        """Sets the end only while there is none; it never moves and nothing clears it."""
        if self.ended_at is None:
            self.ended_at = at
