"""`GET` and `PUT /business/time-zone` through `TestClient` on the movable clock
(docs/adr/0057): the list and the clock the front previews with, the refusals, what a save
owes the pinned catalog (one edit at most, never a post), and every "today" following the
stored zone while no stored date moves."""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.accounts.domain.time_zone import accepted_time_zones
from app.pinned_catalog.adapters.ticker import _tick
from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.conftest import NOW, MovableClock
from tests.contract_shapes import assert_matches_fixture
from tests.fakes.telegram import FakeTelegram

ARGENTINA = "America/Argentina/Buenos_Aires"
WEST = "Pacific/Pago_Pago"  # UTC-11: a day behind Buenos Aires from 03:00 UTC to 11:00 UTC
EAST = "Pacific/Kiritimati"  # UTC+14: a day ahead of Buenos Aires from 10:00 UTC
TOKEN = "123456789:top-secret-bot-token"
# 06:30 UTC on 5 Oct: 4 Oct 23:30 in Los Angeles (UTC-7), 5 Oct 03:30 in Buenos Aires.
LOCAL_LATE = datetime(2026, 10, 5, 6, 30, tzinfo=UTC)


def _put(client: TestClient, zone: str) -> Any:
    return client.put("/business/time-zone", json={"time_zone": zone})


def _offsets(client: TestClient) -> dict[str, int | None]:
    body = client.get("/business/time-zone").json()
    return dict(zip(body["time_zones"], body["utc_offsets_minutes"], strict=True))


def _stored(client: TestClient) -> str:
    stored: str = client.get("/business/time-zone").json()["time_zone"]
    return stored


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _posts(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] in ("send", "pin")]


def _status(client: TestClient) -> dict[str, Any]:
    body: dict[str, Any] = client.get("/pinned-catalog/status").json()["status"]
    return body


def _argentina_day(clock: MovableClock) -> date:
    return (clock() - timedelta(hours=3)).date()


