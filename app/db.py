"""The declarative base, engine construction and the per-request session.

The engine is not a module global: `create_app` hangs it on `app.state.engine`, so
tests inject an in-memory one without touching the environment.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any, Literal, cast, overload

from fastapi import Request
from sqlalchemy import (
    ColumnElement,
    DateTime,
    Dialect,
    Integer,
    MetaData,
    TypeDecorator,
    column,
    create_engine,
    event,
    literal,
    select,
    table,
)
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    DeclarativeBase,
    InstrumentedAttribute,
    MappedColumn,
    Session,
    SessionTransaction,
    mapped_column,
)
from sqlalchemy.pool import ConnectionPoolEntry, StaticPool

from app.shared.money import SCALE_FACTORS, Money
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
    """Flushes a write that references a variety. An `IntegrityError` (libsql's own
    foreign-key error too) is caught only to set a flag; the code-less `ReferenceRefused`
    is raised outside the `except`, so nothing of the driver's message stays reachable
    (docs/adr/0005). The use case that caught it rolls back and asks its own lookup
    whether the variety is gone."""
    refused = False
    try:
        session.flush()
    except IntegrityError:
        refused = True
    except ValueError as exc:
        # The libsql driver (Turso, ADR-0016) does not map SQLite's errors to the DBAPI
        # ones: a violated foreign key arrives as a bare `ValueError`. Any other
        # `ValueError` is not this refusal and goes on as it was.
        if "FOREIGN KEY constraint failed" not in str(exc):
            raise
        refused = True
    if refused:
        raise ReferenceRefused


@overload
def money_column(*, nullable: Literal[False] = False) -> MappedColumn[int]: ...


@overload
def money_column(*, nullable: Literal[True]) -> MappedColumn[int | None]: ...


def money_column(*, nullable: bool = False) -> MappedColumn[int] | MappedColumn[int | None]:
    """An amount's column: a plain Integer, tagged `info["money"]` so the metadata guards
    (tests/migrations/test_money_columns.py) can tell an amount from any other integer.
    The DDL is the one a bare `Mapped[int]` produced. An amount is held only in a column
    declared here (docs/adr/0058)."""
    if nullable:
        return mapped_column(Integer, nullable=True, info={"money": True})
    return mapped_column(Integer, nullable=False, info={"money": True})


class MoneyFormatMissing(LookupError):
    """A business has no money_format row. The message is a fixed literal and carries no
    data (CODING_STANDARDS.md section 9)."""

    def __init__(self) -> None:
        super().__init__("the business has no money format row")


# A lightweight table, so this module imports no hexagon: only the two columns read.
_money_format = table("money_format", column("business_id"), column("scale"), column("decimals"))

# Hundredths per stored unit, by scale: scale 0 stores whole currency units, scale 2
# stores hundredths.
_FACTOR_BY_SCALE = {0: 100, 2: 1}


# Where a session keeps the factors it has read, by business, for its outer transaction only.
_FACTORS_KEY = "money_scale_factors"
# The same, for the decimals a business shows.
_DECIMALS_KEY = "money_decimals"


@event.listens_for(Session, "after_transaction_end")
def _forget_money_scale_factors(session: Session, transaction: SessionTransaction) -> None:
    """A commit or a rollback of the outer transaction forgets every cached factor, so a
    scale changed by another unit of work is read afresh. A savepoint ending (it has a
    parent) leaves them alone: the whole unit of work shares one lookup."""
    if transaction.parent is None:
        session.info.pop(_FACTORS_KEY, None)
        session.info.pop(_DECIMALS_KEY, None)


class MoneyScaleChanged(LookupError):
    """A business's money scale changed between the write's read of it and its commit
    (docs/adr/0058). It has no code and a fixed literal message (CODING_STANDARDS.md
    section 9); it surfaces as FastAPI's default 500. A caller that catches it must call
    `rollback()` on the session: nothing was committed."""

    def __init__(self) -> None:
        super().__init__("the money scale changed during the write")


@event.listens_for(Session, "before_commit")
def _refuse_a_stale_money_scale(session: Session) -> None:
    """Re-reads, at commit, the stored scale of every business whose factor this session
    cached, with its own select (never `money_scale_factor`). A write that read the old
    scale and commits after the rescale raises `MoneyScaleChanged` and stores nothing.

    The flush comes first: it takes SQLite's write lock, so the re-read cannot be stale.
    An empty or absent cache issues no statement; a business with no row is skipped (its
    writer already failed with `MoneyFormatMissing`). On a mismatch the whole cache is
    forgotten. A caller that catches the error must call `rollback()`."""
    cache: dict[int, int] = session.info.get(_FACTORS_KEY) or {}
    decimals: dict[int, int] = session.info.get(_DECIMALS_KEY) or {}
    if not (cache or decimals) or session.in_nested_transaction():
        # A savepoint releasing is not a commit: only the outer transaction's counts.
        return
    session.flush()
    changed = False
    for business_id in set(cache) | set(decimals):
        # One statement per business reads both values the session cached. The decimals fix
        # the unit a domain amount was held in: a write that read them before they changed
        # must not commit either.
        row = session.execute(
            select(_money_format.c.scale, _money_format.c.decimals).where(
                _money_format.c.business_id == business_id
            )
        ).one_or_none()
        if row is None:
            continue
        scale, shown = row
        factor = cache.get(business_id)
        if factor is not None and _FACTOR_BY_SCALE.get(scale) != factor:
            changed = True
        held = decimals.get(business_id)
        if held is not None and shown != held:
            changed = True
    if changed:
        session.info.pop(_FACTORS_KEY, None)
        session.info.pop(_DECIMALS_KEY, None)
        raise MoneyScaleChanged


def _read_the_money_format(session: Session, business_id: int) -> None:
    """One single-row read of the business's scale and decimals that fills both caches: a
    request that needs the factor and the decimals pays one statement, the one the scale
    alone cost before the decimals were read. Raises `MoneyFormatMissing` when the row is
    absent; a missing row is never cached."""
    row = session.execute(
        select(_money_format.c.scale, _money_format.c.decimals).where(
            _money_format.c.business_id == business_id
        )
    ).one_or_none()
    if row is None:
        raise MoneyFormatMissing
    scale, decimals = row
    factor = _FACTOR_BY_SCALE.get(scale)
    if factor is None:
        raise ValueError("the money scale must be 0 or 2")
    session.info.setdefault(_FACTORS_KEY, {})[business_id] = factor
    session.info.setdefault(_DECIMALS_KEY, {})[business_id] = int(decimals)


def money_scale_factor(session: Session, business_id: int) -> int:
    """The hundredths one stored unit of the business's amounts is worth: 100 at scale 0,
    1 at scale 2. An adapter reads an amount in hundredths by selecting
    `scaled(column, factor)`, and writes one through `money_stored_value`.

    `business_id` is a bound int, never a column: the lookup is one single-row read on
    the unique index on `money_format.business_id`, constant whatever the data volume. A
    successful lookup is cached in `session.info` until the outer transaction ends; a
    missing row is never cached. Raises `MoneyFormatMissing` when the row is absent; it
    never returns NULL and never falls back to a default scale."""
    cached = (session.info.get(_FACTORS_KEY) or {}).get(business_id)
    if cached is None:
        _read_the_money_format(session, business_id)
        cached = session.info[_FACTORS_KEY][business_id]
    return int(cached)


def money_decimals(session: Session, business_id: int) -> int:
    """The decimals the business shows, which fix the unit a domain amount is held in: a
    whole currency unit at 0, a tenth at 1, a hundredth at 2. Read in the same statement as
    the factor, cached and guarded the same way at commit. Raises `MoneyFormatMissing` when
    the row is absent."""
    cached = (session.info.get(_DECIMALS_KEY) or {}).get(business_id)
    if cached is None:
        _read_the_money_format(session, business_id)
        cached = session.info[_DECIMALS_KEY][business_id]
    return int(cached)


def domain_amount(session: Session, business_id: int, hundredths: int) -> int:
    """An amount read in hundredths (`scaled(...)`) as the domain's int, in the unit of
    the business's decimals. Exact, because every stored amount is a multiple of it."""
    return Money(hundredths).in_decimals(money_decimals(session, business_id))


def money_of_domain(session: Session, business_id: int, amount: int) -> Money:
    """A domain int, in the unit of the business's decimals, as `Money`."""
    return Money.of_decimals(amount, money_decimals(session, business_id))


def scaled[T: int | None](
    amount: ColumnElement[T] | InstrumentedAttribute[T], factor: int
) -> ColumnElement[T]:
    """The amount column in hundredths, inside the statement that loads it or inside the
    `SUM` over it: `amount * literal(factor)`. The domain reaches its int only through
    `domain_amount`, which never truncates or rounds."""
    if factor not in SCALE_FACTORS:
        raise ValueError("the money scale factor must be 1 or 100")
    return amount * literal(factor)


def money_stored_value(session: Session, business_id: int, money: Money) -> int:
    """The integer to bind when writing `money` to one of the business's amount columns.
    Exact or it raises `MoneyNotRepresentable`: an amount the scale cannot hold is never
    stored rounded."""
    return money.in_units_of(money_scale_factor(session, business_id))
