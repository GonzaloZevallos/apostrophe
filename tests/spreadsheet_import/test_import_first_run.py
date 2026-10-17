"""A successful import stamps `first_run.imported_at` with its own import instant, in its
single commit, and still ends an open Onboarding (docs/adr/0036, docs/adr/0046). Driven
through `cli.main` with the movable clock; the state is read back through the
repositories."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import make_engine
from app.main import create_app
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.adapters.tables import OnboardingRow
from app.onboarding.domain.first_run import FirstRun
from app.settings import Settings
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import main
from tests.conftest import TEST_HASHER, MovableClock, open_business
from tests.fakes.telegram import FakeTelegram
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)


@dataclass
class Setup:
    engine: Engine
    business_id: int
    clock: MovableClock
    tmp_path: Path


@pytest.fixture
def setup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, clock: MovableClock) -> Iterator[Setup]:
    url = f"sqlite:///{tmp_path / 'apostrophe.db'}"
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", url)
    engine = make_engine(url)
    app = create_app(
        Settings("cli-secret", url),
        engine=engine,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        clock=clock,
    )
    with TestClient(app) as seed_client:
        open_business(seed_client, engine, clock, "Primer Negocio", "uno@example.com")
    yield Setup(engine, _business_id(engine), clock, tmp_path)
    engine.dispose()


def _first_run(setup: Setup) -> FirstRun | None:
    with Session(setup.engine) as session:
        return SqlFirstRuns(session, setup.business_id).get()


def _open_onboarding_ended_at(setup: Setup) -> datetime | None:
    with Session(setup.engine) as session:
        onboarding = SqlOnboardings(session, setup.business_id).get()
        return None if onboarding is None else onboarding.ended_at


def _import(setup: Setup, *flags: str) -> int:
    xlsx = _save_workbook(_workbook(), setup.tmp_path)
    mapping = _save_mapping(setup.tmp_path, ((CUSTOMER, PHONE),))
    argv = [str(setup.business_id), str(xlsx), "--mapping", str(mapping), *flags]
    return main(argv, clock=setup.clock)


def _no_rows(setup: Setup) -> None:
    with Session(setup.engine) as session:
        session.execute(delete(OnboardingRow).where(OnboardingRow.business_id == setup.business_id))
        session.commit()


def _open_onboarding(setup: Setup) -> None:
    assert _open_onboarding_ended_at(setup) is None


def _first_run_row_with_nothing_stamped(setup: Setup) -> None:
    with setup.engine.begin() as connection:
        connection.execute(
            text("INSERT INTO first_run (business_id) VALUES (:b)"), {"b": setup.business_id}
        )


@pytest.mark.parametrize(
    ("starting_state", "onboarding_was_open"),
    [
        (_no_rows, False),
        (_open_onboarding, True),
        (_first_run_row_with_nothing_stamped, True),
    ],
    ids=["no rows", "an open onboarding row", "a first_run row with nothing stamped"],
)
def test_an_accepted_import_stamps_imported_at_with_its_instant_and_ends_the_onboarding(
    setup: Setup, starting_state: Callable[[Setup], None], onboarding_was_open: bool
) -> None:
    starting_state(setup)
    assert _first_run(setup) in (None, FirstRun())

    assert _import(setup) == 0

    assert _first_run(setup) == FirstRun(imported_at=setup.clock())
    if onboarding_was_open:
        assert _open_onboarding_ended_at(setup) == setup.clock()
    else:
        assert _open_onboarding_ended_at(setup) is None


def test_a_dry_run_leaves_no_first_run_row(setup: Setup) -> None:
    assert _import(setup, "--dry-run") == 0

    assert _first_run(setup) is None


def test_a_refused_real_run_leaves_no_first_run_row(setup: Setup) -> None:
    # An unknown Entradas origin blocks the plan, so the real run is refused.
    workbook = _workbook()
    workbook[layout.ENTRADAS_SHEET].cell(row=2, column=4, value="Robo")
    xlsx = _save_workbook(workbook, setup.tmp_path, "blocked.xlsx")
    argv = [str(setup.business_id), str(xlsx)]

    assert main(argv, clock=setup.clock) == 1

    assert _first_run(setup) is None
    assert _open_onboarding_ended_at(setup) is None
