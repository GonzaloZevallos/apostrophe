"""`GET` and `PUT /pricing-settings`, through `TestClient` (the subtask's declared seams):
a business reads and changes only its own switches, and only a change that can alter the
pinned catalog's text schedules upkeep (docs/adr/0014, docs/adr/0034)."""

from typing import Any

from fastapi.testclient import TestClient

from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"


def _put(client: TestClient, *, bulk: bool, vip: bool) -> Any:
    return client.put("/pricing-settings", json={"is_bulk_pricing": bulk, "is_vip_customers": vip})


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _publish_a_catalog_with_a_bulk_price(client: TestClient) -> None:
    variety = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        "/stock/entries",
        json={"variety_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    priced = client.post(
        f"/api/products/{variety['id']}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 9000,
            "bulk_price": 8000,
            "bulk_minimum": "10",
        },
    )
    assert priced.status_code == 201, priced.text
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text


def test_a_new_business_reads_both_switches_off(client: TestClient) -> None:
    response = client.get("/pricing-settings")

    assert response.status_code == 200
    assert response.json() == {"is_bulk_pricing": False, "is_vip_customers": False}


def test_put_changes_the_switches_and_answers_them(client: TestClient) -> None:
    response = _put(client, bulk=True, vip=False)

    assert response.status_code == 200, response.text
    assert response.json() == {"is_bulk_pricing": True, "is_vip_customers": False}
    assert client.get("/pricing-settings").json() == {
        "is_bulk_pricing": True,
        "is_vip_customers": False,
    }


def test_put_leaves_another_business_switches_as_they_were(
    client: TestClient, other_client: TestClient
) -> None:
    _put(client, bulk=True, vip=True)

    assert other_client.get("/pricing-settings").json() == {
        "is_bulk_pricing": False,
        "is_vip_customers": False,
    }


def test_both_routes_refuse_a_request_without_a_session(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/pricing-settings").status_code == 401
    assert (
        anonymous_client.put(
            "/pricing-settings", json={"is_bulk_pricing": True, "is_vip_customers": True}
        ).status_code
        == 401
    )


def test_a_body_without_both_switches_is_refused_and_changes_nothing(
    client: TestClient,
) -> None:
    _put(client, bulk=True, vip=True)

    response = client.put("/pricing-settings", json={"is_bulk_pricing": False})

    assert response.status_code == 422
    assert client.get("/pricing-settings").json() == {
        "is_bulk_pricing": True,
        "is_vip_customers": True,
    }


def _leave_the_pin_failed(client: TestClient, telegram: FakeTelegram) -> None:
    """A pin that failed to sync needs a send whatever the text says, so an upkeep that
    runs retries at once and a task that never ran leaves it failed: that tells a
    scheduled upkeep from a no-op, independently of what the text holds."""
    variety_id = client.get("/api/products").json()[0]["id"]
    telegram.fail_next(TelegramUnreachable())
    client.patch(f"/api/products/{variety_id}", json={"name": "V1 Renamed"})
    status = client.get("/pinned-catalog/status").json()["status"]
    assert status["reason"] == "telegram_unreachable"
    telegram.calls.clear()


def test_a_changed_switch_schedules_an_upkeep(client: TestClient, telegram: FakeTelegram) -> None:
    _put(client, bulk=True, vip=False)
    _publish_a_catalog_with_a_bulk_price(client)
    _leave_the_pin_failed(client, telegram)

    assert _put(client, bulk=False, vip=False).status_code == 200

    assert len(_edits(telegram)) == 1
    assert client.get("/pinned-catalog/status").json()["status"]["state"] == "up_to_date"


def test_changing_only_vip_sends_nothing(client: TestClient, telegram: FakeTelegram) -> None:
    _put(client, bulk=True, vip=False)
    _publish_a_catalog_with_a_bulk_price(client)
    telegram.calls.clear()

    assert _put(client, bulk=True, vip=True).status_code == 200

    assert telegram.calls == []


def test_a_put_with_unchanged_values_schedules_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _put(client, bulk=True, vip=False)
    _publish_a_catalog_with_a_bulk_price(client)
    _leave_the_pin_failed(client, telegram)

    assert _put(client, bulk=True, vip=False).status_code == 200

    assert telegram.calls == []
    failed = client.get("/pinned-catalog/status").json()["status"]
    assert failed["reason"] == "telegram_unreachable"


def test_turning_bulk_off_edits_the_pin_to_a_text_without_the_bulk_line(
    client: TestClient, telegram: FakeTelegram
) -> None:
    """The brief's trigger row, with no failed pin to force the edit: the text itself
    changes, because the pinned catalog builds it through the catalog's switch-aware
    read (the integration of settings-routes with catalog)."""
    _put(client, bulk=True, vip=False)
    _publish_a_catalog_with_a_bulk_price(client)
    sent = [call for call in telegram.calls if call[0] == "send"]
    assert "From 10 g" in sent[-1][3]
    telegram.calls.clear()

    assert _put(client, bulk=False, vip=False).status_code == 200

    edits = _edits(telegram)
    assert len(edits) == 1
    assert "From 10 g" not in edits[0][3]
    assert "Price per gram: $9.000" in edits[0][3]


def test_a_pin_published_while_bulk_is_off_has_no_bulk_line(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _put(client, bulk=True, vip=True)
    _publish_a_catalog_with_a_bulk_price(client)
    telegram.calls.clear()
    _put(client, bulk=False, vip=True)
    telegram.calls.clear()

    variety_id = client.get("/api/products").json()[0]["id"]
    client.patch(f"/api/products/{variety_id}", json={"name": "V1 Renamed"})

    edits = _edits(telegram)
    assert len(edits) == 1
    assert "V1 Renamed" in edits[0][3]
    assert "From" not in edits[0][3]
    assert "VIP" not in edits[0][3]
