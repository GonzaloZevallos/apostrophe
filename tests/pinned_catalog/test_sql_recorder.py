"""`SqlPinRecorder` over real SQLite: `last_published_at` is monotone, so Inicio's
"published at least once" survives anything that records a pin without an instant."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pinned_catalog.adapters.sql_recorder import SqlPinRecorder
from app.pinned_catalog.adapters.tables import PinnedCatalogRow

PUBLISHED = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


def _business_id(engine: Engine) -> int:
    with Session(engine) as session:
        return session.scalar(select(BusinessRow.id).order_by(BusinessRow.id)) or 0


def _record(engine: Engine, business_id: int, at: datetime | None) -> None:
    SqlPinRecorder(engine).record(
        business_id,
        None,
        None,
        message_id=None,
        message_chat=None,
        message_token_fingerprint=None,
        last_published_text=None,
        last_published_at=at,
        last_failure=None,
        last_checked_on=None,
    )


def _stored(engine: Engine, business_id: int) -> datetime | None:
    with Session(engine) as session:
        row = session.scalar(
            select(PinnedCatalogRow).where(PinnedCatalogRow.business_id == business_id)
        )
        assert row is not None
        return row.last_published_at


def test_recording_none_keeps_the_stored_instant(client: TestClient, engine: Engine) -> None:
    business_id = _business_id(engine)
    _record(engine, business_id, PUBLISHED)

    _record(engine, business_id, None)

    assert _stored(engine, business_id) == PUBLISHED


def test_recording_a_later_instant_replaces_it(client: TestClient, engine: Engine) -> None:
    business_id = _business_id(engine)
    _record(engine, business_id, PUBLISHED)
    later = datetime(2026, 10, 2, 12, 0, tzinfo=UTC)

    _record(engine, business_id, later)

    assert _stored(engine, business_id) == later
