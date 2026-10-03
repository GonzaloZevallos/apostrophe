"""The `CatalogHeaderFooterRepository` port over `catalog_header_footer`. Built for one
business; a business with no row is an integrity error (the plan's invariant: there is
no silent default — every business gets one row when it opens, through
`CatalogHeaderFooterOpening`).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogHeaderFooterRow
from app.catalog.domain.header_footer import CatalogHeaderFooter


class SqlCatalogHeaderFooter:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self) -> CatalogHeaderFooter:
        row = self._row()
        assert row is not None, "every business has a catalog_header_footer row"
        return CatalogHeaderFooter.of(row.header, row.footer)

    def put(self, header_footer: CatalogHeaderFooter) -> None:
        row = self._row()
        assert row is not None, "every business has a catalog_header_footer row"
        row.header = header_footer.header
        row.footer = header_footer.footer
        self._session.flush()

    def _row(self) -> CatalogHeaderFooterRow | None:
        statement = select(CatalogHeaderFooterRow).where(
            CatalogHeaderFooterRow.business_id == self._business_id
        )
        return self._session.scalar(statement)
