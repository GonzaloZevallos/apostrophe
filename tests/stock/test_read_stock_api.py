"""`GET /stock` and `PUT /stock/varieties/{variety_id}/threshold` through the HTTP API,
over a real database (CODING_STANDARDS section 5): the one place a variety's grams,
status and days left are computed is `stock_level` over `lots_and_draws`, read here only
through the routes' own answers.
"""

from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.conftest import NOW, MovableClock
from tests.fakes.archive import archive_by_hand

TODAY = "2026-10-02"


def _variety_id(client: TestClient, name: str = "Zkittlez") -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _priced_variety_id(client: TestClient, name: str = "Zkittlez", list_price: int = 10_000) -> int:
    variety_id = _variety_id(client, name)
    client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return variety_id


def _record(client: TestClient, variety_id: int, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "opening_stock", "grams": "50"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def _sale(client: TestClient, variety_id: int, grams: str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "payment": "cash",
        "lines": [{"variety_id": variety_id, "grams": grams}],
    }
    body.update(overrides)
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def _variety_row(stock: dict[str, Any], variety_id: int) -> dict[str, Any]:
    rows = [row for row in stock["varieties"] if row["variety_id"] == variety_id]
    assert len(rows) == 1, stock
    row: dict[str, Any] = rows[0]
    return row


def test_a_fresh_business_has_no_stock(client: TestClient) -> None:
    stock = client.get("/stock").json()

    assert stock["total"] == 0.0
    assert stock["varieties"] == []
    assert stock["entries"] == []


def test_a_variety_with_no_entries_reads_no_entries(client: TestClient) -> None:
    variety_id = _variety_id(client)

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "no_entries"
    assert row["grams"] == 0.0
    assert row["days_left"] is None


def test_an_entry_shows_up_in_grams_total_and_entries(client: TestClient) -> None:
    variety_id = _variety_id(client)
    entry = _record(client, variety_id, grams="50")

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "ok"
    assert row["grams"] == 50.0
    assert stock["total"] == 50.0
    assert stock["entries"][0]["id"] == entry["id"]


def test_a_variety_at_or_below_zero_reads_sold_out(client: TestClient) -> None:
    variety_id = _variety_id(client)
    _record(client, variety_id, grams="10")
    _record(client, variety_id, origin="adjustment", grams="-10")

    stock = client.get("/stock").json()

    row = _variety_row(stock, variety_id)
    assert row["status"] == "sold_out"
    assert row["sold_out_since"] == TODAY
    assert row["grams"] == 0.0


def test_setting_a_threshold_makes_low_stock_show_up(client: TestClient) -> None:
    variety_id = _variety_id(client)
    _record(client, variety_id, grams="10")

    set_response = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "20"})

    assert set_response.status_code == 200, set_response.text
    body = set_response.json()
    assert body["variety_id"] == variety_id
    assert body["threshold"] == 20.0
    assert body["status"] == "low"

    stock = client.get("/stock").json()
    assert _variety_row(stock, variety_id)["threshold"] == 20.0


def test_turning_off_a_threshold_is_idempotent(client: TestClient) -> None:
    variety_id = _variety_id(client)
    client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "20"})

    first_off = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": None})
    second_off = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": None})

    assert first_off.status_code == 200
    assert first_off.json()["threshold"] is None
    assert second_off.status_code == 200
    assert second_off.json()["threshold"] is None


def test_a_zero_threshold_is_refused(client: TestClient) -> None:
    variety_id = _variety_id(client)

    response = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "0"})

    assert response.status_code == 422
    assert response.json()["code"] == "stock.threshold_invalid"


def test_an_unknown_variety_threshold_is_not_found(client: TestClient) -> None:
    response = client.put("/stock/varieties/999999/threshold", json={"grams": "10"})

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def test_a_foreign_variety_threshold_answers_the_same_404(
    client: TestClient, other_client: TestClient
) -> None:
    foreign_variety = _variety_id(other_client)

    response = client.put(f"/stock/varieties/{foreign_variety}/threshold", json={"grams": "10"})

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def test_a_malformed_threshold_grams_value_is_refused(client: TestClient) -> None:
    variety_id = _variety_id(client)

    response = client.put(f"/stock/varieties/{variety_id}/threshold", json={"grams": "1.234"})

    assert response.status_code == 422
    assert response.json()["code"] == "grams.invalid"


def test_turning_off_an_unset_threshold_is_not_found_for_a_foreign_or_missing_variety(
    client: TestClient, other_client: TestClient
) -> None:
    foreign_variety = _variety_id(other_client)

    missing = client.put("/stock/varieties/999999/threshold", json={"grams": None})
    foreign = client.put(f"/stock/varieties/{foreign_variety}/threshold", json={"grams": None})

    assert missing.status_code == 404
    assert foreign.status_code == 404
    assert missing.json()["code"] == foreign.json()["code"] == "variety.not_found"


def test_a_sale_draws_down_stock_and_deleting_it_restores_the_grams(client: TestClient) -> None:
    """Proves `SqlDraws` actually runs against the database: with a fake or an always
    empty `for_varieties`, the sale's grams would never leave stock at all."""
    variety_id = _priced_variety_id(client)
    _record(client, variety_id, grams="50")

    sale = _sale(client, variety_id, "10")
    after_sale = client.get("/stock").json()
    assert _variety_row(after_sale, variety_id)["grams"] == 40.0

    deleted = client.delete(f"/sales/{sale['id']}")
    assert deleted.status_code == 200, deleted.text

    after_delete = client.get("/stock").json()
    assert _variety_row(after_delete, variety_id)["grams"] == 50.0


