"""A successful import ends the Onboarding in its single commit (docs/adr/0035), through
`cli.run` (the plan's seam; `write_import` is reached only through it). The Onboarding's
state is read back through its own repository, and the owner records through the HTTP API."""

from __future__ import annotations

import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.adapters.tables import OnboardingRow
from app.onboarding.domain.onboarding import Onboarding, Pass
from app.spreadsheet_import.adapters import layout
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    _business_id,
    _save_mapping,
    _save_workbook,
    _seed_variety,
    _workbook,
)

PASSES = Onboarding(header_footer=Pass.DONE, bot=Pass.SKIPPED, partner=Pass.SKIPPED)


def _onboarding(engine: Engine, business_id: int) -> Onboarding | None:
    with Session(engine) as session:
        return SqlOnboardings(session, business_id).get()


def _remember_passes(engine: Engine, business_id: int) -> None:
    with Session(engine) as session:
        SqlOnboardings(session, business_id).save(Onboarding(**vars(PASSES)))
        session.commit()


def _import(
    engine: Engine, clock: MovableClock, tmp_path: Path, business_id: int, *flags: str
) -> tuple[int, str, str]:
    xlsx = _save_workbook(_workbook(), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    out, err = io.StringIO(), io.StringIO()
    code = run(
        [str(business_id), str(xlsx), "--mapping", str(mapping), *flags],
        engine=engine,
        clock=clock,
        out=out,
        err=err,
    )
    return code, out.getvalue(), err.getvalue()


def test_an_accepted_import_ends_the_onboarding_and_keeps_its_passes(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    _remember_passes(engine, business_id)

    code, _out, err = _import(engine, clock, tmp_path, business_id)

    assert code == 0, err
    ended = _onboarding(engine, business_id)
    assert ended is not None
    assert ended.ended_at == clock()
    assert (ended.header_footer, ended.bot, ended.partner) == (
        Pass.DONE,
        Pass.SKIPPED,
        Pass.SKIPPED,
    )


def test_a_business_with_a_variety_is_refused_and_its_onboarding_is_unchanged(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    _seed_variety(client)
    business_id = _business_id(engine)
    _remember_passes(engine, business_id)
    before = _onboarding(engine, business_id)

    code, out, _err = _import(engine, clock, tmp_path, business_id)

    assert code == 1
    assert "import.business_has_records" in out
    assert _onboarding(engine, business_id) == before
    assert before is not None
    assert before.ended_at is None


def test_a_dry_run_and_a_refused_real_run_leave_the_onboarding_open(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)

    dry_code, _dry_out, _dry_err = _import(engine, clock, tmp_path, business_id, "--dry-run")
    assert dry_code == 0
    assert _onboarding(engine, business_id) == Onboarding.opened()

    # An unknown Entradas origin blocks the plan, so the real run is refused.
    workbook = _workbook()
    workbook[layout.ENTRADAS_SHEET].cell(row=2, column=4, value="Robo")
    xlsx = _save_workbook(workbook, tmp_path, "blocked.xlsx")
    out, err = io.StringIO(), io.StringIO()
    code = run([str(business_id), str(xlsx)], engine=engine, clock=clock, out=out, err=err)

    assert code == 1
    assert "Writable: no" in out.getvalue()
    assert _onboarding(engine, business_id) == Onboarding.opened()


def test_a_business_with_no_onboarding_imports_as_before(
    client: TestClient, engine: Engine, clock: MovableClock, tmp_path: Path
) -> None:
    business_id = _business_id(engine)
    with Session(engine) as session:
        session.execute(delete(OnboardingRow).where(OnboardingRow.business_id == business_id))
        session.commit()

    code, _out, err = _import(engine, clock, tmp_path, business_id)

    assert code == 0, err
    assert _onboarding(engine, business_id) is None
    assert len(client.get("/varieties").json()) == 1
