"""The `SchemaRows` port over SQLAlchemy: reflects the live database rather than
`app.tables.metadata` (the plan's invariant), so a table another hexagon adds is seen
here without this module changing. The handful of table names this adapter must name
to reach them by a column other than `business_id` (`business` itself, `app_user`'s
email for the `login_guard` delete, `invitation`'s count) are never spelled out here:
they are imported from `app.business_removal.domain.exclusions`, the one place in this
hexagon that names a business-owned table or column by hand.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import MetaData, delete, func, inspect, select
from sqlalchemy import Table as SATable
from sqlalchemy import types as sa_types
from sqlalchemy.orm import Session

from app.business_removal.application.schema_rows import DeletedIds
from app.business_removal.domain.business_ref import BusinessRef
from app.business_removal.domain.exclusions import (
    APP_USER_TABLE,
    BUSINESS_TABLE,
    LOGIN_GUARD_TABLE,
    WITHHELD_TABLES,
)
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema
from app.business_removal.domain.schema import Table as DomainTable


def _column_type(sa_type: sa_types.TypeEngine[Any]) -> ColumnType:
    if isinstance(sa_type, sa_types.DateTime):
        return ColumnType.DATETIME
    if isinstance(sa_type, sa_types.Date):
        return ColumnType.DATE
    if isinstance(sa_type, sa_types.Boolean):
        return ColumnType.BOOLEAN
    if isinstance(sa_type, sa_types.Integer):
        return ColumnType.INTEGER
    if isinstance(sa_type, (sa_types.String, sa_types.Text)):
        return ColumnType.TEXT
    return ColumnType.OTHER


class SqlSchemaRows:
    """The `SchemaRows` port over a SQLAlchemy `Session`. Flushes nothing it does not
    have to and never commits: the caller commits once, as the plan requires."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._metadata = MetaData()

    def schema(self) -> Schema:
        connection = self._session.connection()
        inspector = inspect(connection)
        tables = []
        for name in inspector.get_table_names():
            primary_key = set(inspector.get_pk_constraint(name).get("constrained_columns") or ())
            columns = tuple(
                Column(
                    name=col["name"],
                    type=_column_type(col["type"]),
                    nullable=bool(col["nullable"]),
                    primary_key=col["name"] in primary_key,
                )
                for col in inspector.get_columns(name)
            )
            foreign_keys = tuple(
                ForeignKey(
                    columns=tuple(fk["constrained_columns"]),
                    target_table=fk["referred_table"],
                    target_columns=tuple(fk["referred_columns"]),
                )
                for fk in inspector.get_foreign_keys(name)
            )
            tables.append(DomainTable(name, columns, foreign_keys))
        return Schema(tuple(tables))

    def business_of(self, email: str) -> BusinessRef | None:
        normalized = email.strip().lower()
        business = self._table(BUSINESS_TABLE)
        app_user = self._table(APP_USER_TABLE)
        statement = (
            select(business.c.id, business.c.name, business.c.language)
            .select_from(app_user.join(business, business.c.id == app_user.c.business_id))
            .where(app_user.c.email == normalized)
        )
        row = self._session.execute(statement).first()
        return None if row is None else BusinessRef(row.id, row.name, row.language)

    def rows(self, table: str, business_id: int) -> list[dict[str, object]]:
        sa_table = self._table(table)
        filter_column = sa_table.c.id if table == BUSINESS_TABLE else sa_table.c.business_id
        statement = select(sa_table).where(filter_column == business_id).order_by(sa_table.c.id)
        return [dict(row._mapping) for row in self._session.execute(statement)]

    def withheld_count(self, table: str, business_id: int) -> int:
        sa_table = self._table(table)
        statement = (
            select(func.count()).select_from(sa_table).where(sa_table.c.business_id == business_id)
        )
        return self._session.execute(statement).scalar_one()

    def delete_business(self, business_id: int, order: tuple[str, ...]) -> DeletedIds:
        tables: dict[str, frozenset[int]] = {}
        withheld_counts: dict[str, int] = {}
        emails: tuple[str, ...] = ()
        for name in order:
            sa_table = self._table(name)
            filter_column = sa_table.c.id if name == BUSINESS_TABLE else sa_table.c.business_id
            if name == APP_USER_TABLE:
                statement = (
                    delete(sa_table)
                    .where(filter_column == business_id)
                    .returning(sa_table.c.id, sa_table.c.email)
                )
                deleted = self._session.execute(statement).all()
                ids = frozenset(row.id for row in deleted)
                emails = tuple(row.email for row in deleted)
            else:
                statement = (
                    delete(sa_table).where(filter_column == business_id).returning(sa_table.c.id)
                )
                ids = frozenset(self._session.scalars(statement).all())
            # A withheld table with its own `business_id` (`invitation`, `reset_link`)
            # is counted, never kept as an exported id set (docs/adr/0019);
            # `login_guard`, the only withheld table with no `business_id`, is never
            # reached here at all -- its own delete, by email, follows below.
            if name in WITHHELD_TABLES:
                withheld_counts[name] = len(ids)
            else:
                tables[name] = ids

        login_guard = self._table(LOGIN_GUARD_TABLE)
        if emails:
            guard_statement = (
                delete(login_guard)
                .where(login_guard.c.email.in_(emails))
                .returning(login_guard.c.email)
            )
            login_guard_count = len(self._session.execute(guard_statement).all())
        else:
            login_guard_count = 0

        return DeletedIds(
            tables=tables,
            withheld_counts=withheld_counts,
            login_guard_count=login_guard_count,
        )

    def _table(self, name: str) -> SATable:
        if name in self._metadata.tables:
            return self._metadata.tables[name]
        return SATable(name, self._metadata, autoload_with=self._session.connection())
