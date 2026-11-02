from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.stock.adapters.tables import WithdrawalReasonRow
from app.stock.domain.errors import ReasonNameTaken
from app.stock.domain.withdrawal_reason import ReasonName, WithdrawalReason


class SqlWithdrawalReasons:
    """The `WithdrawalReasons` port over SQLAlchemy, for one business. Every statement
    filters on that business; a reason of another business is, from here, a reason that
    does not exist (docs/adr/0004). Writes flush; the use case commits.

    `IntegrityError` is never let through: it would carry SQL, and the only unique key a
    write here can break is `(business_id, name_key)`."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> list[WithdrawalReason]:
        statement = (
            select(WithdrawalReasonRow)
            .where(WithdrawalReasonRow.business_id == self._business_id)
            .order_by(WithdrawalReasonRow.position, WithdrawalReasonRow.id)
        )
        return [_reason(row) for row in self._session.scalars(statement)]

    def get(self, reason_id: int) -> WithdrawalReason | None:
        row = self._row(reason_id)
        return None if row is None else _reason(row)

    def add(self, name: ReasonName, position: int) -> WithdrawalReason:
        row = WithdrawalReasonRow(
            business_id=self._business_id, name=name.value, name_key=name.key, position=position
        )
        self._session.add(row)
        try:
            self._session.flush()
        except IntegrityError:
            raise ReasonNameTaken() from None
        return _reason(row)

    def save(self, reason: WithdrawalReason) -> WithdrawalReason:
        row = self._row(reason.id)
        assert row is not None, "save takes a reason of this business"
        row.name = reason.name.value
        row.name_key = reason.name.key
        row.position = reason.position
        try:
            self._session.flush()
        except IntegrityError:
            raise ReasonNameTaken() from None
        return _reason(row)

    def reorder(self, reason_ids: list[int]) -> None:
        statement = select(WithdrawalReasonRow).where(
            WithdrawalReasonRow.business_id == self._business_id,
            WithdrawalReasonRow.id.in_(reason_ids),
        )
        rows = {row.id: row for row in self._session.scalars(statement)}
        for position, reason_id in enumerate(reason_ids):
            rows[reason_id].position = position
        self._session.flush()

    def count(self) -> int:
        statement = (
            select(func.count())
            .select_from(WithdrawalReasonRow)
            .where(WithdrawalReasonRow.business_id == self._business_id)
        )
        return self._session.scalar(statement) or 0

    def _row(self, reason_id: int) -> WithdrawalReasonRow | None:
        statement = select(WithdrawalReasonRow).where(
            WithdrawalReasonRow.id == reason_id,
            WithdrawalReasonRow.business_id == self._business_id,
        )
        return self._session.scalar(statement)


def _reason(row: WithdrawalReasonRow) -> WithdrawalReason:
    return WithdrawalReason(id=row.id, name=ReasonName(row.name), position=row.position)
