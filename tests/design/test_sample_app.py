"""The sample app's data (agentic-system ADR-0040): seeded through the API alone, never
through the front it exists to compare, so a redesigned screen cannot break it. Every
state the design's screens show has to exist after seeding."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import TODAY

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "design" / "sample_app.py"


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sample_app", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Registered first: a dataclass resolves its annotations through `sys.modules`.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ClientApi:
    """The seed's `Api` over a signed-in TestClient."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def call(self, method: str, path: str, body: object | None = None) -> Any:
        response = self.client.request(method, path, json=body)
        assert response.is_success, f"{method} {path}: {response.status_code} {response.text}"
        return response.json() if response.content else None


def test_the_sample_business_has_every_state_the_design_shows(client: TestClient) -> None:
    sample = load_script().seed(ClientApi(client), TODAY)

    debtors = client.get("/payments/debtors").json()
    names = {d["customer"]["name"] for d in debtors["debtors"]}
    assert {"Nico Parra", "Tincho Aguirre"} <= names

    week = client.get("/panel").json()["periods"]["week"]
    assert week["sales_count"] >= 3
    assert week["grams_gifted"] > 0
    assert week["expenses"] > 0
    assert week["purchases"] > 0

    owing = client.get(f"/sales/{sample.owing_sale}").json()
    assert owing["still_owing"] is True
    assert owing["customer"]["name"] == "Nico Parra"
    assert client.get(f"/customers/{sample.debtor}").json()["name"] == "Nico Parra"

    stock = {row["variety_id"]: row["status"] for row in client.get("/stock").json()["varieties"]}
    assert stock[sample.sold_out] == "sold_out"
    assert stock[sample.low] == "low"
    assert stock[sample.no_entries] == "no_entries"

    expenses = client.get("/expenses").json()
    assert expenses["total"] > 0
    assert len(expenses["categories"]) >= 2
