"""Implements the `MoneyFormatWriter` port: a business's decimals, and the one-time rescale
of its stored amounts from whole units (scale 0) to hundredths (scale 2) (docs/adr/0080, amending
docs/adr/0058).

All in the caller's transaction, which it never commits:

1. Raising above 0 runs `UPDATE money_format SET scale = 2 WHERE ... AND scale = 0`. The
   statement takes SQLite's write lock, and it changes a row only the first time.
2. Only then does every column tagged `info["money"]` in `app.tables.metadata` get
   multiplied by 100, each checked inside the transaction.
3. `decimals` is written only when it differs; a lower is then checked against the
   amounts already recorded, by one `EXISTS` per tagged column, filtered on the business.
4. `symbol` is written only when it differs. Both writes tell the caller what changed
   through their row counts, so a save of the values already stored reports nothing.

The scale is read and written here with this module's own SQL, never through `app.db`'s
`money_scale_factor`: that would cache a factor, and the commit-time guard would take this
change for a stale writer and roll it back. The columns come only from the metadata tags,
never from a list written by hand, and every statement filters on the one business.
"""

from __future__ import annotations

from typing import cast

from sqlalchemy import Table, exists, func, select, update
from sqlalchemy.engine import Connection
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import MoneyFormatMissing
from app.money_format.adapters.tables import MoneyFormatRow
from app.money_format.domain.change import MoneyFormatChange
from app.money_format.domain.rescale import (
    AmountTooLargeToRescale,
    DecimalsBelowRecordedAmounts,
    RescaleBusy,
    RescaleCheckFailed,
)
from app.shared.money import SCALE_FACTORS, MoneyFormat
from app.tables import metadata

_HUNDREDTHS_SCALE = 2
_FACTOR = SCALE_FACTORS[1]
_LARGEST_STORED = 2**63 - 1
_LARGEST_BEFORE_RESCALE, _ = divmod(_LARGEST_STORED, _FACTOR)
_money_format = cast(Table, MoneyFormatRow.__table__)


def _looks_locked(text: str) -> bool:
    lowered = text.lower()
    return "locked" in lowered or "busy" in lowered


class SqlMoneyFormatWriter:
    def __init__(self, session: Session) -> None:
        self._session = session

    def apply(self, business_id: int, money_format: MoneyFormat) -> MoneyFormatChange:
        busy = False
        overflowed = False
        try:
            change = self._apply(self._session.connection(), business_id, money_format)
        except OperationalError as exc:
            # The driver's message is read here and never kept: only a flag leaves.
            text = str(exc.orig).lower()
            if "integer overflow" in text:
                overflowed = True
            elif _looks_locked(text):
                busy = True
            else:
                raise
        except ValueError as exc:
            # libsql does not map SQLite's errors to the DBAPI ones: a locked database
            # arrives as a bare `ValueError`. Any other `ValueError` goes on.
            if not _looks_locked(str(exc)):
                raise
            busy = True
        if busy:
            raise RescaleBusy
        if overflowed:
            raise AmountTooLargeToRescale
        return change

    def _apply(
        self, connection: Connection, business_id: int, money_format: MoneyFormat
    ) -> MoneyFormatChange:
        decimals = money_format.decimals
        if decimals > 0:
            raised = connection.execute(
                update(_money_format)
                .where(_money_format.c.business_id == business_id, _money_format.c.scale == 0)
                .values(scale=_HUNDREDTHS_SCALE)
            )
            if raised.rowcount == 1:
                self._rescale(connection, business_id)
        written = connection.execute(
            update(_money_format)
            .where(_money_format.c.business_id == business_id, _money_format.c.decimals != decimals)
            .values(decimals=decimals)
        )
        scale = connection.execute(
            select(_money_format.c.scale).where(_money_format.c.business_id == business_id)
        ).scalar_one_or_none()
        if scale is None:
            raise MoneyFormatMissing
        if written.rowcount == 1 and decimals < scale:
            self._refuse_cents_below(connection, business_id, 10 ** (scale - decimals))
        symbol_written = connection.execute(
            update(_money_format)
            .where(
                _money_format.c.business_id == business_id,
                _money_format.c.symbol != money_format.symbol,
            )
            .values(symbol=money_format.symbol)
        )
        return MoneyFormatChange(
            symbol_changed=symbol_written.rowcount == 1,
            decimals_changed=written.rowcount == 1,
        )

    def _rescale(self, connection: Connection, business_id: int) -> None:
        for table in metadata.sorted_tables:
            for column in table.columns:
                if column.info.get("money") is True:
                    self._multiply(connection, table, column.name, business_id)

    def _multiply(self, connection: Connection, table: Table, name: str, business_id: int) -> None:
        column = table.c[name]
        mine = table.c.business_id == business_id
        measure = select(func.max(func.abs(column)), func.count(column), func.sum(column))
        largest, count, total = connection.execute(measure.where(mine)).one()
        if largest is not None and largest > _LARGEST_BEFORE_RESCALE:
            raise AmountTooLargeToRescale
        connection.execute(update(table).where(mine).values({name: column * _FACTOR}))
        largest_after, count_after, total_after = connection.execute(measure.where(mine)).one()
        not_integer = connection.execute(
            select(func.count()).where(mine, column.is_not(None), func.typeof(column) != "integer")
        ).scalar_one()
        if (
            count_after != count
            or (total or 0) * _FACTOR != (total_after or 0)
            or not_integer
            or (largest or 0) * _FACTOR != (largest_after or 0)
        ):
            raise RescaleCheckFailed

    def _refuse_cents_below(self, connection: Connection, business_id: int, divisor: int) -> None:
        for table in metadata.sorted_tables:
            for column in table.columns:
                if column.info.get("money") is not True:
                    continue
                held = connection.execute(
                    select(
                        exists().where(table.c.business_id == business_id, column % divisor != 0)
                    )
                ).scalar_one()
                if held:
                    raise DecimalsBelowRecordedAmounts
