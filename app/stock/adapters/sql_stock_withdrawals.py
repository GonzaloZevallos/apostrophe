"""The `Withdrawals` and `WithdrawalDraws` ports over `stock_withdrawal` and
`stock_withdrawal_line` (CONTEXT.md: Stock withdrawal). Built for one business: every
statement, and every join's ON clause, filters on it, so another business's withdrawal
is, from here, one that does not exist (docs/adr/0004). Writes flush; the use case
commits.
"""

from __future__ import annotations

from collections.abc import Collection

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.quantity import Quantity
from app.stock.adapters.tables import (
    StockWithdrawalLineRow,
    StockWithdrawalRow,
    WithdrawalReasonRow,
)
from app.stock.application.ports import WithdrawalMovement
from app.stock.domain.lot_order import WithdrawalLineDraw
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine


class SqlStockWithdrawals:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def by_id(self, withdrawal_id: int) -> Withdrawal | None:
        header = self._header(withdrawal_id)
        if header is None:
            return None
        statement = (
            select(StockWithdrawalLineRow.variety_id, StockWithdrawalLineRow.grams_hundredths)
            .where(
                StockWithdrawalLineRow.business_id == self._business_id,
                StockWithdrawalLineRow.stock_withdrawal_id == withdrawal_id,
            )
            .order_by(StockWithdrawalLineRow.position)
        )
        lines = tuple(
            WithdrawalLine(variety_id, Quantity(hundredths))
            for variety_id, hundredths in self._session.execute(statement).all()
        )
        return Withdrawal(
            reason_id=header.withdrawal_reason_id,
            withdrawn_on=header.withdrawn_on,
            note=header.note,
            lines=lines,
            recorded_at=header.recorded_at,
            id=header.id,
        )

    def add(self, withdrawal: Withdrawal) -> Withdrawal:
        header = StockWithdrawalRow(
            business_id=self._business_id,
            withdrawal_reason_id=withdrawal.reason_id,
            withdrawn_on=withdrawal.withdrawn_on,
            note=withdrawal.note,
            recorded_at=withdrawal.recorded_at,
        )
        self._session.add(header)
        self._session.flush()
        self._add_lines(header.id, withdrawal)
        return self._stored(header.id)

    def replace(self, withdrawal: Withdrawal) -> Withdrawal:
        assert withdrawal.id is not None, "replace takes a withdrawal that was added"
        header = self._header(withdrawal.id)
        assert header is not None, "replace takes a withdrawal of this business"
        header.withdrawal_reason_id = withdrawal.reason_id
        header.withdrawn_on = withdrawal.withdrawn_on
        header.note = withdrawal.note
        self._delete_lines(withdrawal.id)
        self._add_lines(withdrawal.id, withdrawal)
        return self._stored(withdrawal.id)

    def remove(self, withdrawal_id: int) -> None:
        self._delete_lines(withdrawal_id)
        self._session.execute(
            sa_delete(StockWithdrawalRow).where(
                StockWithdrawalRow.id == withdrawal_id,
                StockWithdrawalRow.business_id == self._business_id,
            )
        )
        self._session.flush()

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[WithdrawalLineDraw]:
        statement = (
            select(StockWithdrawalLineRow, StockWithdrawalRow)
            .join(
                StockWithdrawalRow,
                (StockWithdrawalRow.id == StockWithdrawalLineRow.stock_withdrawal_id)
                & (StockWithdrawalRow.business_id == self._business_id),
            )
            .where(StockWithdrawalLineRow.business_id == self._business_id)
            .order_by(StockWithdrawalRow.id, StockWithdrawalLineRow.position)
        )
        if variety_ids is not None:
            statement = statement.where(StockWithdrawalLineRow.variety_id.in_(variety_ids))
        return [
            WithdrawalLineDraw(
                variety_id=line.variety_id,
                day=header.withdrawn_on,
                recorded_at=header.recorded_at,
                withdrawal_id=header.id,
                position=line.position,
                quantity=Quantity(line.grams_hundredths),
                reason_id=header.withdrawal_reason_id,
            )
            for line, header in self._session.execute(statement).all()
        ]

    def movements_of(self, variety_id: int) -> list[WithdrawalMovement]:
        statement = (
            select(
                StockWithdrawalLineRow.grams_hundredths,
                StockWithdrawalRow,
                WithdrawalReasonRow.name,
            )
            .join(
                StockWithdrawalRow,
                (StockWithdrawalRow.id == StockWithdrawalLineRow.stock_withdrawal_id)
                & (StockWithdrawalRow.business_id == self._business_id),
            )
            .join(
                WithdrawalReasonRow,
                (WithdrawalReasonRow.id == StockWithdrawalRow.withdrawal_reason_id)
                & (WithdrawalReasonRow.business_id == self._business_id),
            )
            .where(
                StockWithdrawalLineRow.business_id == self._business_id,
                StockWithdrawalLineRow.variety_id == variety_id,
            )
        )
        summed: dict[int, tuple[StockWithdrawalRow, str, int]] = {}
        for hundredths, header, reason_name in self._session.execute(statement).all():
            _, _, total = summed.get(header.id, (header, reason_name, 0))
            summed[header.id] = (header, reason_name, total + hundredths)
        movements = [
            WithdrawalMovement(
                withdrawal_id=header.id,
                withdrawn_on=header.withdrawn_on,
                recorded_at=header.recorded_at,
                reason_id=header.withdrawal_reason_id,
                reason_name=reason_name,
                quantity=Quantity(total),
            )
            for header, reason_name, total in summed.values()
        ]
        return sorted(
            movements,
            key=lambda m: (m.withdrawn_on, m.recorded_at, m.withdrawal_id),
            reverse=True,
        )

    def _header(self, withdrawal_id: int) -> StockWithdrawalRow | None:
        return self._session.scalar(
            select(StockWithdrawalRow).where(
                StockWithdrawalRow.id == withdrawal_id,
                StockWithdrawalRow.business_id == self._business_id,
            )
        )

    def _delete_lines(self, withdrawal_id: int) -> None:
        """A Core delete through `session.execute`, run before any line is added: the
        `(withdrawal, position)` unique constraint would trip on a reordering otherwise."""
        self._session.execute(
            sa_delete(StockWithdrawalLineRow).where(
                StockWithdrawalLineRow.business_id == self._business_id,
                StockWithdrawalLineRow.stock_withdrawal_id == withdrawal_id,
            )
        )

    def _add_lines(self, withdrawal_id: int, withdrawal: Withdrawal) -> None:
        for position, line in enumerate(withdrawal.lines):
            self._session.add(
                StockWithdrawalLineRow(
                    business_id=self._business_id,
                    stock_withdrawal_id=withdrawal_id,
                    variety_id=line.variety_id,
                    position=position,
                    grams_hundredths=line.quantity.hundredths,
                )
            )
        self._session.flush()

    def _stored(self, withdrawal_id: int) -> Withdrawal:
        stored = self.by_id(withdrawal_id)
        assert stored is not None, "a withdrawal just written is readable"
        return stored
