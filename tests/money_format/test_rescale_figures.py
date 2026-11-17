"""A rescale changes no recorded amount (docs/adr/0080, amending docs/adr/0058); a figure
worked out on read shows rounded half up at the new decimals.

Seam: the HTTP read routes through `TestClient`, before and after `ApplyMoneyFormat(b, '$', 2)`
over a business opened at scale 0. Each answer is parsed with `Decimal` for every number, so
`1500` and `1500.0` are the same value and nothing is compared as a float. The documents
must be equal, ids included, except the figures listed in `WORKED_OUT_ON_READ`: it is the
same business.
"""

from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal
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


def _differences(before: Any, after: Any, path: str = "") -> dict[str, tuple[Any, Any]]:
    """Where two parsed documents differ: the path to each figure that moved, with its value
    before and after."""
    if isinstance(before, dict) and isinstance(after, dict):
        moved: dict[str, tuple[Any, Any]] = {}
        for name in sorted(set(before) | set(after)):
            moved |= _differences(before.get(name), after.get(name), f"{path}/{name}")
        return moved
    if isinstance(before, list) and isinstance(after, list) and len(before) == len(after):
        moved = {}
        for index, (one, other) in enumerate(zip(before, after, strict=True)):
            moved |= _differences(one, other, f"{path}[{index}]")
        return moved
    return {} if before == after else {path: (before, after)}


# The figures worked out when they are read, from a lot's cost shared over the grams drawn:
# the exact value is not a whole number, so they show rounded half up at the decimals the
# Business shows (PRD, Behaviour). At 0 decimals that is the whole unit the "before" holds;
# at 2 it is the cent. Every other figure is a recorded amount and must not move.
WORKED_OUT_ON_READ = {
    "//analysis/month/average_margin/amount": Decimal("35798.33"),
    "//analysis/month/products[0]/cost/costed": Decimal("666.67"),
    "//analysis/month/products[0]/margin/amount": Decimal("18333.33"),
    "//analysis/month/shortfall/amount": Decimal("2433.33"),
    "//analysis/months[0]/cost_of_goods/amount": Decimal("4866.67"),
    "//analysis/months[0]/shortfall/amount": Decimal("2433.33"),
    "//analysis/since_first_record/shortfall/amount": Decimal("2433.33"),
    "//analysis/weeks[0]/cost_of_goods/amount": Decimal("4866.67"),
    "//analysis/weeks[0]/shortfall/amount": Decimal("2433.33"),
    "//panel/periods/month/cost_of_goods": Decimal("4866.67"),
    "//panel/periods/month/shortfall/amount": Decimal("2433.33"),
    "//panel/periods/today/cost_of_goods": Decimal("4866.67"),
    "//panel/periods/today/shortfall/amount": Decimal("2433.33"),
    "//panel/periods/week/cost_of_goods": Decimal("4866.67"),
    "//panel/periods/week/shortfall/amount": Decimal("2433.33"),
}


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

    moved = _differences(before, after)
    # Only the figures worked out on read move, and each lands on the exact value rounded
    # half up at 2 decimals; its "before" is that value rounded half up to the whole unit.
    assert {path: now for path, (_, now) in moved.items()} == WORKED_OUT_ON_READ
    for path, (was, now) in moved.items():
        assert was == now.quantize(Decimal(1), rounding=ROUND_HALF_UP), path
    # The data really moved money, the figures the comparison covers included.
    month = before["/panel"]["periods"]["month"]
    assert month["sales"] > 0 and month["cost_of_goods"] > 0 and month["expenses"] == 1_500
    assert before["/panel"]["debts"]["total_owed"] == Decimal(4_749)
    assert before["/analysis"]["month"]["products"]
