from dataclasses import dataclass
from datetime import datetime

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import Business, Email, InvalidEmail, User
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.shared.transaction import Transaction


class LoginLocked(Exception):
    def __init__(self) -> None:
        super().__init__("too many failed attempts; try again in a few minutes")


@dataclass(frozen=True)
class SignedIn:
    """Who is asking and, from that alone, which business every read and write is for."""

    user: User
    business: Business

    @property
    def business_id(self) -> int:
        assert self.business.id is not None
        return self.business.id


def log_in(
    accounts: Accounts,
    transaction: Transaction,
    hasher: PasswordHasher,
    signer: SessionSigner,
    raw_email: str,
    password: str,
    now: datetime,
) -> str | None:
    """A session token for the right email and password, `None` otherwise. Raises
    `LoginLocked` while the email is braked, whatever the password."""
    try:
        email = Email.of(raw_email)
    except InvalidEmail:
        hasher.burn(password)
        return None
    guard = accounts.login_guard(email)
    if guard.is_locked(now):
        raise LoginLocked()
    user = accounts.user_by_email(email)
    if user is None:
        hasher.burn(password)
    if user is None or not hasher.verify(password, user.password_hash):
        guard.record_failure(now)
        accounts.save_login_guard(email, guard)
        transaction.commit()
        return None
    guard.record_success()
    accounts.save_login_guard(email, guard)
    transaction.commit()
    assert user.id is not None
    return signer.issue(user.id, user.password_hash, now)


def open_session(
    accounts: Accounts, signer: SessionSigner, token: str, now: datetime
) -> SignedIn | None:
    claims = signer.read(token)
    if claims is None:
        return None
    user = accounts.user(claims.user_id)
    if user is None or not signer.is_open(claims, user.password_hash, now):
        return None
    business = accounts.business(user.business_id)
    assert business is not None, "a user always belongs to a business"
    return SignedIn(user, business)
