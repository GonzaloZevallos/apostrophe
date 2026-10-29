"""Behaviour seams for the catalog API (CONTEXT.md: Catalog), through `TestClient` with
the movable clock: which varieties qualify today (PRD success criterion 2), that a
refusal never echoes what was typed (CODING_STANDARDS §9), and that a new business
opens with its default header and footer already there.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand

TODAY = "2026-10-02"


def _variety(client: TestClient, name: str) -> int:
    variety: int = client.post("/api/products", json={"name": name}).json()["id"]
    return variety


def _price(client: TestClient, variety_id: int) -> None:
    response = client.post(
        f"/api/products/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    assert response.status_code == 201, response.text


def _stock(client: TestClient, variety_id: int, quantity: str) -> None:
    response = client.post(
        "/stock/entries",
        json={"product_id": variety_id, "origin": "opening_stock", "quantity": quantity},
    )
    assert response.status_code == 201, response.text


def _draw(client: TestClient, variety_id: int, quantity: str) -> None:
    response = client.post(
        "/stock/entries",
        json={"product_id": variety_id, "origin": "adjustment", "quantity": f"-{quantity}"},
    )
    assert response.status_code == 201, response.text


def _state_of(client: TestClient, variety_id: int) -> str:
    catalog = client.get("/catalog").json()
    matches = [v for v in catalog["varieties"] if v["id"] == variety_id]
    assert len(matches) == 1
    state: str = matches[0]["state"]
    return state


@pytest.mark.parametrize(
    ("shown", "priced", "stocked", "expected"),
    [
        (False, True, True, "hidden"),
        (True, False, True, "no_price"),
        (True, True, False, "no_entries"),
        (True, True, True, "in"),
    ],
    ids=["hidden", "no_price", "no_entries", "in"],
)
def test_inclusion_matrix(
    client: TestClient, shown: bool, priced: bool, stocked: bool, expected: str
) -> None:
    variety_id = _variety(client, f"Matrix {expected}")
    if priced:
        _price(client, variety_id)
    if stocked:
        _stock(client, variety_id, "50")
    put = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": shown, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert put.status_code == 200, put.text

    assert _state_of(client, variety_id) == expected


def test_low_stock_still_qualifies_as_in(client: TestClient) -> None:
    """The PRD's inclusion metric: 'a variety with low stock still appears'. Stock's own
    `low` status (below its threshold, but still above zero) must still read as `in`,
    never compared to grams by the catalog itself."""
    variety_id = _variety(client, "Matrix low")
    _price(client, variety_id)
    _stock(client, variety_id, "5")
    threshold = client.put(f"/stock/products/{variety_id}/threshold", json={"quantity": "50"})
    assert threshold.status_code == 200, threshold.text
    assert threshold.json()["status"] == "low", threshold.text

    assert _state_of(client, variety_id) == "in"
    catalog = client.get("/catalog").json()
    assert catalog["text"] is not None and "Matrix low" in catalog["text"]


def test_sold_out_state_when_stock_was_drawn_down_to_zero(client: TestClient) -> None:
    variety_id = _variety(client, "Matrix sold out")
    _price(client, variety_id)
    _stock(client, variety_id, "10")
    _draw(client, variety_id, "10")

    assert _state_of(client, variety_id) == "sold_out"


def test_only_in_varieties_qualify_for_the_text(client: TestClient) -> None:
    in_variety = _variety(client, "Qualifies")
    _price(client, in_variety)
    _stock(client, in_variety, "50")
    hidden_variety = _variety(client, "Hidden one")
    _price(client, hidden_variety)
    _stock(client, hidden_variety, "50")
    client.put(
        f"/catalog/varieties/{hidden_variety}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )

    catalog = client.get("/catalog").json()

    assert catalog["text"] is not None
    assert "Qualifies" in catalog["text"]
    assert "Hidden one" not in catalog["text"]


def test_nothing_qualifies_answers_a_null_text(client: TestClient) -> None:
    catalog = client.get("/catalog").json()

    assert catalog["text"] is None


@pytest.mark.parametrize(
    ("path", "body", "needle"),
    [
        (
            "/catalog/header-footer",
            {"header": "x" * 501, "footer": ""},
            "x" * 501,
        ),
        (
            "/catalog/header-footer",
            {"header": "", "footer": "y" * 501},
            "y" * 501,
        ),
    ],
    ids=["header_too_long", "footer_too_long"],
)
def test_a_too_long_header_or_footer_is_refused_without_echoing_it(
    client: TestClient, path: str, body: dict[str, Any], needle: str
) -> None:
    response = client.put(path, json=body)

    assert response.status_code == 422, response.text
    assert needle not in response.text


def test_an_invalid_emoji_is_refused_without_echoing_the_aroma(client: TestClient) -> None:
    variety_id = _variety(client, "Echo check")

    response = client.put(
        f"/catalog/varieties/{variety_id}",
        json={
            "shown": True,
            "emoji": "not an emoji",
            "indica_share": None,
            "aroma": "a very specific aroma marker",
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "catalog.emoji_invalid"
    assert "a very specific aroma marker" not in response.text
    assert "not an emoji" not in response.text


def test_an_out_of_range_indica_share_is_refused(client: TestClient) -> None:
    variety_id = _variety(client, "Share check")

    response = client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": True, "emoji": None, "indica_share": 101, "aroma": None},
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "catalog.indica_share_invalid"


def test_setting_attributes_of_a_missing_variety_answers_404(client: TestClient) -> None:
    response = client.put(
        "/catalog/varieties/999999",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "catalog.variety_not_found"


def test_a_new_business_opens_with_both_openings_in_one_commit(client: TestClient) -> None:
    """`CompositeOpening` (ADR-0006) must run `ExpenseCategoriesOpening` and
    `CatalogHeaderFooterOpening` together, inside `accept_invitation`'s single commit:
    a new business has its four default expense categories and its default catalog
    header and footer already there, with no catalog attribute rows."""
    catalog = client.get("/catalog").json()
    categories = client.get("/expense-categories").json()

    assert catalog["header"] == "\U0001f33f **CATALOG** \U0001f33f"
    assert catalog["footer"] == "\U0001f4e9 Questions and orders by private message."
    assert catalog["varieties"] == []
    assert len(categories) == 4


def test_a_business_only_ever_sees_its_own_catalog(
    client: TestClient, other_client: TestClient
) -> None:
    variety_id = _variety(client, "Only mine")
    _price(client, variety_id)
    _stock(client, variety_id, "50")
    client.put(
        f"/catalog/varieties/{variety_id}",
        json={"shown": True, "emoji": None, "indica_share": 60, "aroma": "cítrico"},
    )
    client.put("/catalog/header-footer", json={"header": "Mi negocio", "footer": "Gracias"})

    mine = client.get("/catalog").json()
    other = other_client.get("/catalog").json()

    assert mine["header"] == "Mi negocio"
    assert mine["text"] is not None and "Only mine" in mine["text"]
    assert other["header"] != "Mi negocio"
    assert other["text"] is None
    assert all(v["name"] != "Only mine" for v in other["varieties"])


def test_an_archived_variety_is_absent_from_the_catalog_text_and_the_list(
    client: TestClient, engine: Engine
) -> None:
    kept = _variety(client, "Kept")
    gone = _variety(client, "Gone")
    for variety_id in (kept, gone):
        _price(client, variety_id)
        _stock(client, variety_id, "20")
    assert "Gone" in client.get("/catalog").json()["text"]
    archive_by_hand(engine, gone)

    catalog = client.get("/catalog").json()

    assert "Gone" not in catalog["text"]
    assert "Kept" in catalog["text"]
    assert [v["id"] for v in catalog["varieties"]] == [kept]


def test_the_attributes_of_an_archived_variety_cannot_be_edited(
    client: TestClient, engine: Engine
) -> None:
    gone = _variety(client, "Gone")
    archive_by_hand(engine, gone)

    response = client.put(
        f"/catalog/varieties/{gone}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"


def test_the_attributes_of_a_missing_variety_keep_the_catalog_refusal(
    client: TestClient,
) -> None:
    response = client.put(
        "/catalog/varieties/9999",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": None},
    )

    assert (response.status_code, response.json()["code"]) == (404, "catalog.variety_not_found")


def _set_attributes(client: TestClient, variety_id: int, body: dict[str, Any]) -> None:
    response = client.put(f"/catalog/varieties/{variety_id}", json=body)
    assert response.status_code == 200, response.text


def test_archived_lists_only_archived_varieties_with_their_stored_attributes_by_name(
    client: TestClient, engine: Engine
) -> None:
    live = _variety(client, "Live")
    zeta = _variety(client, "Zeta")
    alfa = _variety(client, "Alfa")
    plain = _variety(client, "Mate")
    _set_attributes(
        client, zeta, {"shown": False, "emoji": "🌿", "indica_share": 70, "aroma": "Cítrico"}
    )
    for variety_id in (zeta, alfa, plain):
        archive_by_hand(engine, variety_id)

    response = client.get("/catalog/archived")

    assert response.status_code == 200
    assert response.json() == [
        {
            "variety_id": alfa,
            "name": "Alfa",
            "shown": True,
            "emoji": None,
            "indica_share": None,
            "aroma": None,
        },
        {
            "variety_id": plain,
            "name": "Mate",
            "shown": True,
            "emoji": None,
            "indica_share": None,
            "aroma": None,
        },
        {
            "variety_id": zeta,
            "name": "Zeta",
            "shown": False,
            "emoji": "🌿",
            "indica_share": 70,
            "aroma": "Cítrico",
        },
    ]
    assert live not in [row["variety_id"] for row in response.json()]


def test_archived_is_an_empty_list_when_nothing_is_archived(client: TestClient) -> None:
    _variety(client, "Live")

    response = client.get("/catalog/archived")

    assert response.status_code == 200
    assert response.json() == []
