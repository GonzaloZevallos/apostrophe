"""Who recorded a Payment: the User's id and the initials copied when it was recorded
(docs/product/initials.md, ADR 20261125).

Standard library only (CODING_STANDARDS section 1). The error messages name the rule that
was broken, never the id or the initials.
"""

from __future__ import annotations

from dataclasses import dataclass

MAX_INITIALS = 32


class InvalidRecorder(ValueError):
    """A rule of `Recorder` was broken; the message says which, never the value."""


@dataclass(frozen=True)
class Recorder:
    app_user_id: int
    initials: str

    def __post_init__(self) -> None:
        if self.app_user_id <= 0:
            raise InvalidRecorder("A recorder's user id must be positive")
        if not self.initials:
            raise InvalidRecorder("A recorder's initials must not be empty")
        if len(self.initials) > MAX_INITIALS:
            raise InvalidRecorder(
                f"A recorder's initials must be at most {MAX_INITIALS} code points"
            )
