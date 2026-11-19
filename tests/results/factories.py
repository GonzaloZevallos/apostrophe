"""Builders for the plain records results' domain reads."""

from __future__ import annotations

from datetime import UTC, date, datetime, time

from app.results.domain.ledger import SaleRecord


def sale_record(
    sale_id: int,
    day: date,
    *,
    total: int,
    shipping: int = 0,
    recorded_at: datetime | None = None,
) -> SaleRecord:
    """A Sale record; unless told otherwise it was recorded at 15:00 UTC on its own date."""
    return SaleRecord(
        sale_id=sale_id,
        day=day,
        shipping=shipping,
        total=total,
        recorded_at=recorded_at or datetime.combine(day, time(15, 0), tzinfo=UTC),
    )
