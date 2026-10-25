"""The caller's own business: its name and its users (CODING_STANDARDS §9 — the
business comes only from the session, never from a path or body; these two use cases
take `business_id` from `CurrentBusinessId`, not from the caller)."""

import dataclasses
from dataclasses import dataclass

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import BusinessName
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class BusinessProfile:
    name: str
    user_emails: list[str]


def business_profile(accounts: Accounts, business_id: int) -> BusinessProfile:
    business = accounts.business(business_id)
    assert business is not None, "a signed-in user's business always exists"
    users = accounts.users_of_business(business_id)
    return BusinessProfile(business.name.value, [user.email.value for user in users])


def rename_business(
    accounts: Accounts, transaction: Transaction, business_id: int, raw_name: str
) -> BusinessProfile:
    """Reuses `BusinessName` (trimmed, inner spaces collapsed, at most 60 characters,
    not blank): the same rule a new business's name follows, with no uniqueness check
    across the installation (it would reveal that another business exists)."""
    name = BusinessName.of(raw_name)
    business = accounts.business(business_id)
    assert business is not None, "a signed-in user's business always exists"
    accounts.save_business(dataclasses.replace(business, name=name))
    transaction.commit()
    return business_profile(accounts, business_id)
