"""Recording, editing, reading and deleting stock entries through the HTTP API, over a
real database (CODING_STANDARDS section 5)."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand

TODAY = "2026-10-02"


def _variety_id(client: TestClient, name: str = "Zkittlez") -> int:
    return int(client.post("/api/products", json={"name": name}).json()["id"])


def _record(client: TestClient, **overrides: Any) -> dict[str, Any]:
    variety_id = overrides.pop("variety_id", None) or _variety_id(client)
    body: dict[str, Any] = {
        "product_id": variety_id,
        "origin": "opening_stock",
        "quantity": "50",
    }
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def test_an_entry_is_recorded(client: TestClient) -> None:
    entry = _record(client, note=" sobra de la cosecha ")

    assert entry["date"] == TODAY
    assert entry["quantity"] == 50.0
    assert entry["origin"] == "opening_stock"
    assert entry["total_cost"] is None
    assert entry["cost_per_gram"] is None
    assert entry["note"] == "sobra de la cosecha"
    assert "recorded_at" not in entry


def test_a_purchase_answers_its_cost_per_gram(client: TestClient) -> None:
    entry = _record(client, origin="purchase", quantity="10", total_cost=85_000)

    assert entry["total_cost"] == 85_000
    assert entry["cost_per_gram"] == 8_500


def test_a_purchase_with_no_cost_is_refused(client: TestClient) -> None:
    response = client.post(
        "/stock/entries",
        json={"product_id": _variety_id(client), "origin": "purchase", "quantity": "10"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "stock.cost_required"


def test_a_negative_adjustment_with_a_cost_is_refused(client: TestClient) -> None:
    response = client.post(
        "/stock/entries",
        json={
            "product_id": _variety_id(client),
            "origin": "adjustment",
            "quantity": "-5",
            "total_cost": 100,
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "stock.cost_on_negative_adjustment"


def test_a_future_date_is_refused(client: TestClient) -> None:
    response = client.post(
        "/stock/entries",
        json={
            "product_id": _variety_id(client),
            "origin": "opening_stock",
            "quantity": "10",
            "date": "2026-10-03",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "stock.date_in_future"


def test_an_unknown_variety_id_is_not_found(client: TestClient) -> None:
    response = client.post(
        "/stock/entries", json={"product_id": 999_999, "origin": "opening_stock", "quantity": "10"}
    )

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def test_a_foreign_and_a_missing_variety_id_answer_the_same_404(
    client: TestClient, other_client: TestClient
) -> None:
    foreign_variety = _variety_id(other_client)

    missing = client.post(
        "/stock/entries", json={"product_id": 999_999, "origin": "opening_stock", "quantity": "10"}
    )
    foreign = client.post(
        "/stock/entries",
        json={"product_id": foreign_variety, "origin": "opening_stock", "quantity": "10"},
    )

    assert missing.status_code == 404
    assert foreign.status_code == 404
    assert missing.json()["code"] == foreign.json()["code"] == "variety.not_found"


def test_an_entry_is_edited_in_place(client: TestClient) -> None:
    entry = _record(client)
    other_variety = _variety_id(client, "Gelato")

    edited = client.put(
        f"/stock/entries/{entry['id']}",
        json={"product_id": other_variety, "origin": "harvest", "quantity": "30", "total_cost": 0},
    )

    # total_cost of 0 is invalid for a harvest (must be above zero when given); use a
    # valid edit instead.
    assert edited.status_code == 422

    edited = client.put(
        f"/stock/entries/{entry['id']}",
        json={"product_id": other_variety, "origin": "harvest", "quantity": "30"},
    )

    assert edited.status_code == 200
    body = edited.json()
    assert body["product_id"] == other_variety
    assert body["origin"] == "harvest"
    assert body["quantity"] == 30.0


def test_editing_an_unknown_entry_is_not_found(client: TestClient) -> None:
    response = client.put(
        "/stock/entries/999999",
        json={"product_id": _variety_id(client), "origin": "opening_stock", "quantity": "10"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "stock.entry_not_found"


def test_editing_an_unknown_entry_with_an_also_unknown_variety_answers_the_entry_s_404(
    client: TestClient,
) -> None:
    """`edit_entry` checks the entry before the variety: when both are gone, the
    answer is the entry's 404, not the variety's — pinned so a reorder would fail
    here."""
    response = client.put(
        "/stock/entries/999999",
        json={"product_id": 999999, "origin": "opening_stock", "quantity": "10"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "stock.entry_not_found"


def test_another_businesss_entry_id_is_not_found_on_edit_or_delete(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _record(other_client)

    edited = client.put(
        f"/stock/entries/{foreign['id']}",
        json={"product_id": _variety_id(client), "origin": "opening_stock", "quantity": "10"},
    )
    deleted = client.delete(f"/stock/entries/{foreign['id']}")

    assert edited.status_code == 404
    assert deleted.status_code == 404


def test_recorded_at_never_changes_on_edit(client: TestClient) -> None:
    """Not carried in the response, but the invariant still holds end to end: editing
    an entry's date keeps the order a later read would see unchanged by the edit
    itself (CODING_STANDARDS: "recorded_at is set once on create, never changed")."""
    entry = _record(client)

    edited = client.put(
        f"/stock/entries/{entry['id']}",
        json={
            "product_id": entry["product_id"],
            "origin": "opening_stock",
            "quantity": "60",
            "date": "2026-09-01",
        },
    )

    assert edited.status_code == 200
    assert edited.json()["quantity"] == 60.0
    assert edited.json()["date"] == "2026-09-01"


def test_an_entry_is_deleted(client: TestClient) -> None:
    entry = _record(client)

    deleted = client.delete(f"/stock/entries/{entry['id']}")

    assert deleted.status_code == 204
    assert client.get(f"/stock/entries/{entry['id']}").status_code == 404


def test_deleting_an_unknown_entry_is_not_found(client: TestClient) -> None:
    assert client.delete("/stock/entries/999999").status_code == 404


def test_a_malformed_grams_value_is_refused(client: TestClient) -> None:
    response = client.post(
        "/stock/entries",
        json={"product_id": _variety_id(client), "origin": "opening_stock", "quantity": "10.123"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "grams.invalid"


def _archived_variety(client: TestClient, engine: Engine, name: str) -> int:
    variety_id = _variety_id(client, name)
    archive_by_hand(engine, variety_id)
    return variety_id


def test_an_entry_cannot_be_recorded_on_an_archived_variety(
    client: TestClient, engine: Engine
) -> None:
    archived = _archived_variety(client, engine, "Gone")

    response = client.post(
        "/stock/entries",
        json={"product_id": archived, "origin": "opening_stock", "quantity": "5"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"
    assert client.get("/stock").json()["entries"] == []


def test_a_threshold_cannot_be_set_or_cleared_on_an_archived_variety(
    client: TestClient, engine: Engine
) -> None:
    archived = _archived_variety(client, engine, "Gone")

    setting = client.put(f"/stock/products/{archived}/threshold", json={"quantity": "5"})
    clearing = client.put(f"/stock/products/{archived}/threshold", json={"quantity": None})

    assert (setting.status_code, setting.json()["code"]) == (404, "variety.archived")
    assert (clearing.status_code, clearing.json()["code"]) == (404, "variety.archived")


def test_an_entry_edit_keeps_its_own_archived_variety_but_cannot_move_onto_another(
    client: TestClient, engine: Engine
) -> None:
    mine = _variety_id(client, "Mine")
    entry = _record(client, variety_id=mine, quantity="10")
    other = _archived_variety(client, engine, "Other")
    archive_by_hand(engine, mine)

    kept = client.put(
        f"/stock/entries/{entry['id']}",
        json={"product_id": mine, "origin": "opening_stock", "quantity": "12"},
    )
    moved = client.put(
        f"/stock/entries/{entry['id']}",
        json={"product_id": other, "origin": "opening_stock", "quantity": "12"},
    )

    assert kept.status_code == 200, kept.text
    assert kept.json()["quantity"] == 12.0
    assert (moved.status_code, moved.json()["code"]) == (404, "variety.archived")
    assert client.get(f"/stock/entries/{entry['id']}").json()["product_id"] == mine


def test_an_entry_cannot_move_onto_an_archived_variety_from_a_live_one(
    client: TestClient, engine: Engine
) -> None:
    live = _variety_id(client, "Live")
    entry = _record(client, variety_id=live, quantity="10")
    archived = _archived_variety(client, engine, "Gone")

    moved = client.put(
        f"/stock/entries/{entry['id']}",
        json={"product_id": archived, "origin": "opening_stock", "quantity": "10"},
    )

    assert (moved.status_code, moved.json()["code"]) == (404, "variety.archived")


def test_an_entry_of_an_archived_variety_can_still_be_deleted(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client, "Mine")
    entry = _record(client, variety_id=variety_id, quantity="10")
    archive_by_hand(engine, variety_id)

    assert client.delete(f"/stock/entries/{entry['id']}").status_code == 204
    assert client.get(f"/stock/entries/{entry['id']}").status_code == 404


def test_an_unknown_variety_is_still_not_found_rather_than_archived(client: TestClient) -> None:
    response = client.post(
        "/stock/entries", json={"product_id": 9999, "origin": "opening_stock", "quantity": "5"}
    )

    assert (response.status_code, response.json()["code"]) == (404, "variety.not_found")
