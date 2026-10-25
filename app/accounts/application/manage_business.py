"""The caller's own business: its name and its users (CODING_STANDARDS §9 — the
business comes only from the session, never from a path or body; these two use cases
take `business_id` from `CurrentBusinessId`, not from the caller)."""

import dataclasses
from collections.abc import Collection
from dataclasses import dataclass

from app.accounts.application.ports import Accounts
from app.accounts.domain.account import BusinessName
from app.shared.language import BusinessLanguage, Language
from app.shared.transaction import Transaction


@dataclass(frozen=True)
class BusinessProfile:
    name: str
    user_emails: list[str]
    # The stored tag, never the shown one (docs/adr/0050).
    language: str


def business_profile(accounts: Accounts, business_id: int) -> BusinessProfile:
    business = accounts.business(business_id)
    assert business is not None, "a signed-in user's business always exists"
    users = accounts.users_of_business(business_id)
    return BusinessProfile(
        business.name.value,
        [user.email.value for user in users],
        business.language.language.tag,
    )


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


def change_business_language(
    accounts: Accounts,
    transaction: Transaction,
    business_id: int,
    raw_tag: str,
    selectable: Collection[Language],
) -> bool:
    """Answers whether the stored language changed. The value is parsed against the
    selectable list first, so one that is not selectable is refused even when it is the
    one already stored; choosing the stored language writes and commits nothing."""
    language = BusinessLanguage.parse(raw_tag, selectable)
    business = accounts.business(business_id)
    assert business is not None, "a signed-in user's business always exists"
    if business.language == language:
        return False
    accounts.save_business(dataclasses.replace(business, language=language))
    transaction.commit()
    return True
