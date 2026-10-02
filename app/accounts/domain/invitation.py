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

INVITATION_LIFETIME = timedelta(days=7)
TOKEN_BYTES = 32


class InvitationKind(StrEnum):
    NEW_BUSINESS = "new_business"
    JOIN_BUSINESS = "join_business"


class InvitationNotUsable(Exception):
    """Unknown, used or expired: the three look the same from outside on purpose."""

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
        joins = self.kind is InvitationKind.JOIN_BUSINESS
        if joins != (self.business_id is not None):
            raise ValueError("a join invitation names its business; a new-business one does not")

    @property
    def expires_at(self) -> datetime:
        return self.created_at + INVITATION_LIFETIME

    def is_usable(self, now: datetime) -> bool:
        return self.used_at is None and now < self.expires_at

    def use(self, now: datetime) -> None:
        if not self.is_usable(now):
            raise InvitationNotUsable()
        self.used_at = now
