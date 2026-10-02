"""Nothing one business records is reachable from another (docs/adr/0004).

Business A records one of everything through the API. Business B then calls every
gated route: a route that names a record must answer 404 for A's records, and a route
that lists must show none of them. Afterwards A still reads every record unchanged.

A capability adds two things here in the diff that adds its routes:

- a seeder in `SEEDERS`: records its things in the business of the client it gets, with
  `MARKER` in every name, and returns the path parameters that name them;
- in `BODIES`, a valid body for each of its gated routes that takes one.

A route with a path parameter no seeder names, or with a body and no example, fails.
"""

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.main import create_app
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in

MARKER = "zz-isolation-marker"


def seed_varieties(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} variety"}).json()
    entry = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    ).json()
    return {"variety_id": variety["id"], "entry_id": entry["id"]}


def seed_customers(client: TestClient) -> dict[str, int]:
    customer = client.post(
        "/customers", json={"name": f"{MARKER} customer", "phone": "11 2345-6789"}
    ).json()
    return {"customer_id": customer["id"]}


def seed_sales(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} sales variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = client.post(
        "/customers", json={"name": f"{MARKER} sales customer", "phone": "11 5555-5555"}
    ).json()
    without_customer = client.post(
        "/sales",
        json={
            "payment": "cash",
            "note": MARKER,
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    ).json()
    client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer["id"],
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    )
    return {"sale_id": without_customer["id"]}


SEEDERS: list[Callable[[TestClient], dict[str, int]]] = [
    seed_varieties,
    seed_customers,
    seed_sales,
]

BODIES: dict[tuple[str, str], dict[str, Any]] = {
    ("POST", "/varieties"): {"name": "Another variety"},
    ("PATCH", "/varieties/{variety_id}"): {"name": "Renamed"},
    ("POST", "/varieties/{variety_id}/prices"): {
        "effective_from": "2026-02-01",
        "list_price": 12_000,
    },
    ("POST", "/customers"): {"name": "Another customer", "phone": "11 9876-5432"},
    ("PATCH", "/customers/{customer_id}"): {"name": "Renamed"},
    ("POST", "/sales"): {
        "payment": "owing",
        "customer_id": 1,
        "lines": [{"variety_id": 1, "grams": "1"}],
    },
    ("PUT", "/sales/{sale_id}/customer"): {"customer_id": 1},
}

PUBLIC_PATHS = {"/health", "/auth/login", "/auth/logout"}


def _operations() -> list[tuple[str, str, bool]]:
    document = create_app(SETTINGS, hasher=TEST_HASHER).openapi()
    return sorted(
        (method.upper(), path, "requestBody" in operation)
        for path, item in document["paths"].items()
        for method, operation in item.items()
        if path not in PUBLIC_PATHS and not path.startswith("/invitations/{token}")
    )


OPERATIONS = _operations()
BY_ID = [(m, p) for m, p, _ in OPERATIONS if "{" in p]
LISTS = [p for m, p, _ in OPERATIONS if m == "GET" and "{" not in p]


@pytest.fixture
def business_a(app: FastAPI, engine: Engine, clock: MovableClock) -> Iterator[TestClient]:
    with TestClient(app) as client:
        token = open_business(client, engine, clock, f"{MARKER} business", f"{MARKER}@a.com")
        yield signed_in(client, token)


@pytest.fixture
def business_b(
    app: FastAPI, engine: Engine, clock: MovableClock, business_a: TestClient
) -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield signed_in(client, open_business(client, engine, clock, "B", "b@b.com"))


@pytest.fixture
def seeded(business_a: TestClient) -> dict[str, int]:
    names: dict[str, int] = {}
    for seed in SEEDERS:
        names |= seed(business_a)
    return names


def _concrete(path: str, names: dict[str, int]) -> str:
    for name, value in names.items():
        path = path.replace(f"{{{name}}}", str(value))
    assert "{" not in path, f"no seeder names the parameters of {path}"
    return path


def test_every_route_that_takes_a_body_has_an_example() -> None:
    missing = [(m, p) for m, p, has_body in OPERATIONS if has_body and (m, p) not in BODIES]

    assert missing == []


def test_there_are_routes_that_name_a_record() -> None:
    assert len(BY_ID) > 0 and len(LISTS) > 0


