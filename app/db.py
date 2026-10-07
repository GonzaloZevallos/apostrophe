"""The declarative base, engine construction and the per-request session.

The engine is not a module global: `create_app` hangs it on `app.state.engine`, so
tests inject an in-memory one without touching the environment.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import Request
from sqlalchemy import DateTime, Dialect, MetaData, TypeDecorator, create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import ConnectionPoolEntry, StaticPool

from app.shared.reference import ReferenceRefused

# Deterministic constraint names, so migrations can name what they alter.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
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


def make_engine(url: str, auth_token: str | None = None) -> Engine:
    """Branches on the driver name (`make_url(url).get_driver_name()`), never on
    `url.startswith` (plan invariant): a Turso `sqlite+libsql://` URL and a local
    `sqlite://` one both reach this function, and the right connect args follow the
    driver, not a string prefix.

    `check_same_thread` and `StaticPool` apply to pysqlite only: libsql's own DBAPI
    manages its connections differently, and does not need either. `auth_token` is a
    connect arg (plan invariant): it reaches the driver through `connect_args`, never
    folded into `url`, so it is never where a log line could print it. The
    foreign-key PRAGMA listener applies to both drivers, keyed on the backend name
    (`sqlite`), since libsql is a SQLite dialect underneath.
    """
    driver = make_url(url).get_driver_name()
    kwargs: dict[str, Any] = {}
    connect_args: dict[str, Any] = {}
    if driver == "pysqlite":
        connect_args["check_same_thread"] = False
        # An in-memory SQLite database lives in one connection; any other pool would
        # hand each thread its own empty database.
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    elif driver == "libsql" and auth_token is not None:
        connect_args["auth_token"] = auth_token
    if connect_args:
        kwargs["connect_args"] = connect_args
    # Never shown in SQL error output or logs: a catalog, pinned-catalog or
    # spreadsheet-import statement can carry a seller's own text, a customer's name or
    # phone number as a bound parameter (CODING_STANDARDS §9, the plan's invariant).
    engine = create_engine(url, hide_parameters=True, **kwargs)
    if make_url(url).get_backend_name() == "sqlite":
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


def flush_or_refuse(session: Session) -> None:
    """Flushes a write that references a variety. An `IntegrityError` is caught only to
    set a flag; the code-less `ReferenceRefused` is raised outside the `except`, so
    nothing of the driver's message stays reachable (docs/adr/0005). The use case that
    caught it rolls back and asks its own lookup whether the variety is gone."""
    refused = False
    try:
        session.flush()
    except IntegrityError:
        refused = True
    if refused:
        raise ReferenceRefused
