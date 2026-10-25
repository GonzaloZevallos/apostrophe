"""Varieties and their prices through the HTTP API, over a real database."""

from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.conftest import MovableClock
from tests.fakes.archive import archive_by_hand
from tests.pricing_switches import set_switches

GOLD_JANUARY = {
    "effective_from": "2026-01-01",
    "list_price": 11_000,
    "bulk_price": 10_000,
    "bulk_minimum": 10,
}


def _register(client: TestClient, name: str = "24K Gold") -> dict[str, Any]:
    response = client.post("/varieties", json={"name": name})
    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    return body


def _price(client: TestClient, variety_id: int, **entry: Any) -> dict[str, Any]:
    response = client.post(f"/varieties/{variety_id}/prices", json=entry)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_registered_variety_is_listed_without_a_price_until_it_gets_one(
    client: TestClient,
) -> None:
    variety = _register(client, "  Sir   Jack ")

    assert variety["name"] == "Sir Jack"
    assert variety["current_price"] is None
    assert client.get("/varieties").json() == [variety]


def test_varieties_are_listed_by_name(client: TestClient) -> None:
    for name in ("Sir Jack", "24K Gold", "golden Cookies"):
        _register(client, name)

    names = [v["name"] for v in client.get("/varieties").json()]

    assert names == ["24K Gold", "golden Cookies", "Sir Jack"]


def test_two_varieties_cannot_share_a_name_whatever_the_case(client: TestClient) -> None:
    _register(client, "24K Gold")
    other = _register(client, "Sir Jack")

    assert client.post("/varieties", json={"name": "24k gold"}).status_code == 409
    rename = client.patch(f"/varieties/{other['id']}", json={"name": "24K GOLD"})
    assert rename.status_code == 409


def test_two_businesses_may_each_have_a_variety_of_the_same_name(
    client: TestClient, other_client: TestClient
) -> None:
    _register(client, "24K Gold")

    assert other_client.post("/varieties", json={"name": "24K Gold"}).status_code == 201
    assert [v["name"] for v in other_client.get("/varieties").json()] == ["24K Gold"]


def test_a_variety_can_be_renamed_keeping_its_prices(client: TestClient) -> None:
    variety = _register(client)
    _price(client, variety["id"], **GOLD_JANUARY)

    renamed = client.patch(f"/varieties/{variety['id']}", json={"name": "24K Gold Premium"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "24K Gold Premium"
    assert renamed.json()["current_price"]["list_price"] == 11_000


def test_a_variety_that_does_not_exist_is_not_found(client: TestClient) -> None:
    assert client.get("/varieties/99").status_code == 404
    assert client.post("/varieties/99/prices", json=GOLD_JANUARY).status_code == 404


def test_a_price_entry_is_recorded_and_becomes_the_current_price(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=False)
    variety = _register(client)

    entry = _price(client, variety["id"], **GOLD_JANUARY)

    assert entry == {"id": entry["id"], **GOLD_JANUARY, "vip_price": None}
    listed = client.get(f"/varieties/{variety['id']}").json()
    assert listed["current_price"] == entry


def test_grams_with_two_decimals_go_in_and_out_as_numbers(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=False)
    variety = _register(client)

    entry = _price(client, variety["id"], **{**GOLD_JANUARY, "bulk_minimum": 7.25})

    assert entry["bulk_minimum"] == 7.25


def test_the_current_price_follows_the_day_asked_for(client: TestClient) -> None:
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_JANUARY)
    _price(client, variety_id, effective_from="2026-11-01", list_price=12_000)

    def on(day: str) -> Any:
        response = client.get(f"/varieties/{variety_id}/current-price", params={"on": day})
        if response.status_code != 200:
            return response.status_code
        return response.json()["list_price"]

    assert on("2025-12-31") == 404
    assert on("2026-01-01") == 11_000
    assert on("2026-10-31") == 11_000
    assert on("2026-11-01") == 12_000
    # Without a day, today: 2026-10-02.
    today = client.get(f"/varieties/{variety_id}/current-price").json()
    assert today["list_price"] == 11_000


def test_listing_varieties_follows_the_day_asked_for(client: TestClient) -> None:
    # docs/adr/0011: `GET /varieties?on=` is for Nueva venta's date changes, so a
    # variety's `current_price` in the list answer follows that day, not today.
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_JANUARY)
    _price(client, variety_id, effective_from="2026-11-01", list_price=12_000)

    def listed_price(**params: str) -> Any:
        body = client.get("/varieties", params=params).json()
        return body[0]["current_price"]

    assert listed_price(on="2025-12-31") is None
    assert listed_price(on="2026-01-01")["list_price"] == 11_000
    assert listed_price(on="2026-10-31")["list_price"] == 11_000
    assert listed_price(on="2026-11-01")["list_price"] == 12_000
    # Without `on`, today: 2026-10-02 (tests/conftest.py's clock).
    assert listed_price()["list_price"] == 11_000


