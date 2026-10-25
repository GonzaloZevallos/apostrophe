"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
default catalog header and footer in its stored language, inside the same transaction that
opens it. Accounts never imports this module; `app/main.py` is the composition root that
wires it in, through `CompositeOpening` alongside `ExpenseCategoriesOpening`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogHeaderFooterRow
from app.catalog.application.ports import HeaderFooterDefaults
from app.shared.language import BusinessLanguage


class CatalogHeaderFooterOpening:
    def __init__(self, session: Session, defaults: HeaderFooterDefaults) -> None:
        self._session = session
        self._defaults = defaults

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        defaults = self._defaults.for_language(language.language)
        self._session.add(
            CatalogHeaderFooterRow(
                business_id=business_id, header=defaults.header, footer=defaults.footer
            )
        )
