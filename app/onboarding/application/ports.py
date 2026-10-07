"""The port the Onboarding declares over its own storage (docs/adr/0006). Built for one
business; a repository writes but never commits (CODING_STANDARDS section 9)."""

from __future__ import annotations

from typing import Protocol

from app.onboarding.domain.onboarding import Onboarding


class Onboardings(Protocol):
    def get(self) -> Onboarding | None:
        """This business's Onboarding, or `None` when it is not offered one."""
        ...

    def save(self, onboarding: Onboarding) -> None:
        """Writes the passes and the end of an Onboarding that exists; flushes."""
        ...
