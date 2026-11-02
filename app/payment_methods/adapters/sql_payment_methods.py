from __future__ import annotations

from collections.abc import Callable
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
    insert,
    literal,
    select,
    true,
    union_all,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.payment_methods.adapters.tables import PaymentMethodRow
from app.payment_methods.application.ports import Direction
from app.payment_methods.domain.method import (
    LastActivePaymentMethod,
    PaymentMethod,
    PaymentMethodIcon,
    PaymentMethodName,
    PaymentMethodNameTaken,
    PaymentMethodNotFound,
)
from app.payments.adapters.tables import PaymentRow
from app.shared.payment_method import PaymentMethodLabel

Row = PaymentMethodRow


class SqlPaymentMethods:
    """The `PaymentMethods` port over SQLAlchemy, for one business. Every statement
    filters on that business. Writes flush; the use case commits.

    Archive, delete and move are each one guarded statement (the last-active rule lives
    in its WHERE, so two concurrent requests cannot both pass it). When a guard stops a
    statement, a read in the same transaction asks the domain rule which refusal it was.
    `IntegrityError` is never let through: it would carry SQL."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def list_active(self) -> list[PaymentMethod]:
        return self._listed(Row.archived_at.is_(None))

    def list_archived(self) -> list[PaymentMethod]:
        return self._listed(Row.archived_at.is_not(None))

    def get(self, method_id: int) -> PaymentMethod | None:
        row = self._row(method_id)
        return None if row is None else _method(row)

    def available(self, payment_method_id: int) -> PaymentMethodLabel | None:
        """The label of a method a payment can be recorded with: of this business and not
        archived. Payments and sales each declare this as their own protocol."""
        statement = select(Row).where(
            Row.id == payment_method_id,
            Row.business_id == self._business_id,
            Row.archived_at.is_(None),
        )
        row = self._session.scalar(statement)
        return None if row is None else _method(row).label()

    def add(self, name: PaymentMethodName, icon: PaymentMethodIcon) -> PaymentMethod:
        if self._key_taken(name.name_key):
            raise PaymentMethodNameTaken()
        last = select(func.coalesce(func.max(Row.position), 0) + 1).where(
            Row.business_id == self._business_id
        )
        statement = insert(Row).from_select(
            ["business_id", "name", "name_key", "icon", "position"],
            select(
                literal(self._business_id),
                literal(name.value),
                literal(name.name_key),
                literal(icon.value),
                last.scalar_subquery(),
            ),
        )
        try:
            self._session.execute(statement)
        except IntegrityError:
            raise PaymentMethodNameTaken() from None
        stored = self._row_by_key(name.name_key)
        assert stored is not None, "the method just inserted is there"
        return _method(stored)

    def rename(self, method_id: int, name: PaymentMethodName) -> PaymentMethod:
        row = self._existing(method_id)
        if self._key_taken(name.name_key, besides=method_id):
            raise PaymentMethodNameTaken()
        row.name = name.value
        row.name_key = name.name_key
        try:
            self._session.flush()
        except IntegrityError:
            raise PaymentMethodNameTaken() from None
        return _method(row)

    def set_icon(self, method_id: int, icon: PaymentMethodIcon) -> PaymentMethod:
        row = self._existing(method_id)
        row.icon = icon.value
        self._session.flush()
        return _method(row)

    def move(self, method_id: int, direction: Direction) -> None:
        """One `UPDATE ... FROM` over the pair of positions to swap: the pair is worked
        out before any row changes, so neither new position is read from a row the same
        statement already rewrote."""
        self._existing(method_id)
        mine, neighbour = aliased(Row), aliased(Row)
        own = (
            select(mine.id, mine.position)
            .where(
                mine.id == method_id,
                mine.business_id == self._business_id,
                mine.archived_at.is_(None),
            )
            .subquery()
        )
        if direction is Direction.UP:
            beyond = (neighbour.position < own.c.position) | (
                (neighbour.position == own.c.position) & (neighbour.id < own.c.id)
            )
            nearest = (neighbour.position.desc(), neighbour.id.desc())
        else:
            beyond = (neighbour.position > own.c.position) | (
                (neighbour.position == own.c.position) & (neighbour.id > own.c.id)
            )
            nearest = (neighbour.position.asc(), neighbour.id.asc())
        nearest_active = (
            select(neighbour.id, neighbour.position)
            .select_from(own)
            .join(
                neighbour,
                (neighbour.business_id == self._business_id)
                & neighbour.archived_at.is_(None)
                & (neighbour.id != own.c.id)
                & beyond,
            )
            .order_by(*nearest)
            .limit(1)
            .subquery()
        )
        swapped = union_all(
            select(own.c.id.label("id"), nearest_active.c.position.label("position")).select_from(
                own.join(nearest_active, true())
            ),
            select(nearest_active.c.id.label("id"), own.c.position.label("position")).select_from(
                own.join(nearest_active, true())
            ),
        ).subquery()
        self._session.execute(
            update(Row)
            .where(Row.id == swapped.c.id, Row.business_id == self._business_id)
            .values(position=swapped.c.position)
            .execution_options(synchronize_session=False)
        )
        self._session.expire_all()

    def archive(self, method_id: int, at: datetime) -> None:
        if self._existing(method_id).archived_at is not None:
            return
        statement = (
            update(Row)
            .where(
                Row.id == method_id,
                Row.business_id == self._business_id,
                Row.archived_at.is_(None),
                self._active_count() > 1,
            )
            .values(archived_at=at)
        )
        self._guarded(statement, method_id, self._refuse_archive)

    def restore(self, method_id: int) -> None:
        self._existing(method_id)
        self._session.execute(
            update(Row)
            .where(Row.id == method_id, Row.business_id == self._business_id)
            .values(archived_at=None)
            .execution_options(synchronize_session=False)
        )
        self._session.expire_all()

    def delete(self, method_id: int) -> None:
        statement = delete(Row).where(
            Row.id == method_id,
            Row.business_id == self._business_id,
            ~self._used_clause(),
            Row.archived_at.is_not(None) | (self._active_count() > 1),
        )
        self._guarded(statement, method_id, self._refuse_delete)

    def is_used(self, method_id: int) -> bool:
        statement = select(self._used_clause()).where(
            Row.id == method_id, Row.business_id == self._business_id
        )
        return bool(self._session.scalar(statement))

    def _used_clause(self) -> ColumnElement[bool]:
        # Never stored: whether some payment, an on-the-spot one included, points at the
        # method right now. The composite foreign key's RESTRICT is the backstop.
        return exists().where(
            PaymentRow.payment_method_id == Row.id, PaymentRow.business_id == Row.business_id
        )

    def _active_count(self) -> ColumnElement[int]:
        return (
            select(func.count())
            .select_from(Row)
            .where(Row.business_id == self._business_id, Row.archived_at.is_(None))
            .scalar_subquery()
        )

    def _guarded(
        self,
        statement: Update | Delete,
        method_id: int,
        refuse: Callable[[PaymentMethod], None],
    ) -> None:
        """Runs a guarded statement. When the guard touched no row, a read in this
        transaction asks `refuse` which domain rule it was; if none is broken any more
        (the state changed under us), the statement runs once more against the state
        now, and a second miss is the last-active rule, the only guard that moves."""
        for _attempt in range(2):
            result = cast(CursorResult[tuple[object, ...]], self._session.execute(statement))
            if result.rowcount:
                self._session.expire_all()
                return
            method = self.get(method_id)
            if method is None:
                raise PaymentMethodNotFound(method_id)
            refuse(method)
        raise LastActivePaymentMethod()

    def _refuse_archive(self, method: PaymentMethod) -> None:
        method.check_archivable(len(self.list_active()))

    def _refuse_delete(self, method: PaymentMethod) -> None:
        assert method.id is not None
        method.check_deletable(len(self.list_active()), self.is_used(method.id))

    def _listed(self, condition: ColumnElement[bool]) -> list[PaymentMethod]:
        statement = (
            select(Row)
            .where(Row.business_id == self._business_id, condition)
            .order_by(Row.position, Row.id)
        )
        return [_method(row) for row in self._session.scalars(statement)]

    def _row(self, method_id: int) -> PaymentMethodRow | None:
        statement = select(Row).where(Row.id == method_id, Row.business_id == self._business_id)
        return self._session.scalar(statement)

    def _existing(self, method_id: int) -> PaymentMethodRow:
        row = self._row(method_id)
        if row is None:
            raise PaymentMethodNotFound(method_id)
        return row

    def _row_by_key(self, name_key: str) -> PaymentMethodRow | None:
        statement = select(Row).where(
            Row.business_id == self._business_id, Row.name_key == name_key
        )
        return self._session.scalar(statement)

    def _key_taken(self, name_key: str, besides: int | None = None) -> bool:
        row = self._row_by_key(name_key)
        return row is not None and row.id != besides


def _method(row: PaymentMethodRow) -> PaymentMethod:
    return PaymentMethod(
        id=row.id,
        name=PaymentMethodName(row.name),
        icon=PaymentMethodIcon(row.icon),
        position=row.position,
        archived=row.archived_at is not None,
    )
