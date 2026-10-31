"""Every request counts "today" in its own business's zone (docs/adr/0057), read through
`GET /auth/me` on the movable clock: the stored zone decides the day, a zone that cannot be
loaded refuses only its own business with a 500 and never falls back to Argentina, and a
new business starts on the default zone."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from tests.conftest import NOW, MovableClock

ARGENTINA = "America/Argentina/Buenos_Aires"
# 02:30 UTC on 3 Oct: 2 Oct in Buenos Aires (UTC-3), 3 Oct in Madrid (UTC+2) and in Auckland.
ACROSS_UTC_MIDNIGHT = datetime(2026, 10, 3, 2, 30, tzinfo=UTC)


def _store_zone(engine: Engine, email: str, zone: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE business SET time_zone = :zone WHERE id = "
                "(SELECT business_id FROM app_user WHERE email = :email)"
            ),
            {"zone": zone, "email": email},
        )


def test_a_new_business_has_the_default_zone_and_its_today_is_the_argentina_day(
    client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    with engine.connect() as connection:
        stored = connection.execute(text("SELECT time_zone FROM business")).scalar_one()
    clock.set(ACROSS_UTC_MIDNIGHT)

    assert stored == ARGENTINA
    assert client.get("/auth/me").json()["today"] == "2026-10-02"
    clock.set(ACROSS_UTC_MIDNIGHT + timedelta(minutes=30))
    assert client.get("/auth/me").json()["today"] == "2026-10-03"


def test_the_stored_zone_of_the_business_decides_its_today(
    client: TestClient, other_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    clock.set(ACROSS_UTC_MIDNIGHT)
    _store_zone(engine, "uno@example.com", "Pacific/Auckland")

    assert client.get("/auth/me").json()["today"] == "2026-10-03"
    assert other_client.get("/auth/me").json()["today"] == "2026-10-02"


@pytest.mark.parametrize("stored", ["Mars/Olympus_Mons", "america/argentina/buenos_aires"])
def test_a_stored_zone_that_cannot_be_loaded_refuses_only_its_own_business(
    client: TestClient, other_client: TestClient, engine: Engine, stored: str
) -> None:
    _store_zone(engine, "uno@example.com", stored)

    broken = client.get("/auth/me")
    fine = other_client.get("/auth/me")

    assert broken.status_code == 500
    assert broken.json()["code"] == "time_zone_unavailable"
    assert stored not in broken.text
    assert fine.status_code == 200
    assert fine.json()["today"] == NOW.astimezone(UTC).date().isoformat()
