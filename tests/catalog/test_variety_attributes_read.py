"""Behaviour seam for `GET /catalog/varieties/{variety_id}` (docs/adr/0032, amendment):
the stored catalog values of one variety, archived or not, as plain facts. Through
`TestClient`; the refusal never carries what was typed (CODING_STANDARDS section 9).
"""

import logging

import pytest
from fastapi.testclient import TestClient

AROMA = "citrico de prueba"
EMOJI = "🌿"


def _variety(client: TestClient, name: str = "Gelato") -> int:
    variety: int = client.post("/varieties", json={"name": name}).json()["id"]
    return variety


def _store(client: TestClient, variety_id: int, *, shown: bool = False) -> None:
    response = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": shown, "emoji": EMOJI, "indica_share": 70, "aroma": AROMA},
    )
    assert response.status_code == 200, response.text


def test_a_live_variety_answers_its_stored_values(client: TestClient) -> None:
    variety_id = _variety(client)
    _store(client, variety_id)

    response = client.get(f"/catalog/varieties/{variety_id}")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "shown": False,
        "emoji": EMOJI,
        "indica_share": 70,
        "aroma": AROMA,
    }


def test_an_archived_variety_answers_the_same_stored_values(client: TestClient) -> None:
    variety_id = _variety(client)
    _store(client, variety_id, shown=False)
    live = client.get(f"/catalog/varieties/{variety_id}").json()
    assert client.post(f"/varieties/{variety_id}/archive").status_code == 200

    response = client.get(f"/catalog/varieties/{variety_id}")

    assert response.status_code == 200, response.text
    assert response.json() == live


def test_a_variety_with_no_stored_row_answers_the_default(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.get(f"/catalog/varieties/{variety_id}")

    assert response.status_code == 200, response.text
    assert response.json() == {"shown": True, "emoji": None, "indica_share": None, "aroma": None}


def test_reading_writes_nothing_and_unlocks_nothing(client: TestClient) -> None:
    variety_id = _variety(client)
    _store(client, variety_id)
    client.post(f"/varieties/{variety_id}/archive")

    client.get(f"/catalog/varieties/{variety_id}")

    archived = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert archived.status_code == 404
    assert client.get(f"/varieties/{variety_id}").json()["archived"] is True


def test_an_unknown_variety_is_a_404_with_the_code_and_no_typed_text(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    variety_id = _variety(client)
    _store(client, variety_id)
    caplog.set_level(logging.DEBUG)

    response = client.get("/catalog/varieties/999999")
    client.get(f"/catalog/varieties/{variety_id}")

    assert response.status_code == 404
    assert response.json()["code"] == "catalog.variety_not_found"
    assert AROMA not in response.text and EMOJI not in response.text
    assert AROMA not in caplog.text and EMOJI not in caplog.text


@pytest.mark.parametrize("stored", [False, True])
def test_the_catalog_list_and_the_read_route_agree(client: TestClient, stored: bool) -> None:
    variety_id = _variety(client)
    if stored:
        _store(client, variety_id)

    row = next(v for v in client.get("/catalog").json()["varieties"] if v["id"] == variety_id)
    read = client.get(f"/catalog/varieties/{variety_id}").json()

    assert read == {key: row[key] for key in ("shown", "emoji", "indica_share", "aroma")}