def test_today_is_the_business_day_in_argentina(client: TestClient, clock: MovableClock) -> None:
    variety_id = _register(client)["id"]
    _price(client, variety_id, effective_from="2026-10-03", list_price=12_000)

    # 02:00 UTC on the 3rd is still 23:00 on the 2nd in Buenos Aires.
    clock.set(datetime(2026, 10, 3, 2, 0, tzinfo=UTC))
    assert client.get(f"/varieties/{variety_id}").json()["current_price"] is None
    clock.set(datetime(2026, 10, 3, 3, 0, tzinfo=UTC))
    assert client.get(f"/varieties/{variety_id}").json()["current_price"] is not None


def test_a_second_entry_on_the_same_day_is_refused(client: TestClient) -> None:
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_JANUARY)

    again = client.post(f"/varieties/{variety_id}/prices", json=GOLD_JANUARY)

    assert again.status_code == 409


def test_a_broken_price_entry_is_refused_with_the_rule_it_breaks(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=False)
    variety_id = _register(client)["id"]

    def refusal(**changes: Any) -> tuple[int, str]:
        entry = {**GOLD_JANUARY, **changes}
        response = client.post(f"/varieties/{variety_id}/prices", json=entry)
        return response.status_code, response.json()["detail"]

    assert refusal(bulk_price=None) == (422, "a bulk price and a bulk minimum go together")
    assert refusal(bulk_price=11_000) == (422, "the bulk price must be lower than the list price")
    assert refusal(list_price=0)[0] == 422
    assert refusal(bulk_minimum=0.001)[0] == 422


def test_the_price_history_is_newest_first(client: TestClient) -> None:
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_JANUARY)
    _price(client, variety_id, effective_from="2026-06-01", list_price=12_000)

    history = client.get(f"/varieties/{variety_id}/prices").json()

    assert [e["effective_from"] for e in history] == ["2026-06-01", "2026-01-01"]


def test_a_deleted_entry_leaves_the_history_and_the_previous_price_rules_again(
    client: TestClient,
) -> None:
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_JANUARY)
    mistake = _price(client, variety_id, effective_from="2026-09-01", list_price=99_000)

    deleted = client.delete(f"/varieties/{variety_id}/prices/{mistake['id']}")

    assert deleted.status_code == 204
    assert len(client.get(f"/varieties/{variety_id}/prices").json()) == 1
    assert client.get(f"/varieties/{variety_id}").json()["current_price"]["list_price"] == 11_000
    again = client.delete(f"/varieties/{variety_id}/prices/{mistake['id']}")
    assert again.status_code == 404


def test_refusal_bodies_carry_the_rule_s_code(client: TestClient) -> None:
    """One behaviour test per code family of this capability (docs/adr/0008)."""
    bad_name = client.post("/varieties", json={"name": ""})
    assert bad_name.status_code == 422
    assert bad_name.json()["code"] == "variety.name_invalid"

    variety_id = _register(client)["id"]
    bad_grams = client.post(
        f"/varieties/{variety_id}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": "3.555",
        },
    )
    assert bad_grams.status_code == 422
    assert bad_grams.json()["code"] == "grams.invalid"


GOLD_WITH_VIP = {**GOLD_JANUARY, "vip_price": 9_000}


def test_a_vip_price_is_stored_and_answered_on_the_entry_the_current_price_and_the_history(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]

    entry = _price(client, variety_id, **GOLD_WITH_VIP)

    assert entry["vip_price"] == 9_000
    assert client.get(f"/varieties/{variety_id}").json()["current_price"]["vip_price"] == 9_000
    assert client.get(f"/varieties/{variety_id}/current-price").json()["vip_price"] == 9_000
    assert client.get(f"/varieties/{variety_id}/prices").json()[0]["vip_price"] == 9_000
    assert client.get("/varieties").json()[0]["current_price"]["vip_price"] == 9_000


def test_an_entry_without_a_vip_price_answers_null(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]

    assert _price(client, variety_id, **GOLD_JANUARY)["vip_price"] is None


