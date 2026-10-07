"""Archiving and restoring a variety through the HTTP API (docs/product/varieties.md).

Archive and restore are never refused because the variety has or lacks history; an
archived variety is read-only and keeps its name reserved."""

from typing import Any

import pytest
from fastapi.testclient import TestClient


def _register(client: TestClient, name: str = "24K Gold") -> int:
    response = client.post("/varieties", json={"name": name})
    assert response.status_code == 201, response.text
    variety_id: int = response.json()["id"]
    return variety_id


def _give_history(client: TestClient, variety_id: int) -> None:
    entry = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "12"},
    )
    assert entry.status_code == 201, entry.text


def _archived_names(client: TestClient) -> list[str]:
    return [v["name"] for v in client.get("/varieties", params={"archived": "true"}).json()]


def _listed_names(client: TestClient) -> list[str]:
    return [v["name"] for v in client.get("/varieties").json()]


@pytest.mark.parametrize("with_history", [True, False])
def test_a_live_variety_is_archived_whether_or_not_it_has_history(
    client: TestClient, with_history: bool
) -> None:
    variety_id = _register(client)
    if with_history:
        _give_history(client, variety_id)

    response = client.post(f"/varieties/{variety_id}/archive")

    assert response.status_code == 200, response.text
    assert response.json()["archived"] is True
    assert _listed_names(client) == []
    assert _archived_names(client) == ["24K Gold"]


@pytest.mark.parametrize("with_history", [True, False])
def test_an_archived_variety_is_restored_whether_or_not_it_has_history(
    client: TestClient, with_history: bool
) -> None:
    variety_id = _register(client)
    if with_history:
        _give_history(client, variety_id)
    client.post(f"/varieties/{variety_id}/archive")

    response = client.post(f"/varieties/{variety_id}/restore")

    assert response.status_code == 200, response.text
    assert response.json()["archived"] is False
    assert _listed_names(client) == ["24K Gold"]
    assert _archived_names(client) == []


def test_archiving_twice_and_restoring_a_live_variety_change_nothing(
    client: TestClient,
) -> None:
    variety_id = _register(client)

    assert client.post(f"/varieties/{variety_id}/restore").json()["archived"] is False
    first = client.post(f"/varieties/{variety_id}/archive")
    second = client.post(f"/varieties/{variety_id}/archive")

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert _archived_names(client) == ["24K Gold"]


@pytest.mark.parametrize("action", ["archive", "restore"])
def test_a_missing_variety_cannot_be_archived_or_restored(
    client: TestClient, action: str
) -> None:
    response = client.post(f"/varieties/999/{action}")

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def test_archive_keeps_the_prices_and_restore_brings_them_back(client: TestClient) -> None:
    variety_id = _register(client)
    price = {"effective_from": "2026-01-01", "list_price": 11_000}
    assert client.post(f"/varieties/{variety_id}/prices", json=price).status_code == 201
    before = client.get(f"/varieties/{variety_id}").json()

    client.post(f"/varieties/{variety_id}/archive")
    archived = client.get(f"/varieties/{variety_id}").json()
    client.post(f"/varieties/{variety_id}/restore")
    after = client.get(f"/varieties/{variety_id}").json()

    assert archived == {**before, "archived": True}
    assert after == before


def test_an_archived_variety_cannot_be_renamed_or_priced_or_unpriced(
    client: TestClient,
) -> None:
    variety_id = _register(client)
    price = {"effective_from": "2026-01-01", "list_price": 11_000}
    entry_id = client.post(f"/varieties/{variety_id}/prices", json=price).json()["id"]
    client.post(f"/varieties/{variety_id}/archive")

    responses: list[Any] = [
        client.patch(f"/varieties/{variety_id}", json={"name": "Silver"}),
        client.post(
            f"/varieties/{variety_id}/prices",
            json={"effective_from": "2026-02-01", "list_price": 12_000},
        ),
        client.delete(f"/varieties/{variety_id}/prices/{entry_id}"),
    ]

    assert [r.status_code for r in responses] == [404, 404, 404]
    assert [r.json()["code"] for r in responses] == ["variety.archived"] * 3
    assert len(client.get(f"/varieties/{variety_id}/prices").json()) == 1


@pytest.mark.parametrize("typed", ["24K Gold", "24k gold", "  24K   GOLD "])
def test_an_archived_name_is_refused_on_add_in_any_case_or_spacing(
    client: TestClient, typed: str
) -> None:
    client.post(f"/varieties/{_register(client)}/archive")

    response = client.post("/varieties", json={"name": typed})

    assert response.status_code == 409
    assert response.json()["code"] == "variety.name_archived"
    assert "Gold" not in response.json()["detail"]


def test_an_archived_name_is_refused_on_rename(client: TestClient) -> None:
    client.post(f"/varieties/{_register(client)}/archive")
    other = _register(client, "Silver")

    response = client.patch(f"/varieties/{other}", json={"name": "24k  gold"})

    assert response.status_code == 409
    assert response.json()["code"] == "variety.name_archived"


def test_a_live_name_is_still_refused_as_taken(client: TestClient) -> None:
    _register(client)

    response = client.post("/varieties", json={"name": "24k gold"})

    assert response.status_code == 409
    assert response.json()["code"] == "variety.name_taken"


def test_a_restored_variety_can_be_renamed(client: TestClient) -> None:
    variety_id = _register(client)
    client.post(f"/varieties/{variety_id}/archive")
    client.post(f"/varieties/{variety_id}/restore")

    response = client.patch(f"/varieties/{variety_id}", json={"name": "Silver"})

    assert response.status_code == 200
    assert response.json()["name"] == "Silver"


def test_the_archived_list_has_only_archived_varieties_by_name(client: TestClient) -> None:
    ids = {name: _register(client, name) for name in ("Sir Jack", "24K Gold", "Zeta", "Alpha")}
    client.post(f"/varieties/{ids['Sir Jack']}/archive")
    client.post(f"/varieties/{ids['24K Gold']}/archive")

    assert _archived_names(client) == ["24K Gold", "Sir Jack"]
    assert _listed_names(client) == ["Alpha", "Zeta"]


def test_an_archived_variety_is_still_read_by_its_id(client: TestClient) -> None:
    variety_id = _register(client)
    client.post(f"/varieties/{variety_id}/archive")

    response = client.get(f"/varieties/{variety_id}")

    assert response.status_code == 200
    assert response.json()["archived"] is True
