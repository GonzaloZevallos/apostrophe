"""`CatalogLanguage` over `accounts` (docs/adr/0050): the language the catalog's texts are
shown in, the operator's forced one when set, else the business's stored one. The only
catalog module that imports `app.accounts`, and the only place the catalog applies the
forced override.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.shared.language import ENGLISH, Language, shown_language


class SqlCatalogLanguage:
    def __init__(self, session: Session, forced: Language | None) -> None:
        self._accounts = SqlAccounts(session)
        self._forced = forced

    def language_of(self, business_id: int) -> Language:
        """A business that is gone answers English: its catalog is built from nothing
        and no stored language is substituted. A corrupt stored language propagates
        (`StoredLanguageCorrupt`), as on every other screen."""
        business = self._accounts.business(business_id)
        if business is None:
            return ENGLISH
        return shown_language(business.language, self._forced)