def test_a_vip_price_alone_and_a_bulk_price_alone_are_both_accepted(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]

    only_vip = _price(
        client, variety_id, effective_from="2026-01-01", list_price=11_000, vip_price=9_000
    )
    only_bulk = _price(client, variety_id, **{**GOLD_JANUARY, "effective_from": "2026-02-01"})

    assert (only_vip["vip_price"], only_vip["bulk_price"]) == (9_000, None)
    assert (only_bulk["vip_price"], only_bulk["bulk_price"]) == (None, 10_000)


def test_a_vip_price_above_the_bulk_price_is_accepted(client: TestClient, engine: Engine) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]

    entry = _price(client, variety_id, **{**GOLD_JANUARY, "vip_price": 10_500})

    assert (entry["bulk_price"], entry["vip_price"]) == (10_000, 10_500)


def test_a_vip_price_at_or_above_list_is_refused_with_its_code_and_without_the_amount(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]

    for vip_price in (11_000, 12_345):
        response = client.post(
            f"/varieties/{variety_id}/prices", json={**GOLD_JANUARY, "vip_price": vip_price}
        )
        assert response.status_code == 422
        assert response.json()["code"] == "variety.vip_price_not_below_list"
        assert str(vip_price) not in response.text
        assert "11000" not in response.text
    assert client.get(f"/varieties/{variety_id}/prices").json() == []


def test_with_bulk_off_the_bulk_values_posted_are_not_stored(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=True)
    variety_id = _register(client)["id"]

    entry = _price(client, variety_id, **GOLD_WITH_VIP)

    assert (entry["bulk_price"], entry["bulk_minimum"], entry["vip_price"]) == (None, None, 9_000)


def test_with_bulk_off_a_bulk_price_that_would_be_refused_is_dropped_before_any_rule(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False)
    variety_id = _register(client)["id"]

    entry = _price(client, variety_id, **{**GOLD_JANUARY, "bulk_price": 11_000})

    assert (entry["bulk_price"], entry["bulk_minimum"]) == (None, None)


def test_with_vip_off_the_vip_price_posted_is_not_stored_even_when_it_would_be_refused(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=False)
    variety_id = _register(client)["id"]

    kept = _price(client, variety_id, **GOLD_WITH_VIP)
    refused_amount = _price(
        client, variety_id, **{**GOLD_JANUARY, "effective_from": "2026-02-01", "vip_price": 99_000}
    )

    assert kept["vip_price"] is None
    assert kept["bulk_price"] == 10_000
    assert refused_amount["vip_price"] is None


def test_an_earlier_entry_keeps_its_stored_rules_when_a_later_one_is_recorded_with_them_off(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=True)
    variety_id = _register(client)["id"]
    _price(client, variety_id, **GOLD_WITH_VIP)

    set_switches(engine, bulk=False, vip=False)
    later = _price(client, variety_id, **{**GOLD_WITH_VIP, "effective_from": "2026-06-01"})

    assert (later["bulk_price"], later["vip_price"]) == (None, None)
    history = {e["effective_from"]: e for e in client.get(f"/varieties/{variety_id}/prices").json()}
    assert (history["2026-01-01"]["bulk_price"], history["2026-01-01"]["vip_price"]) == (
        10_000,
        9_000,
    )

    set_switches(engine, bulk=True, vip=True)
    current = client.get(f"/varieties/{variety_id}/current-price").json()
    assert (current["bulk_price"], current["vip_price"]) == (None, None)
    assert history["2026-01-01"]["vip_price"] == 9_000


def test_one_business_s_switches_never_gate_another_business_s_entries(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False, business_name="Primer Negocio")
    set_switches(engine, bulk=True, vip=True, business_name="Otro Negocio")
    mine = _price(client, _register(client)["id"], **GOLD_WITH_VIP)
    theirs = _price(other_client, _register(other_client)["id"], **GOLD_WITH_VIP)

    assert (mine["bulk_price"], mine["vip_price"]) == (None, None)
    assert (theirs["bulk_price"], theirs["vip_price"]) == (10_000, 9_000)


def test_an_archived_variety_is_absent_from_the_list_but_still_found_by_id(
    client: TestClient, engine: Engine
) -> None:
    kept = _register(client, "Kept")
    gone = _register(client, "Gone")
    archive_by_hand(engine, gone["id"])

    assert [v["id"] for v in client.get("/varieties").json()] == [kept["id"]]
    assert client.get(f"/varieties/{gone['id']}").status_code == 200


def test_an_archived_variety_still_holds_its_name(client: TestClient, engine: Engine) -> None:
    gone = _register(client, "Gone")
    archive_by_hand(engine, gone["id"])

    assert client.post("/varieties", json={"name": " GONE "}).status_code == 409
    other = _register(client, "Other")
    assert client.patch(f"/varieties/{other['id']}", json={"name": "gone"}).status_code == 409
