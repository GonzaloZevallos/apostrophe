from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import (
    Business,
    Email,
    InvalidEmail,
    User,
    check_password_strength,
)
from app.accounts.domain.login_guard import MAX_FAILURES, AddressGuard, LoginGuard
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.reset_link import CurrentPasswordWrong
from app.accounts.domain.session_token import SessionSigner
from app.shared.transaction import Transaction


class LoginLocked(Exception):
    code: ClassVar[str] = "account.login_locked"

    def __init__(self) -> None:
        super().__init__("too many failed attempts; try again in a few minutes")


def refuse_attempt(
    accounts: Accounts,
    transaction: Transaction,
    email: Email | None,
    address_digest: str,
    now: datetime,
    cutoff: datetime,
) -> None:
    """The brake's only counting sequence (docs/adr/0019): counts both brakes and
    commits before returning. When neither brake was already locked at the moment of
    the attempt, it locks whichever one the count just reached; while either is
    already active, it only counts -- it never sets a lock a future, no-longer-locked
    request would set on its own (the plan invariant: counting never moves an active
    lock). `log_in` and `change_password` are its only two callers; neither calls
    `count_email_failure` or `count_address_failure` itself.

    `email` is `None` for a malformed email (`log_in`'s own branch): no email-keyed
    row is read or written then, only the address counts, exactly as before this
    function existed."""
    locks = accounts.login_locks(email, address_digest)
    email_guard = LoginGuard(locks.email_locked_until)
    address_guard = AddressGuard(locks.address_locked_until)
    already_locked = email_guard.is_locked(now) or address_guard.is_locked(now)
    address_failures = accounts.count_address_failure(address_digest, now, cutoff)
    email_failures = accounts.count_email_failure(email, now) if email is not None else None
    if not already_locked:
        if email is not None and email_failures is not None and email_guard.reached(email_failures):
            accounts.lock_email(email, now, email_guard.lock_until(now), MAX_FAILURES)
        if address_guard.reached(address_failures):
            accounts.lock_address(address_digest, now, address_guard.lock_until(now))
    transaction.commit()


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
        # read or written, only the address counts. `refuse_attempt` is still the
        # only caller of `count_address_failure` (the plan invariant): it is told
        # `email=None` rather than being bypassed.
        hasher.burn(password)
        locks = accounts.login_locks(None, address_digest)
        address_guard = AddressGuard(locks.address_locked_until)
        already_locked = address_guard.is_locked(now)
        refuse_attempt(accounts, transaction, None, address_digest, now, cutoff)
        if already_locked:
            raise LoginLocked() from None
        return None

    locks = accounts.login_locks(email, address_digest)
    email_guard = LoginGuard(locks.email_locked_until)
    address_guard = AddressGuard(locks.address_locked_until)
    if email_guard.is_locked(now) or address_guard.is_locked(now):
        refuse_attempt(accounts, transaction, email, address_digest, now, cutoff)
        raise LoginLocked()

    user = accounts.user_by_email(email)
    if user is None:
        hasher.burn(password)
    if user is None or not hasher.verify(password, user.password_hash):
        refuse_attempt(accounts, transaction, email, address_digest, now, cutoff)
        return None

    accounts.clear_email(email, now)
    transaction.commit()
    assert user.id is not None
    return signer.issue(user.id, user.password_hash, now)


def change_password(
    accounts: Accounts,
    transaction: Transaction,
    hasher: PasswordHasher,
    signer: SessionSigner,
    user: User,
    current: str,
    new: str,
    address_digest: str,
    now: datetime,
) -> str:
    """Sets `user`'s password to `new` and answers a fresh session token for the
    acting device (docs/adr/0019). The checks run in a fixed order: the brake first
    (429, no scrypt), then the new password's length (422, counting nothing), then the
    current password (422 on a mismatch, counted for both brakes). On success the
    password is always rehashed, even when `new` equals the old one, so every other
    session of `user` fails its fingerprint check; the user's reset links are deleted
    and the email's brake cleared, in the one commit that closes this use case."""
    cutoff = AddressGuard().window_cutoff(now)
    locks = accounts.login_locks(user.email, address_digest)
    email_guard = LoginGuard(locks.email_locked_until)
    address_guard = AddressGuard(locks.address_locked_until)
    if email_guard.is_locked(now) or address_guard.is_locked(now):
        refuse_attempt(accounts, transaction, user.email, address_digest, now, cutoff)
        raise LoginLocked()

    check_password_strength(new)

    if not hasher.verify(current, user.password_hash):
        refuse_attempt(accounts, transaction, user.email, address_digest, now, cutoff)
        raise CurrentPasswordWrong()

    assert user.id is not None
    password_hash = hasher.hash(new)
    accounts.set_password_hash(user.id, password_hash)
    accounts.delete_reset_links_of(user.id)
    accounts.clear_email(user.email, now)
    transaction.commit()
    return signer.issue(user.id, password_hash, now)


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
