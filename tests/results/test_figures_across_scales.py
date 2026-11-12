"""The figures are the same at scale 0 and at scale 2 (docs/adr/0058).

Seam: the results HTTP routes (`/panel`, `/analysis`) and the routes that answer a balance,
through `TestClient`. One installation holds two businesses, one opened at scale 0 and one
at scale 2 through the app's own opening wiring; both enter the same data and every
figure, the ones that divide included, must come out equal. The two scales are opened here
on purpose, whatever the suite's `SCALES` is.
"""

from __future__ import annotations

from contextlib import ExitStack
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.main import create_app
from tests.conftest import (
    SETTINGS,
    TEST_HASHER,
    TODAY,
    MovableClock,
    open_business,
    signed_in,
)
from tests.fakes.telegram import FakeTelegram
from tests.results.entered_figures import enter

TODAY_TEXT = TODAY.isoformat()


def _without_ids(node: Any) -> Any:
    """The same body with every record id dropped: two businesses on one database never
    share an id, and an id is not a figure."""
    if isinstance(node, dict):
        return {
            key: _without_ids(value)
            for key, value in node.items()
            if key != "id" and not key.endswith("_id")
        }
    if isinstance(node, list):
        return [_without_ids(item) for item in node]
    return node


def _scales(engine: Engine) -> list[int]:
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT scale FROM money_format ORDER BY business_id")).all()
    return [int(row[0]) for row in rows]


def test_every_figure_is_the_same_at_scale_0_and_scale_2(
    engine: Engine, clock: MovableClock
) -> None:
    with ExitStack() as stack:
        clients = []
        for scale, name, email in ((0, "Cero", "cero@example.com"), (2, "Dos", "dos@example.com")):
            app = create_app(
                SETTINGS,
                engine=engine,
                clock=clock,
                hasher=TEST_HASHER,
                telegram=FakeTelegram(),
                upkeep_ticker=False,
                opening_money_scale=scale,
            )
            opened = stack.enter_context(TestClient(app))
            clients.append(signed_in(opened, open_business(opened, engine, clock, name, email)))
        zero, two = clients
        assert _scales(engine) == [0, 2]

        entered = [enter(zero), enter(two)]

        for path in ("/panel", "/analysis"):
            at_zero, at_two = zero.get(path), two.get(path)
            assert (at_zero.status_code, at_two.status_code) == (200, 200), path
            assert _without_ids(at_zero.json()) == _without_ids(at_two.json()), path
        # The data really moved money: sales, an expense, a cost of goods and an owed balance.
        month = zero.get("/panel").json()["periods"]["month"]
        assert month["sales"] > 0 and month["expenses"] == 1_500 and month["cost_of_goods"] > 0
        assert _without_ids(entered[0]["withdrawal"]) == _without_ids(entered[1]["withdrawal"])
        # A Stock shortfall is really there in both businesses: 1000 over 3 rounded, plus 3 of Rosa.
        shortfalls = [client.get("/analysis").json()["month"]["shortfall"] for client in clients]
        assert shortfalls[0] is not None and shortfalls[0]["amount"] == 2_433
        assert shortfalls[0] == shortfalls[1]
        panel_lines = [client.get("/panel").json()["periods"]["month"] for client in clients]
        assert panel_lines[0]["shortfall"] is not None
        assert panel_lines[0]["shortfall"] == panel_lines[1]["shortfall"]
        # Total owed, a customer's balance and the debtors list.
        owed = [client.get("/panel").json()["debts"] for client in clients]
        balances = [
            client.get(f"/customers/{done['customer_id']}").json()["balance"]
            for client, done in zip(clients, entered, strict=True)
        ]
        assert _without_ids(owed[0]) == _without_ids(owed[1])
        assert owed[0]["total_owed"] == 5_999
        assert balances == [5_999, 5_999]
        assert _without_ids(zero.get("/customers").json()) == _without_ids(
            two.get("/customers").json()
        )
        # Figures that divide: the same whole unit at both scales, never a hundredth.
        months = [client.get("/analysis").json()["month"] for client in clients]
        assert _without_ids(months[0]["average_margin"]) == _without_ids(
            months[1]["average_margin"]
        )
        assert _without_ids(months[0]["products"]) == _without_ids(months[1]["products"])
        averages = [
            client.get("/panel").json()["periods"]["month"]["average_sale"] for client in clients
        ]
        assert averages[0] == averages[1]
        assert isinstance(averages[0], int)
