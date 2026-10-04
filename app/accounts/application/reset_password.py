"""Issuing, looking up and spending a reset link (docs/adr/0019).

A row in `reset_link` exists only while its link could still work: issuing retires any
earlier one of the same user, and spending deletes the row outright. "Used" and
"retired" are therefore never states to check -- only expiry is, through the one
predicate `look_up_reset_link` and `reset_password` share.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import Email, InvalidEmail, check_password_strength
from app.accounts.domain.invitation import new_token, token_digest
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.reset_link import ResetLinkGone, expires_at, live_cutoff
from app.accounts.domain.session_token import SessionSigner
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class IssuedResetLink:
    """The token exists only here, once: the store keeps its digest."""

    token: str
    expires_at: datetime


def issue_reset_link(
    accounts: Accounts, transaction: Transaction, raw_email: str, now: datetime
) -> IssuedResetLink | None:
    """A malformed or unknown email answers `None` and writes nothing -- so the
    operator's terminal is the only place that ever learns whether an email has a
    user. A known email's new link replaces any earlier one of that user, through the
    one upsert `issue_reset_link` (the port method) performs."""
    try:
        email = Email.of(raw_email)
    except InvalidEmail:
        return None
    user = accounts.user_by_email(email)
    if user is None:
        return None
    assert user.id is not None
    token = new_token()
    accounts.issue_reset_link(user.id, token_digest(token), now)
    transaction.commit()
    return IssuedResetLink(token, expires_at(now))


def look_up_reset_link(accounts: Accounts, token: str, now: datetime) -> None:
    """Raises `ResetLinkGone` unless the link is live. Spends nothing: opening a link
    never costs it its one use."""
    if not accounts.reset_link_is_live(token_digest(token), live_cutoff(now)):
        raise ResetLinkGone()


def reset_password(
    accounts: Accounts,
    transaction: Transaction,
    hasher: PasswordHasher,
    signer: SessionSigner,
    token: str,
    new: str,
    now: datetime,
) -> str:
    """Spends the link and answers a fresh session token for this device
    (docs/adr/0019). The length check and the live check both run with no hashing; a
    token that has gone stale between them and the delete answers the same
    `ResetLinkGone` as an unknown one, and still computes no scrypt."""
    check_password_strength(new)

    cutoff = live_cutoff(now)
    if not accounts.reset_link_is_live(token_digest(token), cutoff):
        raise ResetLinkGone()

    password_hash = hasher.hash(new)

    user_id = accounts.spend_reset_link(token_digest(token), cutoff)
    if user_id is None:
        raise ResetLinkGone()

    accounts.set_password_hash(user_id, password_hash)
    accounts.delete_reset_links_of(user_id)
    user = accounts.user(user_id)
    assert user is not None, "spend_reset_link just returned this user's id"
    accounts.unlock_email(user.email)
    transaction.commit()
    return signer.issue(user_id, password_hash, now)
