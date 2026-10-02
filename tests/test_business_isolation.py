"""Nothing one business records is reachable from another (docs/adr/0004).

Business A records one of everything through the API. Business B then calls every
gated route: a route that names a record must answer 404 for A's records, and a route
that lists must show none of them. Afterwards A still reads every record unchanged.

A capability adds two things here in the diff that adds its routes:

- a seeder in `SEEDERS`: records its things in the business of the client it gets, with
  `MARKER` in every name, and returns the path parameters that name them;
- in `BODIES`, a valid body for each of its gated routes that takes one.

A route with a path parameter no seeder names, or with a body and no example, fails.

Every list route (`LISTS`) is also read right after seeding, before B's call: a route
with no `GET` by id (expense categories have none) could otherwise still be reached and
rewritten through a by-id route that answers 404 only after it wrote. Comparing A's
list bodies before and after B's call catches that even when no single-record read
would.
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


def seed_expenses(client: TestClient) -> dict[str, int]:
    category = client.post("/expense-categories", json={"name": f"{MARKER} category"})
    assert category.status_code == 201, category.text
    return {"category_id": category.json()["id"]}


SEEDERS: list[Callable[[TestClient], dict[str, int]]] = [seed_varieties, seed_expenses]

BODIES: dict[tuple[str, str], dict[str, Any]] = {
    ("POST", "/varieties"): {"name": "Another variety"},
    ("PATCH", "/varieties/{variety_id}"): {"name": "Renamed"},
    ("POST", "/varieties/{variety_id}/prices"): {
        "effective_from": "2026-02-01",
        "list_price": 12_000,
    },
    ("POST", "/expense-categories"): {"name": "Another category"},
    ("PATCH", "/expense-categories/{category_id}"): {"name": "Renamed category"},
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
    before = {list_path: business_a.get(list_path).json() for list_path in LISTS}

    response = business_b.request(
        method, _concrete(path, seeded), json=BODIES.get((method, path))
    )

    assert response.status_code == 404, response.text
    for read in [p for m, p in BY_ID if m == "GET"]:
        assert business_a.get(_concrete(read, seeded)).status_code == 200
    for list_path in LISTS:
        assert business_a.get(list_path).json() == before[list_path]


@pytest.mark.parametrize("path", LISTS)
def test_another_business_lists_none_of_its_records(
    business_b: TestClient, seeded: dict[str, int], path: str
) -> None:
    response = business_b.get(path)

    assert response.status_code == 200
    assert MARKER not in response.text
