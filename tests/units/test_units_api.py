"""A business's units through `/api/units`: list, create, rename, raise decimals, delete.
Every refusal answers its own code and repeats nothing a seller typed (docs/adr/0005)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand


def _add(client: TestClient, name: str, label: str = "x", decimals: int = 1) -> dict[str, Any]:
    response = client.post("/api/units", json={"name": name, "label": label, "decimals": decimals})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _units(client: TestClient) -> list[dict[str, Any]]:
    listed: list[dict[str, Any]] = client.get("/api/units").json()
    return listed


def _unit_of(client: TestClient, name: str) -> dict[str, Any]:
    return next(unit for unit in _units(client) if unit["name"] == name)


def _product(client: TestClient, name: str, unit_id: int) -> int:
    response = client.post("/api/products", json={"name": name, "unit_id": unit_id})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def test_a_new_business_lists_its_one_default_unit_with_no_products(client: TestClient) -> None:
    listed = _units(client)

    assert [(u["name"], u["label"], u["decimals"], u["product_count"]) for u in listed] == [
        ("unit", "unit", 0, 0)
    ]


def test_units_are_listed_in_creation_order_with_their_product_counts(client: TestClient) -> None:
    kilos = _add(client, "Kilos", "kg", 2)
    _add(client, "Apples", "ap", 0)
    _product(client, "Gold", kilos["id"])
    _product(client, "Silver", kilos["id"])

    listed = _units(client)

    assert [u["name"] for u in listed] == ["unit", "Kilos", "Apples"]
    assert [u["product_count"] for u in listed] == [0, 2, 0]
    assert [u["id"] for u in listed] == sorted(u["id"] for u in listed)


def test_a_unit_is_created_trimmed_and_with_inner_spaces_collapsed(client: TestClient) -> None:
    created = _add(client, "  Cajas   grandes ", " cj ", 0)

    assert (created["name"], created["label"], created["decimals"]) == ("Cajas grandes", "cj", 0)
    assert created["product_count"] == 0


def test_a_duplicate_name_is_refused_whatever_the_case_or_spacing(client: TestClient) -> None:
    _add(client, "Kilos")

    refused = client.post("/api/units", json={"name": "  kILOS ", "label": "x", "decimals": 1})

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.name_taken"
    assert "kILOS" not in refused.text
    assert [u["name"] for u in _units(client)] == ["unit", "Kilos"]


def test_two_units_may_share_a_label(client: TestClient) -> None:
    _add(client, "Kilos", "k")

    _add(client, "Kilograms", "k")


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"name": "", "label": "x", "decimals": 0}, "unit.name_invalid"),
        ({"name": "   ", "label": "x", "decimals": 0}, "unit.name_invalid"),
        ({"name": "n" * 61, "label": "x", "decimals": 0}, "unit.name_invalid"),
        ({"name": "Kilos", "label": " ", "decimals": 0}, "unit.label_invalid"),
        ({"name": "Kilos", "label": "l" * 21, "decimals": 0}, "unit.label_invalid"),
        ({"name": "Kilos", "label": "x", "decimals": 3}, "unit.decimals_invalid"),
        ({"name": "Kilos", "label": "x", "decimals": -1}, "unit.decimals_invalid"),
    ],
)
def test_a_name_label_or_decimals_out_of_rule_is_refused_and_writes_nothing(
    client: TestClient, body: dict[str, Any], code: str
) -> None:
    refused = client.post("/api/units", json=body)

    assert refused.status_code == 422
    assert refused.json()["code"] == code
    assert [u["name"] for u in _units(client)] == ["unit"]


def test_a_unit_is_renamed_and_relabelled_at_any_time_even_with_history(
    client: TestClient,
) -> None:
    kilos = _add(client, "Kilos", "kg", 2)
    _product(client, "Gold", kilos["id"])
    client.post(
        "/stock/entries", json={"product_id": 1, "origin": "opening_stock", "quantity": "5"}
    )

    renamed = client.patch(f"/api/units/{kilos['id']}", json={"name": "Kilograms", "label": "KG"})

    assert renamed.status_code == 200
    assert (renamed.json()["name"], renamed.json()["label"]) == ("Kilograms", "KG")
    assert renamed.json()["decimals"] == 2
    assert renamed.json()["product_count"] == 1
    assert _unit_of(client, "Kilograms")["id"] == kilos["id"]


def test_a_unit_may_be_renamed_to_its_own_name_in_another_case(client: TestClient) -> None:
    kilos = _add(client, "Kilos")

    renamed = client.patch(f"/api/units/{kilos['id']}", json={"name": "KILOS"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "KILOS"


def test_renaming_to_another_units_name_is_refused(client: TestClient) -> None:
    _add(client, "Kilos")
    pieces = _add(client, "Pieces")

    refused = client.patch(f"/api/units/{pieces['id']}", json={"name": " kilos"})

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.name_taken"
    assert _unit_of(client, "Pieces")["id"] == pieces["id"]


def test_decimals_may_always_go_up(client: TestClient) -> None:
    pieces = _add(client, "Pieces", "pc", 0)

    raised = client.patch(f"/api/units/{pieces['id']}", json={"decimals": 2})

    assert raised.status_code == 200
    assert raised.json()["decimals"] == 2
    assert _unit_of(client, "Pieces")["decimals"] == 2


def test_the_same_decimals_are_accepted(client: TestClient) -> None:
    pieces = _add(client, "Pieces", "pc", 1)

    kept = client.patch(f"/api/units/{pieces['id']}", json={"decimals": 1})

    assert kept.status_code == 200


def test_lowering_decimals_is_refused_with_its_own_code_and_changes_nothing(
    client: TestClient,
) -> None:
    kilos = _add(client, "Kilos", "kg", 2)

    refused = client.patch(f"/api/units/{kilos['id']}", json={"name": "Renamed", "decimals": 1})

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.decimals_in_use"
    stored = _unit_of(client, "Kilos")
    assert stored["decimals"] == 2


def test_a_patch_with_decimals_out_of_range_is_refused(client: TestClient) -> None:
    kilos = _add(client, "Kilos", "kg", 1)

    refused = client.patch(f"/api/units/{kilos['id']}", json={"decimals": 3})

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.decimals_invalid"


def test_an_unused_unit_is_deleted(client: TestClient) -> None:
    kilos = _add(client, "Kilos")

    deleted = client.delete(f"/api/units/{kilos['id']}")

    assert deleted.status_code == 204
    assert [u["name"] for u in _units(client)] == ["unit"]


def test_the_only_unit_cannot_be_deleted(client: TestClient) -> None:
    only = _units(client)[0]

    refused = client.delete(f"/api/units/{only['id']}")

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.last_unit"
    assert len(_units(client)) == 1


def test_a_unit_used_by_a_product_without_history_cannot_be_deleted(client: TestClient) -> None:
    kilos = _add(client, "Kilos")
    _product(client, "Gold", kilos["id"])

    refused = client.delete(f"/api/units/{kilos['id']}")

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.in_use"
    assert "Kilos" not in refused.text
    assert _unit_of(client, "Kilos")["product_count"] == 1


def test_a_unit_used_by_a_product_with_history_cannot_be_deleted(client: TestClient) -> None:
    kilos = _add(client, "Kilos", "kg", 2)
    product_id = _product(client, "Gold", kilos["id"])
    entry = client.post(
        "/stock/entries",
        json={"product_id": product_id, "origin": "opening_stock", "quantity": "5"},
    )
    assert entry.status_code == 201, entry.text

    refused = client.delete(f"/api/units/{kilos['id']}")

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.in_use"


def test_a_unit_used_by_an_archived_product_cannot_be_deleted(
    client: TestClient, engine: Engine
) -> None:
    kilos = _add(client, "Kilos")
    product_id = _product(client, "Gold", kilos["id"])
    archive_by_hand(engine, product_id)

    refused = client.delete(f"/api/units/{kilos['id']}")

    assert refused.status_code == 422
    assert refused.json()["code"] == "unit.in_use"
    assert _unit_of(client, "Kilos")["product_count"] == 1


def test_deleting_a_product_for_good_frees_its_unit(client: TestClient) -> None:
    kilos = _add(client, "Kilos")
    product_id = _product(client, "Gold", kilos["id"])
    assert client.delete(f"/api/products/{product_id}").status_code == 204

    deleted = client.delete(f"/api/units/{kilos['id']}")

    assert deleted.status_code == 204


def test_another_business_s_unit_answers_not_found_on_every_route_by_id(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _units(other_client)[0]["id"]
    before = _units(other_client)

    patched = client.patch(f"/api/units/{foreign}", json={"name": "Taken over"})
    deleted = client.delete(f"/api/units/{foreign}")

    for refused in (patched, deleted):
        assert refused.status_code == 404
        assert refused.json()["code"] == "unit.not_found"
    assert _units(other_client) == before


def test_a_unit_that_does_not_exist_answers_not_found(client: TestClient) -> None:
    assert client.delete("/api/units/9999").status_code == 404
    assert client.patch("/api/units/9999", json={"name": "x"}).status_code == 404


def test_the_list_holds_only_the_callers_own_units(
    client: TestClient, other_client: TestClient
) -> None:
    _add(other_client, "Theirs")

    assert [u["name"] for u in _units(client)] == ["unit"]
    assert [u["name"] for u in _units(other_client)] == ["unit", "Theirs"]
