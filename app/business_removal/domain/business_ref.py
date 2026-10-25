"""The one business a run names, from the email it was given (CONTEXT.md: Business).

A frozen dataclass, validated in `__post_init__` (CODING_STANDARDS section 2): a
`BusinessRef` reached anywhere in the removal always names a real, persisted business.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BusinessRef:
    id: int
    name: str
    language: str

    def __post_init__(self) -> None:
        if self.id <= 0:
            raise ValueError("a business ref needs a positive id")
        if not self.name:
            raise ValueError("a business ref needs a name")
        if not self.language:
            raise ValueError("a business ref needs a language")
