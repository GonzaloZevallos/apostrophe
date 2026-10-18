"""The phone check's own server and fixture (GH-80): the second e2e app answers at a pinned
instant, and `stretch` puts the worst-case data on the sample business without the design
comparisons ever seeing it (`sample_app.main` never calls it)."""

import ast
import os
from collections.abc import Iterator
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.db import make_engine
from app.main import create_app
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in
from tests.design.test_sample_app import SCRIPT, ClientApi, load_script
from tests.e2e_app import PINNED_INSTANT, create_mobile_e2e_app
from tests.fakes.telegram import FakeTelegram

NINE_DIGITS = 999_999_999
NAME_LENGTH = 60


def test_the_mobile_e2e_app_runs_at_the_pinned_argentina_noon(tmp_path: Path) -> None:
    os.environ["APOSTROPHE_SECRET_KEY"] = "mobile-secret"
    os.environ["APOSTROPHE_DATABASE_URL"] = f"sqlite:///{tmp_path / 'mobile.db'}"
    os.environ["APOSTROPHE_PUBLIC_URL"] = "http://127.0.0.1:1"
    app = create_mobile_e2e_app()
    now: datetime = app.state.clock()
    assert now.tzinfo is not None
    assert now == datetime(2026, 9, 16, 12, 0, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    assert app.state.clock() == PINNED_INSTANT  # every call, never a moving clock


@pytest.fixture
def pinned_client() -> Iterator[TestClient]:
    engine = make_engine("sqlite://")
    clock = MovableClock(PINNED_INSTANT)
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        yield signed_in(client, open_business(client, engine, clock, "Primer", "uno@example.com"))
    engine.dispose()


def test_stretch_puts_the_worst_case_data_on_the_sample_business(pinned_client: TestClient) -> None:
    client = pinned_client
    sample_app = load_script()
    api = ClientApi(client)
    today = date(2026, 9, 16)
    sample_app.seed(api, today)
    sample_app.stretch(api, today)

    for path in ("/customers", "/varieties", "/expense-categories"):
        names = [row["name"] for row in client.get(path).json()]
        assert NAME_LENGTH in {len(name) for name in names}, path
    assert len(client.get("/business").json()["name"]) == NAME_LENGTH

    month = client.get("/panel").json()["periods"]["month"]
    assert month["sales"] >= NINE_DIGITS
    assert month["profit"] == -NINE_DIGITS
    assert month["cash"] == -NINE_DIGITS


def test_the_sample_app_main_never_calls_stretch() -> None:
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "main")
    called = {
        node.func.id if isinstance(node.func, ast.Name) else getattr(node.func, "attr", "")
        for node in ast.walk(main)
        if isinstance(node, ast.Call)
    }
    assert "stretch" not in called