def test_a_gift_also_draws_down_stock(client: TestClient) -> None:
    variety_id = _priced_variety_id(client)
    _record(client, variety_id, grams="50")

    _sale(client, variety_id, "10", lines=[{"variety_id": variety_id, "grams": "10", "gift": True}])

    stock = client.get("/stock").json()
    assert _variety_row(stock, variety_id)["grams"] == 40.0


def test_a_sale_beyond_stock_oversells_into_negative_and_sold_out(client: TestClient) -> None:
    variety_id = _priced_variety_id(client)
    _record(client, variety_id, grams="5")

    _sale(client, variety_id, "10")

    stock = client.get("/stock").json()
    row = _variety_row(stock, variety_id)
    assert row["grams"] == -5.0
    assert row["status"] == "sold_out"


def test_a_sale_with_no_stock_entries_reads_sold_out_not_no_entries(client: TestClient) -> None:
    variety_id = _priced_variety_id(client)

    _sale(client, variety_id, "5")

    stock = client.get("/stock").json()
    row = _variety_row(stock, variety_id)
    assert row["status"] == "sold_out"
    assert row["sold_out_since"] == TODAY
    assert row["grams"] == -5.0


def test_days_left_counts_only_sales_within_the_last_30_days(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _priced_variety_id(client)
    _record(client, variety_id, grams="100")
    _sale(client, variety_id, "10")

    stock = client.get("/stock").json()
    row = _variety_row(stock, variety_id)
    # 90 g left, 10 g sold today: (90 * 30) // 10 = 270 whole days.
    assert row["grams"] == 90.0
    assert row["days_left"] == 270

    # Move exactly 30 days past the sale (still inside the session's own lifetime):
    # it falls out of the 30-day pacing window, so there is nothing left to pace
    # from, even though stock is still positive.
    clock.set(NOW + timedelta(days=30))
    later_stock = client.get("/stock").json()
    later_row = _variety_row(later_stock, variety_id)
    assert later_row["grams"] == 90.0
    assert later_row["status"] == "ok"
    assert later_row["days_left"] is None


def test_an_archived_variety_leaves_the_rows_but_its_grams_stay_in_the_total(
    client: TestClient, engine: Engine
) -> None:
    kept = _variety_id(client, "Kept")
    archived = _variety_id(client, "Archived")
    _record(client, kept, grams="30")
    _record(client, archived, grams="20")
    archive_by_hand(engine, archived)

    stock = client.get("/stock").json()

    assert [row["variety_id"] for row in stock["varieties"]] == [kept]
    assert stock["total"] == 50.0


def test_the_archived_rows_are_read_with_archived_true_and_the_total_does_not_change(
    client: TestClient, engine: Engine
) -> None:
    kept = _variety_id(client, "Kept")
    archived = _variety_id(client, "Archived")
    _record(client, kept, grams="30")
    _record(client, archived, grams="20")
    total_before = client.get("/stock").json()["total"]
    archive_by_hand(engine, archived)

    default = client.get("/stock").json()
    only_archived = client.get("/stock?archived=true").json()

    assert [row["variety_id"] for row in default["varieties"]] == [kept]
    assert [row["variety_id"] for row in only_archived["varieties"]] == [archived]
    assert only_archived["varieties"][0]["grams"] == 20.0
    assert default["total"] == total_before == only_archived["total"]
    assert [entry["variety_id"] for entry in only_archived["entries"]] == [
        entry["variety_id"] for entry in default["entries"]
    ]


def test_archived_false_is_the_default_rows(client: TestClient, engine: Engine) -> None:
    kept = _variety_id(client, "Kept")
    archived = _variety_id(client, "Archived")
    archive_by_hand(engine, archived)

    rows = client.get("/stock?archived=false").json()["varieties"]

    assert [row["variety_id"] for row in rows] == [kept]


def test_entries_sort_by_date_then_recorded_at_then_id_newest_first(
    client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    """Characterises the entries list's order (date, recorded_at, id, all descending)
    and that an archived variety's grams stay in the total and its entry in the list."""
    kept = _variety_id(client, "Kept")
    archived = _variety_id(client, "Archived")
    day = "2026-10-02"

    # The session was issued at NOW, so the clock never goes before it: the recordings
    # are placed at NOW + n hours, the later one recorded first where the test needs it.
    def at(hours: int) -> None:
        clock.set(NOW + timedelta(hours=hours))

    at(2)
    b = _record(client, kept, grams="1", date=day)["id"]
    at(1)
    c = _record(client, kept, grams="2", date=day)["id"]
    at(0)
    e = _record(client, kept, grams="3", date=day)["id"]
    f = _record(client, kept, grams="4", date=day)["id"]
    at(3)
    a = _record(client, kept, grams="5", date="2026-10-01")["id"]
    archived_entry = _record(client, archived, grams="20", date="2026-09-30")["id"]
    archive_by_hand(engine, archived)

    stock = client.get("/stock").json()

    # (i) the date decides: a, a day earlier, comes after every entry of `day` even
    # though it was recorded last; (ii) recorded_at decides: b (latest) before c
    # though c has the higher id; (iii) the id decides: f before e, both recorded at NOW.
    assert [entry["id"] for entry in stock["entries"]] == [b, c, f, e, a, archived_entry]
    assert stock["total"] == 35.0
    assert [row["variety_id"] for row in stock["varieties"]] == [kept]
