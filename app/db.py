"""The declarative base, engine construction and the per-request session.

The engine is not a module global: `create_app` hangs it on `app.state.engine`, so
tests inject an in-memory one without touching the environment.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import Request
from sqlalchemy import DateTime, Dialect, MetaData, TypeDecorator, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import ConnectionPoolEntry, StaticPool

# Deterministic constraint names, so migrations can name what they alter.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UtcDateTime(TypeDecorator[datetime]):
    """An instant, always aware and in UTC. SQLite stores no offset, so the offset is
    dropped on the way in and UTC put back on the way out; a naive datetime is refused."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("instants are stored timezone-aware")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)


def make_engine(url: str) -> Engine:
    kwargs: dict[str, Any] = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    # An in-memory SQLite database lives in one connection; any other pool would hand
    # each thread its own empty database.
    if url in ("sqlite://", "sqlite:///:memory:"):
        kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


def _enable_sqlite_foreign_keys(
    dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry
) -> None:
    # SQLite ignores FOREIGN KEY clauses unless asked, per connection.
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


def get_session(request: Request) -> Iterator[Session]:
    # Starlette's `State` is untyped; `create_app` always assigns an `Engine`.
    with Session(cast(Engine, request.app.state.engine)) as session:
        yield session
