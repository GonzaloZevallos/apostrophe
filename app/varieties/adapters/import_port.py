"""`VarietiesImport` (`app/spreadsheet_import/application/ports.py`) over varieties'
own tables and domain rules (CODING_STANDARDS section 1; the plan's invariant: an
owner's import adapter writes only its own hexagon's tables).

`check_price_history` builds one `Variety` per key and replays `PriceEntry.of` and
`Variety.record_price` against it, so the duplicate-effective-date rule — and every
other rule `Variety.record_price` enforces — runs over a row's whole history at once,
never one row at a time against the database. No `Variety` and no database id crosses
back through `VarietiesImport`: a row's result is its own rule's code, or nothing.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import Refusal, VarietyKey
from app.spreadsheet_import.domain.rows import PriceHistoryRow
from app.varieties.adapters.sql_varieties import SqlVarieties
from app.varieties.adapters.tables import PriceEntryRow, VarietyRow
from app.varieties.application.manage_prices import record_imported_price_entry
from app.varieties.application.manage_varieties import register_variety
from app.varieties.application.ports import Varieties
from app.varieties.domain.variety import (
    InvalidName,
    PriceEntry,
    Variety,
    VarietyName,
    VarietyRuleBroken,
)


class VarietiesImport:
    """`VarietiesImport` for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def has_records(self) -> bool:
        statement = (
            select(func.count())
            .select_from(VarietyRow)
            .where(VarietyRow.business_id == self._business_id)
        )
        if self._session.scalar(statement):
            return True
        statement = (
            select(func.count())
            .select_from(PriceEntryRow)
            .where(PriceEntryRow.business_id == self._business_id)
        )
        return bool(self._session.scalar(statement))

    def check_name(self, raw: str) -> VarietyKey | Refusal:
        try:
            name = VarietyName.of(raw)
        except InvalidName as exc:
            return Refusal(code=exc.code)
        return VarietyKey(key=name.key, name=name.value)

    def check_price_history(
        self, rows: Sequence[PriceHistoryRow], keys: Mapping[str, str]
    ) -> Sequence[Refusal | None]:
        varieties: dict[str, Variety] = {}
        results: list[Refusal | None] = []
        for row in rows:
            key = keys[row.variety]
            variety = varieties.get(key)
            if variety is None:
                variety = Variety(VarietyName.of(row.variety))
                varieties[key] = variety
            try:
                entry = PriceEntry.of(
                    row.effective,
                    row.list_price,
                    row.bulk_price,
                    row.bulk_minimum,
                    vip_price=row.bulk_price,
                )
                variety.record_price(entry)
            except VarietyRuleBroken as exc:
                results.append(Refusal(code=exc.code))
                continue
            results.append(None)
        return results

    def write_variety(self, name: str, transaction: Transaction) -> int:
        variety = register_variety(self._varieties(), transaction, name)
        assert variety.id is not None
        return variety.id

    def write_price_entry(
        self,
        variety_id: int,
        row: PriceHistoryRow,
        transaction: Transaction,
        *,
        with_vip_price: bool = True,
    ) -> None:
        # An imported entry with a bulk price carries VIP price = bulk price, so a VIP
        # customer keeps paying what the sheet charged — but only while the import
        # leaves Clientes VIP on: a rule that is off stores nothing (docs/adr/0031).
        record_imported_price_entry(
            self._varieties(),
            transaction,
            variety_id,
            row.effective,
            row.list_price,
            row.bulk_price,
            row.bulk_minimum,
            vip_price=row.bulk_price if with_vip_price else None,
        )

    def _varieties(self) -> Varieties:
        return SqlVarieties(self._session, self._business_id)
