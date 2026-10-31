"""The declared seams `SqlDueBusinesses.due(instant)`, `run_upkeep_safely(state, business_id,
instant)` and the ticker's `_tick`, over the zone each business stores (docs/adr/0057): the
due rule is "differs", each business is judged in its own zone, and a stored zone that cannot
be loaded touches only its own business.
"""

from __future__ import annotations

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.pinned_catalog.adapters.safe_upkeep import run_upkeep_safely
from app.pinned_catalog.adapters.sql_due import SqlDueBusinesses
from app.pinned_catalog.adapters.ticker import _tick
from app.shared.calendar import business_day
from tests.conftest import MovableClock
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")
FAR_EAST = ZoneInfo("Pacific/Kiritimati")  # UTC+14: a day ahead of Buenos Aires


def _publish(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"}
    )
    response = client.post("/pinned-catalog/publish")
    assert response.status_code == 200, response.text


def _publish_with_a_price_for_tomorrow(client: TestClient, name: str, clock: MovableClock) -> None:
    variety = client.post("/api/products", json={"name": name}).json()
    tomorrow = business_day(clock(), BUENOS_AIRES) + timedelta(days=1)
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": tomorrow.isoformat(), "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    _publish(client)


def _business_id(engine: Engine, name: str) -> int:
    with engine.connect() as connection:
        found = connection.execute(text("SELECT id FROM business WHERE name = :n"), {"n": name})
        return int(found.scalar_one())


def _set_zone(engine: Engine, business_id: int, zone: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE business SET time_zone = :z WHERE id = :i"), {"z": zone, "i": business_id}
        )


def _set_last_checked(engine: Engine, business_id: int, day: date | None) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE pinned_catalog SET last_checked_on = :d WHERE business_id = :i"),
            {"d": None if day is None else day.isoformat(), "i": business_id},
        )


def _last_checked(engine: Engine, business_id: int) -> date | None:
    with engine.connect() as connection:
        raw = connection.execute(
            text("SELECT last_checked_on FROM pinned_catalog WHERE business_id = :i"),
            {"i": business_id},
        ).scalar_one()
    return None if raw is None else date.fromisoformat(raw)


def test_a_last_check_one_day_ahead_is_due_because_the_rule_is_differs(
    app: FastAPI, engine: Engine, client: TestClient, clock: MovableClock
) -> None:
    _publish(client)
    business_id = _business_id(engine, "Primer Negocio")
    today = business_day(clock(), BUENOS_AIRES)
    due = SqlDueBusinesses(engine, app.state.business_zones)

    _set_last_checked(engine, business_id, today)
    assert due.due(clock()) == []

    _set_last_checked(engine, business_id, today + timedelta(days=1))
    assert due.due(clock()) == [business_id]

    _set_last_checked(engine, business_id, today - timedelta(days=1))
    assert due.due(clock()) == [business_id]

    _set_last_checked(engine, business_id, None)
    assert due.due(clock()) == [business_id]


def test_each_business_is_judged_in_its_own_zone(
    app: FastAPI, engine: Engine, client: TestClient, other_client: TestClient, clock: MovableClock
) -> None:
    _publish(client)
    _publish(other_client)
    first = _business_id(engine, "Primer Negocio")
    second = _business_id(engine, "Otro Negocio")
    buenos_aires_today = business_day(clock(), BUENOS_AIRES)
    assert business_day(clock(), FAR_EAST) != buenos_aires_today
    _set_zone(engine, second, "Pacific/Kiritimati")
    _set_last_checked(engine, first, buenos_aires_today)
    _set_last_checked(engine, second, buenos_aires_today)

    # The same stored day is today for the first business and yesterday for the second.
    assert SqlDueBusinesses(engine, app.state.business_zones).due(clock()) == [second]


def test_a_zone_that_cannot_be_loaded_is_skipped_and_the_others_are_still_listed(
    app: FastAPI, engine: Engine, client: TestClient, other_client: TestClient, clock: MovableClock
) -> None:
    _publish(client)
    _publish(other_client)
    first = _business_id(engine, "Primer Negocio")
    second = _business_id(engine, "Otro Negocio")
    _set_last_checked(engine, first, None)
    _set_last_checked(engine, second, None)
    _set_zone(engine, first, "Not/AZone")

    assert SqlDueBusinesses(engine, app.state.business_zones).due(clock()) == [second]


def test_a_tick_upkeeps_the_valid_business_and_skips_the_one_with_a_bad_zone(
    app: FastAPI,
    engine: Engine,
    client: TestClient,
    other_client: TestClient,
    clock: MovableClock,
    telegram: FakeTelegram,
) -> None:
    _publish_with_a_price_for_tomorrow(client, "A1", clock)
    _publish_with_a_price_for_tomorrow(other_client, "B1", clock)
    first = _business_id(engine, "Primer Negocio")
    second = _business_id(engine, "Otro Negocio")
    _set_last_checked(engine, first, business_day(clock(), BUENOS_AIRES))
    _set_last_checked(engine, second, business_day(clock(), BUENOS_AIRES))
    _set_zone(engine, first, "Not/AZone")
    telegram.calls.clear()
    clock.set(clock() + timedelta(days=1))

    _tick(app.state, clock())

    assert [call[0] for call in telegram.calls] == ["edit"]
    assert "B1" in telegram.calls[0][3]
    assert _last_checked(engine, second) == business_day(clock(), BUENOS_AIRES)
    assert _last_checked(engine, first) == business_day(clock() - timedelta(days=1), BUENOS_AIRES)


def test_upkeep_of_a_business_with_a_bad_zone_does_nothing(
    app: FastAPI, engine: Engine, client: TestClient, clock: MovableClock, telegram: FakeTelegram
) -> None:
    _publish_with_a_price_for_tomorrow(client, "A1", clock)
    first = _business_id(engine, "Primer Negocio")
    _set_last_checked(engine, first, None)
    _set_zone(engine, first, "Not/AZone")
    telegram.calls.clear()
    clock.set(clock() + timedelta(days=1))

    run_upkeep_safely(app.state, first, clock())

    assert telegram.calls == []
    assert _last_checked(engine, first) is None


def test_the_date_of_the_last_send_is_derived_in_the_current_zone_and_never_stored(
    engine: Engine, client: TestClient, clock: MovableClock
) -> None:
    _publish(client)
    business_id = _business_id(engine, "Primer Negocio")
    published_at = clock()
    before = client.get("/pinned-catalog/status").json()["status"]
    assert before["last_published_on"] == business_day(published_at, BUENOS_AIRES).isoformat()

    _set_zone(engine, business_id, "Pacific/Kiritimati")

    after = client.get("/pinned-catalog/status").json()["status"]
    assert after["last_published_on"] == business_day(published_at, FAR_EAST).isoformat()
    assert after["last_published_on"] != before["last_published_on"]
