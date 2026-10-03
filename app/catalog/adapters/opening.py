"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
default catalog header and footer, inside the same transaction that opens it. Accounts
never imports this module; `app/main.py` is the composition root that wires it in,
through `CompositeOpening` alongside `ExpenseCategoriesOpening`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogHeaderFooterRow
from app.catalog.domain.header_footer import DEFAULT_FOOTER, DEFAULT_HEADER


class CatalogHeaderFooterOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int) -> None:
        self._session.add(
            CatalogHeaderFooterRow(
                business_id=business_id, header=DEFAULT_HEADER, footer=DEFAULT_FOOTER
            )
        )
