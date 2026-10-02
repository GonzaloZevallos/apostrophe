from typing import Protocol

from app.accounts.domain.account import Business, Email, User
from app.accounts.domain.invitation import Invitation
from app.accounts.domain.login_guard import LoginGuard


class BusinessOpening(Protocol):
    """What a business needs set up for it beyond its own accounts rows, when it opens
    (docs/adr/0006). Accounts declares this port and never imports who implements it;
    `app/main.py` wires the real one in, and `accept_invitation` calls it before its
    single commit."""

    def opened(self, business_id: int) -> None: ...


class Accounts(Protocol):
    """Identities and the ways in. The one store that is not scoped to a business: it is
    what decides which business a request belongs to. Writes are flushed, never
    committed (app/shared/transaction.py); `add_*` return the record with its id."""

    def add_business(self, business: Business) -> Business: ...

    def business(self, business_id: int) -> Business | None: ...

    def save_business(self, business: Business) -> None: ...

    def add_user(self, user: User) -> User: ...

    def users_of_business(self, business_id: int) -> list[User]: ...

    def user(self, user_id: int) -> User | None: ...

    def user_by_email(self, email: Email) -> User | None: ...

    def add_invitation(self, invitation: Invitation) -> Invitation: ...

    def invitation_by_digest(self, digest: str) -> Invitation | None: ...

    def save_invitation(self, invitation: Invitation) -> None: ...

    def login_guard(self, email: Email) -> LoginGuard: ...

    def save_login_guard(self, email: Email, guard: LoginGuard) -> None: ...
