"""A product's unit through `POST /api/products`, `GET /api/products` and
`GET /api/products/{id}`, and the one a new business opens with."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine


def _business_id(engine: Engine, name: str) -> int:
    with engine.connect() as connection:
        return int(
            connection.execute(
                text("SELECT id FROM business WHERE name = :n"), {"n": name}
            ).scalar_one()
        )


def _add_unit(engine: Engine, business_id: int, name: str, decimals: int) -> int:
    with engine.begin() as connection:
        result = connection.execute(
            text(
                "INSERT INTO unit (business_id, name, name_key, label, decimals) "
                "VALUES (:b, :n, :n, 'x', :d)"
            ),
            {"b": business_id, "n": name, "d": decimals},
        )
        return int(result.lastrowid)


def test_a_new_business_opens_with_one_unit_a_product_takes_by_default(client: TestClient) -> None:
    created = client.post("/api/products", json={"name": "Sir Jack"})

    assert created.status_code == 201
    unit = created.json()["unit"]
    assert (unit["name"], unit["label"], unit["decimals"]) == ("unit", "unit", 0)
    assert client.get(f"/api/products/{created.json()['id']}").json()["unit"] == unit
    assert [row["unit"] for row in client.get("/api/products").json()] == [unit]


def test_a_named_unit_of_the_business_is_the_products_unit(
    client: TestClient, engine: Engine
) -> None:
    unit_id = _add_unit(engine, _business_id(engine, "Primer Negocio"), "pieces", 0)

    created = client.post("/api/products", json={"name": "Gold", "unit_id": unit_id})

    assert created.status_code == 201
    assert created.json()["unit"]["id"] == unit_id
    assert created.json()["unit"]["name"] == "pieces"


def test_an_omitted_unit_with_two_units_is_refused_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    _add_unit(engine, _business_id(engine, "Primer Negocio"), "pieces", 0)

    refused = client.post("/api/products", json={"name": "Gold"})

    assert refused.status_code == 422
    assert refused.json()["code"] == "product.unit_required"
    assert client.get("/api/products").json() == []


def test_another_businesss_unit_answers_unit_not_found_and_writes_nothing(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    foreign = _add_unit(engine, _business_id(engine, "Otro Negocio"), "pieces", 0)

    refused = client.post("/api/products", json={"name": "Gold", "unit_id": foreign})

    assert refused.status_code == 404
    assert refused.json()["code"] == "unit.not_found"
    assert client.get("/api/products").json() == []
    assert other_client.get("/api/products").json() == []
