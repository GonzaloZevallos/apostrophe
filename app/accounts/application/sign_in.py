from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import Business, Email, InvalidEmail, User
from app.accounts.domain.login_guard import MAX_FAILURES, AddressGuard, LoginGuard
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.shared.transaction import Transaction


class LoginLocked(Exception):
    code: ClassVar[str] = "account.login_locked"

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
    address_digest: str,
    now: datetime,
) -> str | None:
    """A session token for the right email and password, `None` otherwise. Raises
    `LoginLocked` while the email or the address is braked, whatever the password
    (docs/adr/0002). Every refusal counts against the address; a refusal with a
    parseable email counts against that email too, including one refused under an
    active lock. A success resets only the email's count."""
    cutoff = AddressGuard().window_cutoff(now)
    try:
        email = Email.of(raw_email)
    except InvalidEmail:
        # A malformed email is never stored (plan invariant): no email-keyed row is
        # read or written, only the address counts.
        hasher.burn(password)
        locks = accounts.login_locks(None, address_digest)
        address_guard = AddressGuard(locks.address_locked_until)
        already_locked = address_guard.is_locked(now)
        address_failures = accounts.count_address_failure(address_digest, now, cutoff)
        if not already_locked and address_guard.reached(address_failures):
            accounts.lock_address(address_digest, now, address_guard.lock_until(now))
        transaction.commit()
        if already_locked:
            raise LoginLocked() from None
        return None

    locks = accounts.login_locks(email, address_digest)
    email_guard = LoginGuard(locks.email_locked_until)
    address_guard = AddressGuard(locks.address_locked_until)
    if email_guard.is_locked(now) or address_guard.is_locked(now):
        # Counting never moves an active lock (plan invariant): no lock_* call here.
        accounts.count_email_failure(email, now)
        accounts.count_address_failure(address_digest, now, cutoff)
        transaction.commit()
        raise LoginLocked()

    user = accounts.user_by_email(email)
    if user is None:
        hasher.burn(password)
    if user is None or not hasher.verify(password, user.password_hash):
        email_failures = accounts.count_email_failure(email, now)
        address_failures = accounts.count_address_failure(address_digest, now, cutoff)
        if email_guard.reached(email_failures):
            accounts.lock_email(email, now, email_guard.lock_until(now), MAX_FAILURES)
        if address_guard.reached(address_failures):
            accounts.lock_address(address_digest, now, address_guard.lock_until(now))
        transaction.commit()
        return None

    accounts.clear_email(email, now)
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
