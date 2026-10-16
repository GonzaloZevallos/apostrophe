"""The sample app's data (agentic-system ADR-0040): seeded through the API alone, never
through the front it exists to compare, so a redesigned screen cannot break it. Every
state the design's screens show has to exist after seeding."""

import importlib.util
import os
import sys
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType
from typing import Any

import uvicorn
from fastapi.testclient import TestClient

from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, TODAY, MovableClock
from tests.fakes.telegram import FakeTelegram

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

    # Stock withdrawals: both reasons this week and month, one with pending cost, on the
    # variety the comparisons open, which stays under its threshold.
    periods = client.get("/panel").json()["periods"]
    for name in ("week", "month"):
        assert periods[name]["promotion"] is not None
        assert periods[name]["own_use"] is not None
    assert periods["week"]["promotion"]["pending"] is False
    assert periods["week"]["own_use"]["pending"] is True
    assert client.get(f"/stock/withdrawals/{sample.withdrawal}").json()["reason"] == "promotion"
    movements = client.get(f"/stock/varieties/{sample.low}/movements").json()
    assert len(movements) > 3
    assert {m["reason"] for m in movements if m["kind"] == "withdrawal"} == {
        "promotion",
        "own_use",
    }
    analysis = client.get("/analysis").json()
    assert analysis["since_first_record"]["promotion"] is not None
    assert analysis["since_first_record"]["own_use"]["pending_grams"] > 0

    expenses = client.get("/expenses").json()
    assert expenses["total"] > 0
    assert len(expenses["categories"]) >= 2


def test_reset_token_opens_a_live_reset_link(tmp_path: Path) -> None:
    # The token the comparisons use is minted by the real operator command against the
    # sample's own database, then must open a link the app answers 204 for.
    sample_app = load_script()
    url = f"sqlite:///{tmp_path / 'sample.db'}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("APOSTROPHE_")},
        "APOSTROPHE_SECRET_KEY": "sample-secret",
        "APOSTROPHE_DATABASE_URL": url,
        "APOSTROPHE_PUBLIC_URL": "http://127.0.0.1:9",
    }
    invite = sample_app.new_business_token(env)
    app = create_app(
        Settings("sample-secret", url),
        engine=make_engine(url),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        clock=MovableClock(NOW),
    )
    with TestClient(app) as web:
        accepted = web.post(
            f"/invitations/{invite}/accept",
            json={"email": sample_app.EMAIL, "password": PASSWORD, "business_name": "La Huerta"},
        )
        assert accepted.status_code == 201

        token = sample_app.reset_token(env, sample_app.EMAIL)

        assert web.get(f"/reset-links/{token}").status_code == 204


@contextmanager
def running_sample(tmp_path: Path) -> Iterator[tuple[ModuleType, dict[str, str], str]]:
    """The sample app's own arrangement in miniature: a real server on a real port over a
    database file, and the env the operator CLI needs to mint invitations against it."""
    sample_app = load_script()
    url = f"sqlite:///{tmp_path / 'sample.db'}"
    port = sample_app.free_port()
    base = f"http://127.0.0.1:{port}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("APOSTROPHE_")},
        "APOSTROPHE_SECRET_KEY": "sample-secret",
        "APOSTROPHE_DATABASE_URL": url,
        "APOSTROPHE_PUBLIC_URL": base,
    }
    app = create_app(
        Settings("sample-secret", url), engine=make_engine(url), hasher=TEST_HASHER,
        telegram=FakeTelegram(), clock=MovableClock(NOW), upkeep_ticker=False,
    )
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        while not server.started:
            assert thread.is_alive(), "the test server stopped before it started"
            time.sleep(0.05)
        yield sample_app, env, base
    finally:
        server.should_exit = True
        thread.join(timeout=10)


def sign_in(sample_app: ModuleType, base: str, email: str, password: str) -> Any:
    api = sample_app.HttpApi(base)
    api.call("POST", "/auth/login", {"email": email, "password": password})
    return api


def test_onboarding_accounts_are_isolated_businesses_still_in_onboarding(tmp_path: Path) -> None:
    with running_sample(tmp_path) as (sample_app, env, base):
        # La Huerta, as `main()` opens it, seeded and with its own onboarding open.
        token = sample_app.new_business_token(env)
        huerta = sample_app.HttpApi(base)
        huerta.call(
            "POST",
            f"/invitations/{token}/accept",
            {
                "email": sample_app.EMAIL,
                "password": sample_app.PASSWORD,
                "business_name": sample_app.BUSINESS,
            },
        )
        huerta.call(
            "POST", "/auth/login", {"email": sample_app.EMAIL, "password": sample_app.PASSWORD}
        )
        sample_app.seed(huerta, TODAY)
        huerta_customers = {c["id"] for c in huerta.call("GET", "/customers")}

        accounts = sample_app.onboarding_accounts(env, base, TODAY)

        assert set(accounts) == set(sample_app.ONBOARDING_ACCOUNTS)
        assert len(accounts) >= 2
        optional_steps = {"bot", "partner", "categories", "header_footer"}
        apis = {
            name: sign_in(sample_app, base, account.email, account.password)
            for name, account in accounts.items()
        }
        for name, account in accounts.items():
            api = apis[name]
            progress = api.call("GET", "/onboarding-progress")
            assert progress["offered"] is True
            assert progress["over"] is False
            assert progress["resume"] in optional_steps
            assert api.call("GET", "/auth/me")["email"] == account.email
            mine = {c["id"] for c in api.call("GET", "/customers")}
            assert mine
            assert mine.isdisjoint(huerta_customers)

        # Ending one account's Onboarding leaves La Huerta's and the other account's open.
        first, *others = list(apis)
        assert apis[first].call("POST", "/onboarding-progress/skip-rest")["over"] is True
        assert apis[first].call("GET", "/onboarding-progress")["over"] is True
        for other in others:
            assert apis[other].call("GET", "/onboarding-progress")["over"] is False
        assert huerta.call("GET", "/onboarding-progress")["over"] is False