def _publish(client: TestClient, name: str, effective_from: str) -> int:
    variety = client.post("/api/products", json={"name": name}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": effective_from, "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    client.post(
        "/pinned-catalog/test", json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"}
    )
    assert client.post("/pinned-catalog/publish").status_code == 200
    return int(variety["id"])


def _last_checked(engine: Engine) -> str | None:
    with engine.connect() as connection:
        found = connection.execute(text("SELECT last_checked_on FROM pinned_catalog"))
        row = found.first()
    return None if row is None else row[0]


# --- the two routes ------------------------------------------------------------------


def test_get_answers_the_stored_zone_the_accepted_list_and_the_clock_in_milliseconds(
    client: TestClient,
) -> None:
    answer = client.get("/business/time-zone")

    assert answer.status_code == 200
    assert_matches_fixture(answer.json(), "timeZone")
    body = answer.json()
    assert body["time_zone"] == ARGENTINA
    assert body["time_zones"] == list(accepted_time_zones())
    assert body["now_epoch_ms"] == int(NOW.timestamp()) * 1000


def test_get_answers_each_zone_utc_offset_at_the_clock_instant_either_side_of_a_change(
    client: TestClient, clock: MovableClock
) -> None:
    """The front formats a zone's local time by adding this offset to `now_epoch_ms`, so a
    zone whose clocks go back is right on both sides of the change (Madrid, 25 Oct 2026,
    01:00 UTC)."""
    clock.set(datetime(2026, 10, 25, 0, 59, tzinfo=UTC))
    before = _offsets(client)
    clock.set(datetime(2026, 10, 25, 1, 0, tzinfo=UTC))
    after = _offsets(client)

    assert (before["Europe/Madrid"], after["Europe/Madrid"]) == (120, 60)
    assert before[ARGENTINA] == after[ARGENTINA] == -180
    assert list(before) == list(accepted_time_zones())


def test_get_lists_a_stored_name_off_the_accepted_list_too(
    client: TestClient, engine: Engine
) -> None:
    with engine.begin() as connection:
        connection.execute(text("UPDATE business SET time_zone = 'Etc/GMT+5'"))

    body = client.get("/business/time-zone").json()

    assert body["time_zone"] == "Etc/GMT+5"
    assert "Etc/GMT+5" in body["time_zones"]
    assert _offsets(client)["Etc/GMT+5"] == -300
    assert [n for n in body["time_zones"] if n != "Etc/GMT+5"] == list(accepted_time_zones())


def test_put_stores_the_zone_and_answers_today_in_it(
    client: TestClient, clock: MovableClock
) -> None:
    clock.set(LOCAL_LATE)

    saved = _put(client, "America/Los_Angeles")

    assert saved.status_code == 200, saved.text
    assert_matches_fixture(saved.json(), "timeZoneSaved")
    assert saved.json() == {"time_zone": "America/Los_Angeles", "today": "2026-10-04"}
    assert _stored(client) == "America/Los_Angeles"
    assert client.get("/auth/me").json()["today"] == "2026-10-04"


@pytest.mark.parametrize("refused", ["US/Eastern", "america/mexico_city", "Etc/GMT+5", "", "x/y"])
def test_a_name_that_is_not_accepted_is_refused_and_the_stored_zone_stays(
    client: TestClient, telegram: FakeTelegram, refused: str
) -> None:
    _put(client, "Europe/Madrid")
    telegram.calls.clear()

    answer = _put(client, refused)

    assert answer.status_code == 422
    assert answer.json()["code"] == "unknown_time_zone"
    assert refused not in answer.json()["detail"] or not refused
    assert _stored(client) == "Europe/Madrid"
    assert telegram.calls == []


def test_a_body_with_no_zone_is_refused(client: TestClient) -> None:
    assert client.put("/business/time-zone", json={}).status_code == 422


def test_one_business_changing_its_zone_leaves_the_other(
    client: TestClient, other_client: TestClient
) -> None:
    _put(other_client, "Asia/Tokyo")

    assert _stored(other_client) == "Asia/Tokyo"
    assert _stored(client) == ARGENTINA


# --- the pinned catalog's upkeep -----------------------------------------------------


def test_saving_the_stored_zone_answers_200_and_calls_telegram_not_at_all(
    client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    _publish(client, "V1", "2026-01-01")
    telegram.calls.clear()

    assert _put(client, ARGENTINA).status_code == 200

    assert telegram.calls == []


def test_a_business_that_never_published_makes_no_telegram_call(
    client: TestClient, telegram: FakeTelegram
) -> None:
    assert _put(client, EAST).status_code == 200

    assert telegram.calls == []


def test_a_changed_zone_whose_text_is_the_same_edits_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _publish(client, "V1", "2026-01-01")
    telegram.calls.clear()

    assert _put(client, "Europe/Madrid").status_code == 200

    assert telegram.calls == []


def test_a_zone_whose_new_today_changes_the_text_owes_exactly_one_edit_and_no_post(
    client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    tomorrow = (_argentina_day(clock) + timedelta(days=1)).isoformat()
    _publish(client, "V1", tomorrow)
    telegram.calls.clear()

    assert _put(client, EAST).status_code == 200

    assert len(_edits(telegram)) == 1
    assert _posts(telegram) == []
    assert _status(client)["state"] == "up_to_date"


def test_moving_east_edits_once_when_the_text_changed_and_the_next_tick_does_nothing(
    app: Any, client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    tomorrow = (_argentina_day(clock) + timedelta(days=1)).isoformat()
    _publish(client, "V1", tomorrow)
    _tick(app.state, clock())
    telegram.calls.clear()

    _put(client, EAST)
    assert len(_edits(telegram)) == 1
    telegram.calls.clear()
    _tick(app.state, clock())
    assert _edits(telegram) == []
    _tick(app.state, clock())
    assert telegram.calls == []


def test_moving_west_edits_once_when_the_text_changed_and_the_next_tick_does_nothing(
    app: Any, client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    # 04:00 UTC: 01:00 on the Argentina day, but still the day before in Pago Pago.
    clock.set(datetime(2026, 10, 5, 4, 0, tzinfo=UTC))
    _publish(client, "V1", "2026-10-05")
    _tick(app.state, clock())
    telegram.calls.clear()

    _put(client, WEST)
    assert len(_edits(telegram)) == 1
    telegram.calls.clear()
    _tick(app.state, clock())
    assert _edits(telegram) == []
    _tick(app.state, clock())
    assert telegram.calls == []


def test_moving_west_with_the_text_unchanged_edits_nothing_and_the_ticks_stay_quiet(
    app: Any, client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    clock.set(datetime(2026, 10, 5, 4, 0, tzinfo=UTC))
    _publish(client, "V1", "2026-01-01")
    _tick(app.state, clock())
    telegram.calls.clear()

    _put(client, WEST)
    _tick(app.state, clock())
    _tick(app.state, clock())

    assert telegram.calls == []


def test_moving_east_with_the_text_unchanged_edits_nothing_and_the_ticks_stay_quiet(
    app: Any, client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    _publish(client, "V1", "2026-01-01")
    _tick(app.state, clock())
    telegram.calls.clear()

    _put(client, EAST)
    _tick(app.state, clock())
    _tick(app.state, clock())

    assert telegram.calls == []


def test_a_failed_edit_after_the_save_leaves_the_zone_saved_and_the_pin_out_of_date(
    client: TestClient, telegram: FakeTelegram, clock: MovableClock
) -> None:
    tomorrow = (_argentina_day(clock) + timedelta(days=1)).isoformat()
    _publish(client, "V1", tomorrow)
    telegram.calls.clear()
    telegram.fail_next(TelegramUnreachable())

    saved = _put(client, EAST)

    assert saved.status_code == 200
    assert _stored(client) == EAST
    assert _status(client)["state"] == "out_of_date"
    assert _posts(telegram) == []


def test_the_last_send_date_follows_the_zone_and_last_checked_is_never_rewritten(
    app: Any, client: TestClient, engine: Engine, clock: MovableClock, telegram: FakeTelegram
) -> None:
    tomorrow = (_argentina_day(clock) + timedelta(days=1)).isoformat()
    _publish(client, "V1", tomorrow)
    _tick(app.state, clock())
    checked = _last_checked(engine)
    before = _status(client)["last_published_on"]
    # The edit the save owes fails (Telegram unreachable keeps the stored check, ADR-0014),
    # so the stored date shows whether the save itself moved it.
    telegram.fail_next(TelegramUnreachable())

    _put(client, EAST)

    assert before == "2026-10-02"
    assert _status(client)["last_published_on"] == "2026-10-03"
    assert checked == "2026-10-02"
    assert _last_checked(engine) == checked


# --- every "today" follows the zone --------------------------------------------------


def _sell(client: TestClient, product_id: int) -> Any:
    sale = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": product_id, "quantity": "1"}]},
    )
    assert sale.status_code == 201, sale.text
    return sale.json()


def _product(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    client.post(
        "/stock/entries",
        json={"product_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    return int(variety["id"])


def test_a_sale_at_2330_local_counts_on_that_local_day_in_home_sales_and_analysis(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    _put(client, "America/Los_Angeles")
    clock.set(LOCAL_LATE)

    sale = _sell(client, product_id)

    assert sale["date"] == "2026-10-04"
    panel = client.get("/panel").json()["periods"]
    assert (panel["today"]["start"], panel["today"]["sales_count"]) == ("2026-10-04", 1)
    assert (panel["week"]["start"], panel["week"]["end"]) == ("2026-09-28", "2026-10-04")
    assert panel["week"]["sales_count"] == 1
    assert (panel["month"]["start"], panel["month"]["sales_count"]) == ("2026-10-01", 1)
    listed = client.get("/sales", params={"date_from": "2026-10-04", "date_to": "2026-10-04"})
    assert [row["id"] for row in listed.json()] == [sale["id"]]
    analysis = client.get("/analysis").json()
    assert analysis["today"] == "2026-10-04"
    assert analysis["month"]["month"] == "2026-10"
    assert analysis["month"]["sales_without_shipping"] == 9000


def test_the_same_instant_is_the_next_week_for_a_business_on_argentina_time(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    clock.set(LOCAL_LATE)

    sale = _sell(client, product_id)

    assert sale["date"] == "2026-10-05"
    panel = client.get("/panel").json()["periods"]
    assert panel["week"]["start"] == "2026-10-05"


def test_the_current_price_the_default_dates_and_the_week_follow_the_zone(
    client: TestClient, clock: MovableClock
) -> None:
    clock.set(LOCAL_LATE)
    variety = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-10-05", "list_price": 9000},
    )

    def price() -> Any:
        return client.get("/api/products").json()[0]["current_price"]

    assert price() is not None  # 5 Oct in Argentina
    _put(client, "America/Los_Angeles")  # 4 Oct there
    assert price() is None

    entry = client.post(
        "/stock/entries",
        json={"product_id": variety["id"], "origin": "opening_stock", "quantity": "10"},
    )
    assert entry.status_code == 201, entry.text
    assert entry.json()["date"] == "2026-10-04"


def _stocked_product(client: TestClient) -> int:
    """A product with a price from January and 50 in stock since August, so a sale on any
    date of the scenarios below is allowed."""
    variety = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    entry = client.post(
        "/stock/entries",
        json={
            "product_id": variety["id"],
            "origin": "opening_stock",
            "quantity": "50",
            "date": "2026-08-01",
        },
    )
    assert entry.status_code == 201, entry.text
    return int(variety["id"])


def _sell_on(client: TestClient, product_id: int, day: str | None, quantity: str) -> None:
    body: dict[str, Any] = {
        "payment": "cash",
        "lines": [{"product_id": product_id, "quantity": quantity}],
    }
    if day is not None:
        body["date"] = day
    sale = client.post("/sales", json=body)
    assert sale.status_code == 201, sale.text


def _two_businesses(
    client: TestClient, other_client: TestClient, clock: MovableClock
) -> tuple[TestClient, TestClient]:
    """The same instant (4 Oct 23:30 in Los Angeles, already 5 Oct in Buenos Aires): the first
    business stays on Argentina, the second moves to Los Angeles."""
    clock.set(LOCAL_LATE)
    assert _put(other_client, "America/Los_Angeles").status_code == 200
    return client, other_client


def test_days_left_counts_its_thirty_days_back_from_the_zone_s_today(
    client: TestClient, other_client: TestClient, clock: MovableClock
) -> None:
    argentina, los_angeles = _two_businesses(client, other_client, clock)
    for business in (argentina, los_angeles):
        # 5 Sep is the first day of the 30-day window ending 4 Oct (Los Angeles), and the day
        # before the window ending 5 Oct (Buenos Aires).
        _sell_on(business, _stocked_product(business), "2026-09-05", "5")

    def days_left(business: TestClient) -> Any:
        return business.get("/panel").json()["stock"][0]["days_left"]

    assert days_left(argentina) is None
    assert days_left(los_angeles) == 270


def test_best_week_is_chosen_among_the_eight_weeks_ending_in_the_zone_s_today(
    client: TestClient, other_client: TestClient, clock: MovableClock
) -> None:
    argentina, los_angeles = _two_businesses(client, other_client, clock)
    for business in (argentina, los_angeles):
        product_id = _stocked_product(business)
        # The week of 10 Aug is the eighth back from Los Angeles' week and the ninth from
        # Buenos Aires', so only Los Angeles still counts its big sale.
        _sell_on(business, product_id, "2026-08-12", "10")
        _sell_on(business, product_id, "2026-10-04", "1")

    def best_week(business: TestClient) -> Any:
        weeks = business.get("/analysis").json()["weeks"]
        return [week["first_day"] for week in weeks if week["best"]]

    assert best_week(argentina) == ["2026-09-28"]
    assert best_week(los_angeles) == ["2026-08-10"]


def test_best_weekday_is_the_weekday_of_the_zone_s_own_today(
    client: TestClient, other_client: TestClient, clock: MovableClock
) -> None:
    argentina, los_angeles = _two_businesses(client, other_client, clock)
    for business in (argentina, los_angeles):
        _sell_on(business, _stocked_product(business), None, "1")

    def best_weekday(business: TestClient) -> Any:
        weekdays = business.get("/analysis").json()["weekdays"]
        return [row["weekday"] for row in weekdays if row["best"]]

    assert best_weekday(argentina) == [1]  # Monday 5 Oct
    assert best_weekday(los_angeles) == [7]  # Sunday 4 Oct


def test_records_after_the_new_today_keep_their_dates_and_stay_listed(
    client: TestClient, clock: MovableClock
) -> None:
    product_id = _product(client)
    clock.set(LOCAL_LATE)
    sale = _sell(client, product_id)

    _put(client, "America/Los_Angeles")

    assert sale["date"] == "2026-10-05"
    assert client.get(f"/sales/{sale['id']}").json()["date"] == "2026-10-05"
    assert [row["id"] for row in client.get("/sales").json()] == [sale["id"]]
    assert client.get("/panel").json()["periods"]["today"]["start"] == "2026-10-04"


def test_changing_the_zone_rewrites_no_stored_date(
    client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    product_id = _product(client)
    _sell(client, product_id)
    tables = {
        "sale": "sale_date",
        "stock_entry": "entry_date",
        "price_entry": "effective_from",
    }

    def dates() -> dict[str, list[Any]]:
        with engine.connect() as connection:
            return {
                table: sorted(
                    str(row[0]) for row in connection.execute(text(f"SELECT {c} FROM {table}"))
                )
                for table, c in tables.items()
            }

    before = dates()
    _put(client, EAST)
    _put(client, WEST)

    assert dates() == before
