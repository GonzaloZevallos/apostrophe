"""A rescale changes no figure (docs/adr/0080, amending docs/adr/0058).

Seam: the HTTP read routes through `TestClient`, before and after `ApplyMoneyFormat(b, '$', 2)`
over a business opened at scale 0. Each answer is parsed with `Decimal` for every number, so
`1500` and `1500.0` are the same value and nothing is compared as a float. The documents
must be equal, ids included: it is the same business.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.main import create_app
from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.application.apply_money_format import ApplyMoneyFormat
from tests.conftest import (
    SETTINGS,
    TEST_HASHER,
    MovableClock,
    open_business,
    signed_in,
)
from tests.fakes.telegram import FakeTelegram
from tests.results.entered_figures import enter, enter_extras

Documents = dict[str, Any]


def _documents(client: TestClient, customer_id: int, sale_id: int) -> Documents:
    paths = (
        "/panel",
        "/analysis",
        "/customers",
        f"/customers/{customer_id}",
        "/sales",
        f"/sales/{sale_id}",
    )
    found: Documents = {}
    for path in paths:
        answered = client.get(path)
        assert answered.status_code == 200, (path, answered.text)
        found[path] = json.loads(answered.text, parse_float=Decimal, parse_int=Decimal)
    return found


def _scale(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT scale FROM money_format")).scalar_one())


def test_every_figure_is_equal_before_and_after_the_rescale(
    engine: Engine, clock: MovableClock
) -> None:
    app = create_app(
        SETTINGS,
        engine=engine,
        clock=clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        opening_money_scale=0,
    )
    with TestClient(app) as opened:
        client = signed_in(opened, open_business(opened, engine, clock, "Cero", "cero@example.com"))
        entered = enter(client)
        enter_extras(client, entered["customer_id"])
        sale_id = client.get("/sales").json()[0]["id"]
        assert _scale(engine) == 0
        before = _documents(client, entered["customer_id"], sale_id)

        with Session(engine) as session:
            business_id = int(
                session.execute(text("SELECT business_id FROM money_format")).scalar_one()
            )
            ApplyMoneyFormat(SqlMoneyFormatWriter(session), session).execute(business_id, "$", 2)

        assert _scale(engine) == 2
        after = _documents(client, entered["customer_id"], sale_id)

    assert after == before
    # The data really moved money, the figures the comparison covers included.
    month = before["/panel"]["periods"]["month"]
    assert month["sales"] > 0 and month["cost_of_goods"] > 0 and month["expenses"] == 1_500
    assert before["/panel"]["debts"]["total_owed"] == Decimal(4_749)
    assert before["/analysis"]["month"]["products"]
