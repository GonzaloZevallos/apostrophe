"""`StockImport` (`app/spreadsheet_import/application/ports.py`): the spreadsheet
import's only way into stock's tables (CODING_STANDARDS section 1; the plan's
invariant that no code under `app/spreadsheet_import/` reads, writes or counts
another capability's table directly).

`check_entry` runs `StockEntry.of` exactly as `record_entry` would, as if the row were
typed in by hand today, so an imported row is refused by the same rules (the PRD's
"same data as hand entry"). It never checks the variety against this business's
`VarietyCatalog`: the import's own plan cross-checks every sheet variety name against
Ajustes 7-16 through varieties' own port before any row reaches this one. The id this
method builds a `StockEntry` with to run the domain's rules is a local ordinal that
never leaves the call (the plan's invariant); it is never returned, stored or compared.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.grams import Grams
from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import Refusal
from app.spreadsheet_import.domain.rows import EntradaRow
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.adapters.tables import StockEntryRow
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.errors import (
    EntryCostInvalid,
    EntryCostOnNegativeAdjustment,
    EntryCostRequired,
    EntryDateInFuture,
    EntryGramsInvalid,
    EntryNoteTooLong,
)
from app.stock.domain.threshold import Threshold, ThresholdInvalid

# Never written, never returned: `StockEntry.of` needs a variety id to run its rules,
# but a check never reaches the database (the plan's invariant: ids inside an owner
# check are local ordinals that never leave that call).
_CHECK_VARIETY_ID = 0
# Never written: `StockEntry.of` needs a `recorded_at`, but no rule it runs reads it.
_CHECK_RECORDED_AT = datetime.min

# Entradas' own "Origen" values (Spanish, as the sheet shows them) mapped to stock's
# domain origin. Any other text is `import.origin_unknown`, the import's own fixed
# code: stock's domain has no such rule of its own, since a hand-entered form never
# lets an origin be anything else.
ORIGEN_WORDS = {
    "Compra": Origin.PURCHASE,
    "Cosecha": Origin.HARVEST,
    "Stock inicial": Origin.OPENING_STOCK,
    "Ajuste": Origin.ADJUSTMENT,
}

_ENTRY_ERRORS = (
    EntryDateInFuture,
    EntryGramsInvalid,
    EntryCostRequired,
    EntryCostInvalid,
    EntryCostOnNegativeAdjustment,
    EntryNoteTooLong,
)


class SqlStockImport:
    """`StockImport` over `SqlStockEntries` and `SqlThresholds`, for one business
    (ADR-0004)."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._entries = SqlStockEntries(session, business_id)
        self._thresholds = SqlThresholds(session, business_id)

    def has_records(self) -> bool:
        statement = (
            select(StockEntryRow.id).where(StockEntryRow.business_id == self._business_id).limit(1)
        )
        return self._session.scalar(statement) is not None

    def check_threshold(self, grams: Grams) -> Refusal | None:
        try:
            Threshold.of(grams)
        except ThresholdInvalid as exc:
            return Refusal(exc.code)
        return None

    def check_entry(self, row: EntradaRow, today: date) -> Refusal | None:
        if row.entry_date is None or row.variety is None or row.grams is None or row.origin is None:
            return Refusal("import.field_missing")
        origin = ORIGEN_WORDS.get(row.origin)
        if origin is None:
            return Refusal("import.origin_unknown")
        try:
            StockEntry.of(
                row.entry_date,
                _CHECK_VARIETY_ID,
                origin,
                row.grams,
                row.total_cost,
                row.note,
                today,
                _CHECK_RECORDED_AT,
            )
        except _ENTRY_ERRORS as exc:
            return Refusal(exc.code)
        return None

    def write_threshold(self, variety_id: int, grams: Grams, transaction: Transaction) -> None:
        self._thresholds.set(variety_id, Threshold.of(grams))
        transaction.commit()

    def write_entry(
        self,
        variety_id: int,
        row: EntradaRow,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
    ) -> None:
        assert row.entry_date is not None, "write_entry takes a checked, finished row"
        assert row.grams is not None, "write_entry takes a checked, finished row"
        assert row.origin is not None, "write_entry takes a checked, finished row"
        origin = ORIGEN_WORDS[row.origin]
        entry = StockEntry.of(
            row.entry_date,
            variety_id,
            origin,
            row.grams,
            row.total_cost,
            row.note,
            today,
            recorded_at,
        )
        self._entries.add(entry)
        transaction.commit()
