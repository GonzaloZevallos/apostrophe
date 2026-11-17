"""The phone check's own server and fixture (GH-80): the second e2e app answers at a pinned
instant, and `stretch` puts the worst-case data on the sample business without the design
comparisons ever seeing it (`sample_app.main` never calls it)."""

import ast
import os
from collections.abc import Iterator
from dataclasses import asdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import make_engine
from app.main import create_app
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.pinned_catalog.adapters.telegram_holder import PinnedCatalogTelegram
from tests.conftest import SETTINGS, TEST_HASHER, MovableClock, open_business, signed_in
from tests.design.test_sample_app import SCRIPT, ClientApi, load_script
from tests.e2e_app import PINNED_INSTANT, create_mobile_e2e_app, main, pinned_clock
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

    for path in ("/customers", "/api/products", "/expense-categories"):
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


def test_the_mobile_e2e_app_talks_to_a_fake_telegram(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "mobile-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{tmp_path / 'mobile.db'}")
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://127.0.0.1:1")

    holder: PinnedCatalogTelegram = create_mobile_e2e_app().state.pinned_catalog_telegram

    assert isinstance(holder.api, FakeTelegram)


def test_the_pinned_clock_answers_the_pinned_instant_on_every_call() -> None:
    assert pinned_clock() == PINNED_INSTANT
    assert pinned_clock() == PINNED_INSTANT


@pytest.fixture
def pinned_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    database = tmp_path / "pinned.db"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "k" * 32)
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{database}")
    monkeypatch.setenv("APOSTROPHE_PUBLIC_URL", "http://localhost:9")
    return database


def test_pinned_invite_business_expires_seven_days_after_the_pinned_instant(
    pinned_environment: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["pinned", "invite-business"]) == 0
    token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[1]

    with TestClient(create_mobile_e2e_app()) as client:
        view = client.get(f"/invitations/{token}")

    assert view.status_code == 200, view.text
    assert datetime.fromisoformat(view.json()["expires_at"]) == PINNED_INSTANT + timedelta(days=7)


def test_pinned_date_prints_the_date_of_the_pinned_instant(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["pinned-date"]) == 0

    assert capsys.readouterr().out == f"{PINNED_INSTANT.date().isoformat()}\n"


def test_pinned_import_runs_the_importer_on_the_pinned_instant(
    pinned_environment: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    sample_app = load_script()
    assert main(["pinned", "invite-business"]) == 0
    token = capsys.readouterr().out.splitlines()[0].rsplit("/", 1)[1]
    with TestClient(create_mobile_e2e_app()) as client:
        accepted = client.post(
            f"/invitations/{token}/accept",
            json={
                "email": "importada@example.com",
                "password": "una-clave-larga-1",
                "business_name": "I",
            },
        )
        assert accepted.status_code == 201, accepted.text
        engine = cast(FastAPI, client.app).state.engine
    business = sample_app.business_id_of(pinned_environment, "importada@example.com")
    workbook = tmp_path / "import.xlsx"
    sample_app.load_import_workbook().build(workbook, PINNED_INSTANT.date())

    assert main(["pinned-import", str(business), str(workbook), "--dry-run"]) == 0
    dry = capsys.readouterr().out
    assert not any(heading in dry for heading in sample_app.REPORT_PROBLEM_HEADINGS)

    assert main(["pinned-import", str(business), str(workbook)]) == 0
    with Session(engine) as session:
        first_run = SqlFirstRuns(session, business).get()
    assert first_run is not None
    assert first_run.imported_at == PINNED_INSTANT
    assert first_run.imported_at is not None and first_run.imported_at.tzinfo is not None


def _seeded_twice() -> tuple[dict[str, Any], list[Any]]:
    sample_app = load_script()
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
        signed_in(client, open_business(client, engine, clock, "Primer", "uno@example.com"))
        api = ClientApi(client)
        sample = sample_app.seed(api, PINNED_INSTANT.date())
        sample_app.stretch(api, PINNED_INSTANT.date())
        sales = cast(list[Any], client.get("/sales").json())
    engine.dispose()
    return asdict(sample), sales


def test_two_pinned_seedings_give_the_same_sample_and_the_same_sales() -> None:
    assert _seeded_twice() == _seeded_twice()