@pytest.mark.parametrize(("method", "path"), BY_ID, ids=[f"{m} {p}" for m, p in BY_ID])
def test_another_business_cannot_reach_a_record(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    method: str,
    path: str,
) -> None:
    response = business_b.request(
        method, _concrete(path, seeded), json=BODIES.get((method, path))
    )

    assert response.status_code == 404, response.text
    for read in [p for m, p in BY_ID if m == "GET"]:
        assert business_a.get(_concrete(read, seeded)).status_code == 200


@pytest.fixture
def seeded_b(business_a: TestClient) -> dict[str, int]:
    """Business A's own variety and customer, named without `MARKER`: the valid
    reference `REFERENCES`-style checks send last, so `MARKER` never has to appear in
    a body that `test_another_business_lists_none_of_its_records` would then see."""
    variety = business_a.post("/varieties", json={"name": "Referenced variety"}).json()
    business_a.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = business_a.post(
        "/customers", json={"name": "Referenced customer", "phone": "11 1111-2222"}
    ).json()
    return {"variety_id": variety["id"], "customer_id": customer["id"]}


def _sale_body(*, variety_id: int, customer_id: int) -> dict[str, Any]:
    return {
        "payment": "owing",
        "customer_id": customer_id,
        "lines": [{"variety_id": variety_id, "grams": "1"}],
    }


def test_a_body_reference_to_a_missing_or_foreign_variety_is_refused_the_same_way(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    foreign_variety = seeded_b["variety_id"]
    customer_id = business_b.post(
        "/customers", json={"name": "B customer", "phone": "11 3333-4444"}
    ).json()["id"]

    missing = business_b.post(
        "/sales", json=_sale_body(variety_id=999_999, customer_id=customer_id)
    )
    other_business = business_b.post(
        "/sales", json=_sale_body(variety_id=foreign_variety, customer_id=customer_id)
    )

    assert missing.status_code == 422, missing.text
    assert other_business.status_code == 422, other_business.text
    assert missing.json() == other_business.json()

    own_variety = business_b.post("/varieties", json={"name": "B variety"}).json()
    business_b.post(
        f"/varieties/{own_variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    valid = business_b.post(
        "/sales", json=_sale_body(variety_id=own_variety["id"], customer_id=customer_id)
    )
    assert valid.status_code == 201, valid.text


def test_a_body_reference_to_a_missing_or_foreign_customer_is_refused_the_same_way(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    variety = business_b.post("/varieties", json={"name": "B variety 2"}).json()
    business_b.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    foreign_customer = seeded_b["customer_id"]

    missing = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=999_999)
    )
    other_business = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=foreign_customer)
    )

    assert missing.status_code == 422, missing.text
    assert other_business.status_code == 422, other_business.text
    assert missing.json() == other_business.json()

    own_customer = business_b.post(
        "/customers", json={"name": "B customer 2", "phone": "11 7777-8888"}
    ).json()
    valid = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=own_customer["id"])
    )
    assert valid.status_code == 201, valid.text


def test_assigning_a_customer_from_another_business_is_refused_the_same_way_as_missing(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    variety = business_b.post("/varieties", json={"name": "B variety 3"}).json()
    business_b.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    sale_id = business_b.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety["id"], "grams": "1"}]},
    ).json()["id"]
    foreign_customer = seeded_b["customer_id"]

    missing = business_b.put(f"/sales/{sale_id}/customer", json={"customer_id": 999_999})
    other_business = business_b.put(
        f"/sales/{sale_id}/customer", json={"customer_id": foreign_customer}
    )

    assert missing.status_code == 422, missing.text
    assert other_business.status_code == 422, other_business.text
    assert missing.json() == other_business.json()

    own_customer = business_b.post(
        "/customers", json={"name": "B customer 3", "phone": "11 6666-5555"}
    ).json()
    valid = business_b.put(f"/sales/{sale_id}/customer", json={"customer_id": own_customer["id"]})
    assert valid.status_code == 200, valid.text


@pytest.mark.parametrize("path", LISTS)
def test_another_business_lists_none_of_its_records(
    business_b: TestClient, seeded: dict[str, int], path: str
) -> None:
    response = business_b.get(path)

    assert response.status_code == 200
    assert MARKER not in response.text
