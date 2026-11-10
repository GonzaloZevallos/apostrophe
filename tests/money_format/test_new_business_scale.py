"""A business opened through the invitation path stores hundredths (docs/adr/0058), and every
request field that takes an amount refuses one with more places than the business allows.

Seams: an invitation-opened business through the production `create_app` (no scale passed),
and the full HTTP route suite through `TestClient` at both scales.
"""

from __future__ import annotations

import copy
from decimal import Decimal
from typing import Annotated, Any, get_args, get_origin, get_type_hints

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.main import create_app
from app.money_schema import MoneyAmount
from tests.conftest import (
    PASSWORD,
    SETTINGS,
    TEST_HASHER,
    MovableClock,
    invite,
    signed_in,
)
from tests.fakes.telegram import FakeTelegram
from tests.test_business_isolation import BODIES, SEEDERS, _concrete


def test_a_business_opened_by_invitation_stores_its_amounts_in_hundredths(
    engine: Engine, clock: MovableClock
) -> None:
    production = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(production) as http:
        accepted = http.post(
            f"/invitations/{invite(engine, clock())}/accept",
            json={"business_name": "Nuevo", "email": "nuevo@example.com", "password": PASSWORD},
        )
        assert accepted.status_code == 201, accepted.text
        signed_in(http, accepted.json()["token"])
        variety = http.post("/api/products", json={"name": "Planta"}).json()
        priced = http.post(
            f"/api/products/{variety['id']}/prices",
            json={"effective_from": "2026-01-01", "list_price": 11_000},
        )
        assert priced.status_code == 201, priced.text
        sold = http.post(
            "/sales",
            json={
                "payment": {"kind": "method", "payment_method_id": 1},
                "lines": [{"product_id": variety["id"], "quantity": "1"}],
            },
        )
        assert sold.status_code == 201, sold.text
        read = http.get(f"/sales/{sold.json()['id']}")

    with engine.connect() as connection:
        scale = connection.execute(text("SELECT scale FROM money_format")).scalar_one()
        stored = connection.execute(text("SELECT line_total FROM sale_line")).scalar_one()
    assert scale == 2
    assert stored == 1_100_000
    total = read.json()["total"]
    assert isinstance(total, int) and not isinstance(total, bool)
    assert total == 11_000


def _is_money(hint: Any) -> bool:
    """A field declared `MoneyAmount`, alone or optional (a quantity is a Decimal too, and
    is not money)."""
    if get_origin(hint) is Annotated:
        return all(marker in hint.__metadata__ for marker in get_args(MoneyAmount)[1:])
    return any(_is_money(part) for part in get_args(hint))


def _models_in(annotation: Any) -> list[type[BaseModel]]:
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return [annotation]
    return [model for part in get_args(annotation) for model in _models_in(part)]


def _money_paths(model: type[BaseModel]) -> list[tuple[str, ...]]:
    """Where, inside a body of `model`, a request amount sits: the keys to follow, a list
    followed item by item."""
    paths: list[tuple[str, ...]] = []
    hints = get_type_hints(model, include_extras=True)
    for name, field in model.model_fields.items():
        if _is_money(hints[name]):
            paths.append((name,))
        for nested in _models_in(field.annotation):
            paths.extend((name, *rest) for rest in _money_paths(nested))
    return paths


def _set_everywhere(node: Any, path: tuple[str, ...], value: Any) -> int:
    """Sets `value` at `path` in every container of `node` that reaches it; answers how
    many it set."""
    if isinstance(node, list):
        return sum(_set_everywhere(item, path, value) for item in node)
    if not isinstance(node, dict):
        return 0
    if len(path) == 1:
        node[path[0]] = value
        return 1
    return _set_everywhere(node.get(path[0]), path[1:], value)


def _all_models() -> dict[str, type[BaseModel]]:
    found: dict[str, type[BaseModel]] = {}
    pending = list(BaseModel.__subclasses__())
    while pending:
        model = pending.pop()
        pending.extend(model.__subclasses__())
        found.setdefault(model.__name__, model)
    return found


def _request_amount_fields(app: FastAPI) -> list[tuple[str, str, tuple[str, ...]]]:
    """Every (method, path, where) a request body of the API holds a `MoneyAmount`, read
    from the OpenAPI document (`app.routes` lists an included router as one entry)."""
    models = _all_models()
    found: list[tuple[str, str, tuple[str, ...]]] = []
    for path, item in app.openapi()["paths"].items():
        for method, operation in item.items():
            content = operation.get("requestBody", {}).get("content", {})
            schema = content.get("application/json", {}).get("schema", {})
            name = schema.get("$ref", "").rsplit("/", 1)[-1]
            if name in models:
                found.extend((method.upper(), path, where) for where in _money_paths(models[name]))
    return sorted(found)


def test_every_request_amount_field_refuses_ten_and_a_half_with_the_fixed_code(
    app: FastAPI, client: TestClient
) -> None:
    names: dict[str, int] = {}
    for seed in SEEDERS:
        names |= seed(client)
    fields = _request_amount_fields(app)
    assert fields, "no request amount field found"

    refused = []
    for method, path, field_path in fields:
        body = copy.deepcopy(BODIES[(method, path)])
        if _set_everywhere(body, field_path, 10.5) == 0:
            continue
        response = client.request(method, _concrete(path, names), json=body)
        assert response.status_code == 422, (method, path, field_path, response.text)
        assert response.json()["code"] == "money.too_many_decimals", (method, path, response.text)
        refused.append((method, path))

    # Every route that takes an amount was really fed one.
    assert set(refused) == {(m, p) for m, p, _ in fields}


class _Line(BaseModel):
    special_price: MoneyAmount | None = None
    quantity: Decimal = Decimal(1)


class _Body(BaseModel):
    shipping: MoneyAmount = Decimal(0)
    lines: list[_Line]
    note: str = ""


def test_the_sweep_finds_the_amount_fields_it_is_meant_to_feed() -> None:
    # A quantity is a Decimal and is not money: only the `MoneyAmount` fields are found.
    assert sorted(_money_paths(_Body)) == [("lines", "special_price"), ("shipping",)]
    body: dict[str, Any] = {"lines": [{}, {}]}
    assert _set_everywhere(body, ("lines", "special_price"), 10.5) == 2
    assert _set_everywhere(body, ("shipping",), 10.5) == 1


@pytest.mark.parametrize("written", [10, 10.0])
def test_a_whole_amount_is_not_refused_however_it_is_written(
    client: TestClient, written: float
) -> None:
    names: dict[str, int] = {}
    for seed in SEEDERS:
        names |= seed(client)
    body = copy.deepcopy(BODIES[("POST", "/expenses")])
    body["amount"] = written

    response = client.post("/expenses", json=body)

    assert response.status_code == 201, response.text
