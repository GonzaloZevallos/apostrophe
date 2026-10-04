"""Implements the import's `CatalogImport` port
(`app/spreadsheet_import/application/ports.py`): checks and writes for catalog
attributes, header and footer, during a spreadsheet import. Only this module
translates one of the import's plain rows into the catalog's own domain objects; every
`Refusal` it answers carries the owner's own `code` alone, never the exception or its
message (the plan's invariant).

Writing reuses the catalog's own use cases (`set_variety_attributes`,
`set_header_footer`) so an imported attribute, header or footer is the same data,
checked by the same rules, as one entered by hand (PRD: "same data as hand entry").
Both commit through the `Transaction` the caller gives them, which is always
`NoCommit` during an import (the plan's invariant): nothing here ever commits itself.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.adapters.sql_header_footer import SqlCatalogHeaderFooter
from app.catalog.adapters.stock_status import StockStatusesFromStock
from app.catalog.application.set_header_footer import set_header_footer
from app.catalog.application.set_variety_attributes import set_variety_attributes
from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.errors import (
    AromaTooLong,
    EmojiInvalid,
    FooterTooLong,
    HeaderTooLong,
    IndicaShareInvalid,
)
from app.catalog.domain.header_footer import CatalogHeaderFooter
from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import Refusal
from app.spreadsheet_import.domain.rows import CatalogRow, HeaderFooterCells

# The sheet's own two values for Catálogo's "shown" column (import.md); anything else
# answers `import.shown_unknown` rather than being guessed either way.
_SHOWN: dict[str, bool] = {"Sí": True, "No": False}


def _indica_share(value: int | str | None) -> int | None:
    """`value` is already a whole number when the cell held one; a `str` means the
    cell held something else, which is the same rule break as a share out of range."""
    if isinstance(value, str):
        raise IndicaShareInvalid()
    return value


def _attributes_of(row: CatalogRow) -> CatalogAttributes:
    return CatalogAttributes.of(
        shown=_SHOWN[row.shown],
        emoji=row.emoji,
        indica_share=_indica_share(row.indica),
        aroma=row.aroma,
    )


class CatalogImport:
    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlCatalogVarieties(session, business_id)
        self._stock = StockStatusesFromStock(session, business_id)
        self._attributes_repo = SqlCatalogAttributes(session, business_id)
        self._header_footer_repo = SqlCatalogHeaderFooter(session, business_id)

    def check_attributes(self, row: CatalogRow) -> Refusal | None:
        if row.shown not in _SHOWN:
            return Refusal("import.shown_unknown")
        try:
            _attributes_of(row)
        except (EmojiInvalid, IndicaShareInvalid, AromaTooLong) as exc:
            return Refusal(exc.code)
        return None

    def check_header_footer(self, cells: HeaderFooterCells) -> Refusal | None:
        try:
            CatalogHeaderFooter.of(cells.header, cells.footer)
        except (HeaderTooLong, FooterTooLong) as exc:
            return Refusal(exc.code)
        return None

    def write_attributes(
        self, variety_id: int, row: CatalogRow, today: date, transaction: Transaction
    ) -> None:
        indica = row.indica
        assert not isinstance(indica, str), "check_attributes already refused this row"
        set_variety_attributes(
            self._varieties,
            self._stock,
            self._attributes_repo,
            self._header_footer_repo,
            transaction,
            variety_id,
            _SHOWN[row.shown],
            row.emoji,
            indica,
            row.aroma,
            today,
        )

    def write_header_footer(
        self, cells: HeaderFooterCells, today: date, transaction: Transaction
    ) -> None:
        set_header_footer(
            self._varieties,
            self._stock,
            self._attributes_repo,
            self._header_footer_repo,
            transaction,
            cells.header,
            cells.footer,
            today,
        )
