from datetime import datetime
from typing import cast

from sqlalchemy import (
    ColumnElement,
    CursorResult,
    Delete,
    Update,
    delete,
    exists,
    func,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payment_methods.domain.errors import NameTaken
from app.payment_methods.domain.method import PaymentMethod, PaymentMethodIcon, PaymentMethodName


class SqlPaymentMethods:
    """The `PaymentMethods` port over SQLAlchemy, for one business. Every statement
    filters on that business; a method of another business is, from here, a method that
    does not exist (docs/adr/0004). Writes flush; the use case commits.

    Archiving or deleting the last offered method is refused by the statement itself, so
    two concurrent requests cannot both pass a check made before either wrote."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def offered(self) -> list[PaymentMethod]:
        return self._listed(PaymentMethodRow.archived_at.is_(None))

    def archived(self) -> list[PaymentMethod]:
        return self._listed(PaymentMethodRow.archived_at.is_not(None))

    def by_id(self, method_id: int) -> PaymentMethod | None:
        row = self._row(method_id)
        return None if row is None else _method(row)

    def by_key(self, key: str) -> PaymentMethod | None:
        row = self._session.scalar(
            select(PaymentMethodRow).where(
                PaymentMethodRow.business_id == self._business_id,
                PaymentMethodRow.name_key == key,
            )
        )
        return None if row is None else _method(row)

    def add(self, name: PaymentMethodName, icon: PaymentMethodIcon) -> PaymentMethod:
        last = self._session.scalar(
            select(func.max(PaymentMethodRow.position)).where(
                PaymentMethodRow.business_id == self._business_id
            )
        )
        row = PaymentMethodRow(
            business_id=self._business_id,
            name=name.value,
            name_key=name.name_key,
            icon=icon.value,
            position=(last or 0) + 1,
        )
        self._session.add(row)
        self._flush()
        return _method(row)

    def save_details(self, method: PaymentMethod) -> PaymentMethod:
        row = self._row(method.id)
        assert row is not None, "save_details takes a method of this business"
        row.name = method.name.value
        row.name_key = method.name.name_key
        row.icon = method.icon.value
        self._flush()
        return _method(row)

    def swap_positions(self, first: PaymentMethod, second: PaymentMethod) -> None:
        first_row = self._row(first.id)
        second_row = self._row(second.id)
        assert first_row is not None and second_row is not None
        first_row.position, second_row.position = second_row.position, first_row.position
        self._flush()

    def archive(self, method_id: int, at: datetime) -> bool:
        result = self._execute(
            update(PaymentMethodRow)
            .where(
                PaymentMethodRow.business_id == self._business_id,
                PaymentMethodRow.id == method_id,
                PaymentMethodRow.archived_at.is_(None),
                self._another_offered(method_id),
            )
            .values(archived_at=at)
        )
        self._session.expire_all()
        return result.rowcount == 1

    def restore(self, method_id: int) -> None:
        self._session.execute(
            update(PaymentMethodRow)
            .where(
                PaymentMethodRow.business_id == self._business_id,
                PaymentMethodRow.id == method_id,
            )
            .values(archived_at=None)
        )
        self._session.expire_all()

    def delete(self, method_id: int) -> bool:
        archived = PaymentMethodRow.archived_at.is_not(None)
        result = self._execute(
            delete(PaymentMethodRow).where(
                PaymentMethodRow.business_id == self._business_id,
                PaymentMethodRow.id == method_id,
                archived | self._another_offered(method_id),
            )
        )
        self._session.expire_all()
        return result.rowcount == 1

    def _another_offered(self, method_id: int) -> ColumnElement[bool]:
        other = aliased(PaymentMethodRow)
        return exists().where(
            other.business_id == self._business_id,
            other.id != method_id,
            other.archived_at.is_(None),
        )

    def _listed(self, condition: ColumnElement[bool]) -> list[PaymentMethod]:
        statement = (
            select(PaymentMethodRow)
            .where(PaymentMethodRow.business_id == self._business_id, condition)
            .order_by(PaymentMethodRow.position, PaymentMethodRow.id)
        )
        return [_method(row) for row in self._session.scalars(statement)]

    def _execute(self, statement: Update | Delete) -> CursorResult[tuple[object, ...]]:
        return cast(CursorResult[tuple[object, ...]], self._session.execute(statement))

    def _row(self, method_id: int) -> PaymentMethodRow | None:
        return self._session.scalar(
            select(PaymentMethodRow).where(
                PaymentMethodRow.id == method_id,
                PaymentMethodRow.business_id == self._business_id,
            )
        )

    def _flush(self) -> None:
        try:
            self._session.flush()
        except IntegrityError:
            raise NameTaken() from None


def _method(row: PaymentMethodRow) -> PaymentMethod:
    return PaymentMethod(
        id=row.id,
        name=PaymentMethodName(row.name),
        icon=PaymentMethodIcon(row.icon),
        position=row.position,
        archived_at=row.archived_at,
    )
