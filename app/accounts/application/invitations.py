from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.accounts.application.ports import Accounts, BusinessOpening
from app.accounts.domain.account import (
    Business,
    BusinessName,
    Email,
    User,
    check_password_strength,
)
from app.accounts.domain.invitation import (
    Invitation,
    InvitationKind,
    InvitationNotUsable,
    new_token,
    token_digest,
)
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.shared.language import ENGLISH, BusinessLanguage
from app.shared.transaction import Transaction


class EmailTaken(ValueError):
    code: ClassVar[str] = "account.email_taken"

    def __init__(self) -> None:
        super().__init__("that email already has a user")


@dataclass(frozen=True)
class IssuedInvitation:
    """The token exists only here, once: the store keeps its digest."""

    token: str
    expires_at: datetime


@dataclass(frozen=True)
class InvitationView:
    kind: InvitationKind
    # The business a join invitation leads to; `None` for a new business.
    business_name: str | None
    expires_at: datetime


def invite_new_business(
    accounts: Accounts, transaction: Transaction, now: datetime
) -> IssuedInvitation:
    return _issue(accounts, transaction, InvitationKind.NEW_BUSINESS, None, now)


def invite_partner(
    accounts: Accounts, transaction: Transaction, business_id: int, now: datetime
) -> IssuedInvitation:
    return _issue(accounts, transaction, InvitationKind.JOIN_BUSINESS, business_id, now)


def look_up_invitation(accounts: Accounts, token: str, now: datetime) -> InvitationView:
    invitation = _usable(accounts, token, now)
    business = None if invitation.business_id is None else accounts.business(
        invitation.business_id
    )
    return InvitationView(
        kind=invitation.kind,
        business_name=None if business is None else business.name.value,
        expires_at=invitation.expires_at,
    )


def accept_invitation(
    accounts: Accounts,
    transaction: Transaction,
    hasher: PasswordHasher,
    signer: SessionSigner,
    token: str,
    raw_email: str,
    password: str,
    raw_business_name: str | None,
    now: datetime,
    *,
    opening: BusinessOpening,
) -> str:
    """Creates the user (and, for a new-business invitation, the business), spends the
    invitation and answers a session token for the new user. A join invitation ignores
    any business name: the business is the one that invited.

    `opening` sets up whatever a brand-new business needs beyond its own accounts rows
    (docs/adr/0006); it is called only on the new-business branch, before the single
    commit, so it lands in the same transaction or not at all."""
    invitation = _usable(accounts, token, now)
    email = Email.of(raw_email)
    check_password_strength(password)
    opens_business = invitation.kind is InvitationKind.NEW_BUSINESS
    name = BusinessName.of(raw_business_name or "") if opens_business else None
    if accounts.user_by_email(email) is not None:
        raise EmailTaken()
    if name is not None:
        business_id = accounts.add_business(Business(name, BusinessLanguage(ENGLISH))).id
        assert business_id is not None
        opening.opened(business_id)
    else:
        business_id = invitation.business_id
    assert business_id is not None
    password_hash = hasher.hash(password)
    user = accounts.add_user(User(business_id, email, password_hash, joined_at=now))
    invitation.use(now, business_id if opens_business else None)
    accounts.save_invitation(invitation)
    transaction.commit()
    assert user.id is not None
    return signer.issue(user.id, password_hash, now)


def _issue(
    accounts: Accounts,
    transaction: Transaction,
    kind: InvitationKind,
    business_id: int | None,
    now: datetime,
) -> IssuedInvitation:
    token = new_token()
    invitation = accounts.add_invitation(Invitation(kind, token_digest(token), now, business_id))
    transaction.commit()
    return IssuedInvitation(token, invitation.expires_at)


def _usable(accounts: Accounts, token: str, now: datetime) -> Invitation:
    invitation = accounts.invitation_by_digest(token_digest(token))
    if invitation is None or not invitation.is_usable(now):
        raise InvitationNotUsable()
    return invitation
