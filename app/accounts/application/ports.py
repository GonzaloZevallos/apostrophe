from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.accounts.domain.account import Business, BusinessTimeZone, Email, User
from app.accounts.domain.invitation import Invitation
from app.shared.language import BusinessLanguage


@dataclass(frozen=True)
class LoginLocks:
    """The read-only state `log_in` needs to decide whether either brake is already
    active, before it counts anything (plan invariant: counting never moves an active
    lock). `email_locked_until` is `None` when `email` was not asked for — the
    malformed-email path, which never reads or writes an email-keyed row."""

    email_locked_until: datetime | None
    address_locked_until: datetime | None


class BusinessOpening(Protocol):
    """What a business needs set up for it beyond its own accounts rows, when it opens
    (docs/adr/0006). Accounts declares this port and never imports who implements it;
    `app/main.py` wires the real one in, and `accept_invitation` calls it before its
    single commit."""

    def opened(self, business_id: int, language: BusinessLanguage) -> None: ...


class Accounts(Protocol):
    """Identities and the ways in. The one store that is not scoped to a business: it is
    what decides which business a request belongs to. Writes are flushed, never
    committed (app/shared/transaction.py); `add_*` return the record with its id."""

    def add_business(self, business: Business) -> Business: ...

    def business(self, business_id: int) -> Business | None: ...

    def save_business(self, business: Business) -> None: ...

    def set_time_zone_if_different(self, business_id: int, zone: BusinessTimeZone) -> bool:
        """One `UPDATE business SET time_zone = :new WHERE id = :id AND time_zone != :new`;
        whether it changed a row (docs/adr/0057). `save_business` never writes the zone, so
        a stale read of another field cannot undo it."""
        ...

    def add_user(self, user: User) -> User: ...

    def users_of_business(self, business_id: int) -> list[User]: ...

    def user(self, user_id: int) -> User | None: ...

    def user_by_email(self, email: Email) -> User | None: ...

    def add_invitation(self, invitation: Invitation) -> Invitation: ...

    def invitation_by_digest(self, digest: str) -> Invitation | None: ...

    def save_invitation(self, invitation: Invitation) -> None: ...

    def login_locks(self, email: Email | None, address_digest: str) -> LoginLocks: ...

    def count_email_failure(self, email: Email, now: datetime) -> int: ...

    def count_address_failure(
        self, address_digest: str, now: datetime, cutoff: datetime
    ) -> int: ...

    def lock_email(
        self, email: Email, now: datetime, until: datetime, max_failures: int
    ) -> None: ...

    def lock_address(self, address_digest: str, now: datetime, until: datetime) -> None: ...

    def clear_email(self, email: Email, now: datetime) -> None: ...

    def unlock_email(self, email: Email) -> None:
        """Unguarded (docs/adr/0019): sets `failures = 0, locked_until = NULL`
        whatever the lock's state. Only a completed Reset calls it."""
        ...

    def set_password_hash(self, user_id: int, password_hash: str) -> None: ...

    def issue_reset_link(self, user_id: int, token_digest: str, created_at: datetime) -> None:
        """One upsert whose `business_id` comes from `user_id`'s own `app_user` row
        (docs/adr/0019): this port takes no `business_id`. Raises a fixed error if
        `user_id` names no user."""
        ...

    def reset_link_is_live(self, token_digest: str, cutoff: datetime) -> bool:
        """Read-only, over `token_digest = :d AND created_at > :cutoff` -- the same
        predicate `spend_reset_link` deletes by."""
        ...

    def spend_reset_link(self, token_digest: str, cutoff: datetime) -> int | None:
        """`DELETE … WHERE token_digest = :d AND created_at > :cutoff RETURNING
        user_id`; `None` when no row matched."""
        ...

    def delete_reset_links_of(self, user_id: int) -> None: ...
