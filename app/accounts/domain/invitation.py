"""Invitations: the only way into the app (CONTEXT.md: Invitation; docs/adr/0002).

A new-business invitation opens a business of its own; a join invitation adds a user to
the business that issued it. Either works once and expires after seven days. Only a
digest of the token is stored, so reading the database never yields a usable link.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import ClassVar

INVITATION_LIFETIME = timedelta(days=7)
TOKEN_BYTES = 32


class InvitationKind(StrEnum):
    NEW_BUSINESS = "new_business"
    JOIN_BUSINESS = "join_business"


class InvitationNotUsable(Exception):
    """Unknown, used or expired: the three look the same from outside on purpose."""

    code: ClassVar[str] = "account.invitation_not_usable"

    def __init__(self) -> None:
        super().__init__("this invitation does not exist, was used or expired")


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class Invitation:
    kind: InvitationKind
    token_digest: str
    created_at: datetime
    business_id: int | None = None
    used_at: datetime | None = None
    id: int | None = None

    def __post_init__(self) -> None:
        if self.kind is InvitationKind.JOIN_BUSINESS:
            if self.business_id is None:
                raise ValueError("a join invitation names its business")
        else:
            # A new-business invitation names no business until it is used: `use`
            # records the business it opened, never before.
            if (self.business_id is not None) != (self.used_at is not None):
                raise ValueError(
                    "a new-business invitation names its business only once it is used"
                )

    @property
    def expires_at(self) -> datetime:
        return self.created_at + INVITATION_LIFETIME

    def is_usable(self, now: datetime) -> bool:
        return self.used_at is None and now < self.expires_at

    def use(self, now: datetime, opened_business_id: int | None = None) -> None:
        """Spends the invitation. A new-business invitation records the business it
        opened; a join invitation already names its business and takes no id here."""
        if not self.is_usable(now):
            raise InvitationNotUsable()
        if self.kind is InvitationKind.NEW_BUSINESS:
            if opened_business_id is None:
                raise ValueError("a new-business invitation must record the business it opened")
            self.business_id = opened_business_id
        elif opened_business_id is not None:
            raise ValueError("a join invitation already names its business")
        self.used_at = now
