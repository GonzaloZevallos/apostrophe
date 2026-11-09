"""A new business gets its `money_format` row when its invitation is accepted, in the same
transaction (ADR-0058, ADR-0006), through the `client` fixture's real `TestClient`, and the
real table satisfies `app.db.money_scale_factor`."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow, InvitationRow, UserRow
from app.db import MoneyFormatMissing, money_scale_factor
from app.main import CompositeOpening, create_app
from app.money_format.adapters.opening import MoneyFormatOpening
from app.money_format.adapters.reader import SqlMoneyFormat
from app.money_format.adapters.tables import MoneyFormatRow
from app.shared.language import BusinessLanguage
from app.shared.money import MoneyFormat
from tests.conftest import PASSWORD, SETTINGS, TEST_HASHER, MovableClock, invite
from tests.fakes.telegram import FakeTelegram


class _RaisingOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        raise RuntimeError("the opening fails")


def _rows(engine: Engine) -> list[tuple[int, str, int, int]]:
    with Session(engine) as session:
        return [
            (row.business_id, row.symbol, row.decimals, row.scale)
            for row in session.scalars(select(MoneyFormatRow).order_by(MoneyFormatRow.id))
        ]


def _business_ids(engine: Engine) -> list[int]:
    with Session(engine) as session:
        return list(session.scalars(select(BusinessRow.id).order_by(BusinessRow.id)))


def test_a_business_opened_through_the_client_has_one_dollar_row(
    client: TestClient, engine: Engine
) -> None:
    (business_id,) = _business_ids(engine)

    assert _rows(engine) == [(business_id, "$", 0, 0)]


def test_a_new_business_starts_at_scale_0_until_amounts_go_through_the_scale_helper(
    client: TestClient, engine: Engine
) -> None:
    """ADR-0058 ends at scale 2 for a new business. Until the part that routes every
    amount statement through `app/db.py`'s helper, a scale-2 business would hold whole
    pesos labelled as hundredths, so it stays 0; that part changes this test on purpose."""
    (_, _, _, scale) = _rows(engine)[0]

    assert scale == 0


def test_a_failing_opening_persists_no_business_and_the_invitation_stays_usable(
    app: FastAPI, engine: Engine, clock: MovableClock
) -> None:
    working = app.state.business_opening
    body = {"business_name": "Nuevo", "email": "nuevo@example.com", "password": PASSWORD}

    # The database is migrated when the app starts, so the invitation is issued inside.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        token = invite(engine, clock())
        app.state.business_opening = CompositeOpening(MoneyFormatOpening, _RaisingOpening)
        refused = test_client.post(f"/invitations/{token}/accept", json=body)
        assert refused.status_code == 500
        with Session(engine) as session:
            assert session.scalar(select(func.count()).select_from(BusinessRow)) == 0
            assert session.scalar(select(func.count()).select_from(UserRow)) == 0
            assert session.scalar(select(func.count()).select_from(MoneyFormatRow)) == 0
            assert session.scalars(select(InvitationRow.used_at)).all() == [None]

        app.state.business_opening = working
        accepted = test_client.post(f"/invitations/{token}/accept", json=body)
    assert accepted.status_code == 201, accepted.text
    (business_id,) = _business_ids(engine)
    assert _rows(engine) == [(business_id, "$", 0, 0)]


def test_the_real_table_satisfies_the_scale_helper(client: TestClient, engine: Engine) -> None:
    (business_id,) = _business_ids(engine)

    with Session(engine) as session:
        assert money_scale_factor(session, business_id) == 100
        with pytest.raises(MoneyFormatMissing):
            money_scale_factor(session, business_id + 1)


def test_the_money_scale_fixture_reaches_the_opening_through_the_apps_wiring(
    client: TestClient, engine: Engine, money_scale: int
) -> None:
    (_, _, _, scale) = _rows(engine)[0]

    assert scale == money_scale


def test_an_opening_given_scale_2_stores_it_and_the_helper_reads_it(
    engine: Engine, clock: MovableClock, telegram: FakeTelegram
) -> None:
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=telegram,
        upkeep_ticker=False,
        opening_money_scale=2,
    )
    with TestClient(app) as http:
        accepted = http.post(
            f"/invitations/{invite(engine, clock())}/accept",
            json={"business_name": "Dos", "email": "dos@example.com", "password": PASSWORD},
        )
    assert accepted.status_code == 201, accepted.text
    (business_id,) = _business_ids(engine)

    assert _rows(engine) == [(business_id, "$", 0, 2)]
    with Session(engine) as session:
        assert money_scale_factor(session, business_id) == 1


def test_the_reader_answers_the_symbol_and_decimals_and_never_selects_the_scale(
    client: TestClient, engine: Engine
) -> None:
    (business_id,) = _business_ids(engine)
    sent: list[str] = []

    def capture(_c: object, _k: object, statement: str, *_rest: object) -> None:
        sent.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        with Session(engine) as session:
            current = SqlMoneyFormat(session, business_id).current()
            with pytest.raises(MoneyFormatMissing):
                SqlMoneyFormat(session, business_id + 1).current()
    finally:
        event.remove(engine, "before_cursor_execute", capture)

    assert current == MoneyFormat("$", 0)
    assert len(sent) == 2
    assert all("scale" not in statement for statement in sent)
