"""`GET /panel` and `GET /analysis` over stock withdrawals (CODING_STANDARDS section 5):
a fresh in-memory SQLite per test, the real adapters, the movable clock (Friday
2026-10-02, so Hoy, the week 28/09-04/10 and the month 01/10-31/10 each hold records
the others do not). Seeds only through the API.

Both routes read the one `PeriodTotals` computation, so a withdrawal's Promoción and
Consumo propio must agree between them with 0 differences, and a withdrawal must move
none of the sale, stock-shortfall or cash figures.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import TODAY
from tests.contract_shapes import assert_matches_fixture

HOY = TODAY.isoformat()


def _variety(client: TestClient, name: str, price: int = 1_000) -> int:
    variety = client.post("/varieties", json={"name": name}).json()
    priced = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2020-01-01", "list_price": price},
    )
    assert priced.status_code == 201, priced.text
    return int(variety["id"])


def _entry(
    client: TestClient, variety_id: int, *, grams: str, on: str, total_cost: int | None = None
) -> None:
    body: dict[str, Any] = {
        "variety_id": variety_id,
        "origin": "opening_stock",
        "grams": grams,
        "date": on,
    }
    if total_cost is not None:
        body["total_cost"] = total_cost
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _adjust(client: TestClient, variety_id: int, *, grams: str, on: str) -> None:
    response = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "adjustment", "grams": grams, "date": on},
    )
    assert response.status_code == 201, response.text


def _sale(client: TestClient, variety_id: int, *, grams: str, on: str) -> None:
    response = client.post(
        "/sales",
        json={
            "date": on,
            "payment": "cash",
            "lines": [{"variety_id": variety_id, "grams": grams}],
        },
    )
    assert response.status_code == 201, response.text


def _withdraw(client: TestClient, variety_id: int, *, reason: str, grams: str, on: str) -> None:
    response = client.post(
        "/stock/withdrawals",
        json={
            "reason": reason,
            "date": on,
            "lines": [{"variety_id": variety_id, "grams": grams}],
        },
    )
    assert response.status_code == 201, response.text


def _seed_the_history(client: TestClient) -> None:
    """A holds a $100/g lot (100 g for $10.000, 01/09); B has no entry at all, so
    everything taken from it is pending.

    - A: promotion 10/09 1 g and 29/09 4 g, own use 01/10 3 g (all costed), a -2 g
      adjustment 30/09 (costed), a 5 g sale 02/10 (costed).
    - B: a promotion 02/10 of 2 g, a -1 g adjustment 02/10 and a 1 g sale 02/10: each
      wholly pending.
    """
    a = _variety(client, "A")
    b = _variety(client, "B")
    _entry(client, a, grams="100", total_cost=10_000, on="2026-09-01")
    _withdraw(client, a, reason="promotion", grams="1", on="2026-09-10")
    _withdraw(client, a, reason="promotion", grams="4", on="2026-09-29")
    _adjust(client, a, grams="-2", on="2026-09-30")
    _withdraw(client, a, reason="own_use", grams="3", on="2026-10-01")
    _sale(client, a, grams="5", on=HOY)
    _withdraw(client, b, reason="promotion", grams="2", on=HOY)
    _adjust(client, b, grams="-1", on=HOY)
    _sale(client, b, grams="1", on=HOY)


def test_the_panel_and_analysis_agree_on_every_withdrawal_figure(client: TestClient) -> None:
    _seed_the_history(client)

    panel = client.get("/panel").json()
    analysis = client.get("/analysis").json()

    assert_matches_fixture(panel, "panel")
    assert_matches_fixture(analysis, "analysis")
    today, week, month = (panel["periods"][name] for name in ("today", "week", "month"))

    # By hand. Week 28/09-04/10: promotion 4 g costed ($400) + B's 2 g pending; own use
    # 3 g ($300). Month October: only B's 2 g pending promotion, the same $300 own use.
    # Hoy: only B's pending promotion.
    assert week["promotion"] == {"amount": 400, "pending": True}
    assert week["own_use"] == {"amount": 300, "pending": False}
    assert month["promotion"] == {"amount": 0, "pending": True}
    assert month["own_use"] == {"amount": 300, "pending": False}
    assert today["promotion"] == {"amount": 0, "pending": True}
    assert today["own_use"] is None
    # The shortfall stays the adjustments' own: $200 costed on 30/09, B's pending on Hoy.
    assert week["shortfall"] == {"amount": 200, "pending": True}
    # Week profit: A's costed sale $5.000 - cost $500 - shortfall $200 - promotion $400
    # - own use $300 (B's wholly pending sale is out of it, as for any pending sale).
    assert week["profit"] == 5_000 - 500 - 200 - 400 - 300
    assert week["profit_pending"] is True
    # October: the same, less the 30/09 shortfall and the 29/09 promotion.
    assert month["profit"] == 5_000 - 500 - 300
    assert month["profit_pending"] is True

    week_row = analysis["weeks"][-1]
    month_row = analysis["months"][-1]
    for panel_period, row in ((week, week_row), (month, month_row)):
        assert row["profit"]["amount"] == panel_period["profit"]
        assert (row["profit"]["pending_grams"] > 0) == panel_period["profit_pending"]
        assert row["sales"] == panel_period["sales"]
        assert row["expenses"] == panel_period["expenses"]
        assert row["cash"] == panel_period["cash"]
        for line in ("promotion", "own_use"):
            assert row[line]["amount"] == panel_period[line]["amount"]
            assert (row[line]["pending_grams"] > 0) == panel_period[line]["pending"]
    assert week_row["promotion"]["pending_grams"] == 2.0
    assert month_row["own_use"]["pending_grams"] == 0.0

    # The chosen month's header carries the same two lines as the month row, and the
    # month's cost of goods is its varieties' costed cost (A's 5 g sale only).
    header = analysis["month"]
    assert header["promotion"] == month_row["promotion"]
    assert header["own_use"] == month_row["own_use"]
    assert header["shortfall"] == {"amount": 0, "pending_grams": 1.0, "all_pending": True}
    assert sum(v["cost"]["costed"] for v in header["varieties"]) == month["cost_of_goods"] == 500

    # Since the first record: every promotion ($100 + $400, B's 2 g pending) and own use.
    since = analysis["since_first_record"]
    assert since["promotion"] == {"amount": 500, "pending_grams": 2.0, "all_pending": False}
    assert since["own_use"] == {"amount": 300, "pending_grams": 0.0, "all_pending": False}

    # A month with only one reason shows no line for the other (September: no own use).
    september = next(m for m in analysis["months"] if m["month"] == "2026-09")
    assert september["promotion"] == {"amount": 500, "pending_grams": 0.0, "all_pending": False}
    assert september["own_use"] is None


def test_a_withdrawal_dated_before_every_other_record_starts_the_history(
    client: TestClient,
) -> None:
    a = _variety(client, "A")
    _withdraw(client, a, reason="promotion", grams="2", on="2026-10-01")
    _entry(client, a, grams="10", total_cost=1_000, on=HOY)
    _sale(client, a, grams="1", on=HOY)

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()

    assert analysis["first_record"] == "2026-10-01"
    # The later entry settles the withdrawn grams at its $100/g.
    assert analysis["weeks"][-1]["promotion"] == {
        "amount": 200,
        "pending_grams": 0.0,
        "all_pending": False,
    }
    assert analysis["months"][-1]["promotion"] == {
        "amount": 200,
        "pending_grams": 0.0,
        "all_pending": False,
    }
    for period, row in (
        (panel["week"], analysis["weeks"][-1]),
        (panel["month"], analysis["months"][-1]),
    ):
        assert period["promotion"] == {"amount": 200, "pending": False}
        assert row["profit"]["amount"] == period["profit"] == 1_000 - 100 - 200


def test_a_business_whose_only_record_is_a_withdrawal_has_a_history(client: TestClient) -> None:
    a = _variety(client, "A")
    _withdraw(client, a, reason="own_use", grams="3", on=HOY)

    analysis = client.get("/analysis").json()
    panel = client.get("/panel").json()["periods"]

    assert analysis["first_record"] == HOY
    assert len(analysis["weeks"]) >= 1
    assert analysis["weeks"][-1]["sales"] == 0
    assert analysis["weeks"][-1]["own_use"] == {
        "amount": 0,
        "pending_grams": 3.0,
        "all_pending": True,
    }
    assert analysis["weeks"][-1]["promotion"] is None
    assert analysis["months"][-1]["own_use"] == {
        "amount": 0,
        "pending_grams": 3.0,
        "all_pending": True,
    }
    assert analysis["since_first_record"]["own_use"] == {
        "amount": 0,
        "pending_grams": 3.0,
        "all_pending": True,
    }
    assert analysis["since_first_record"]["profit"]["pending_grams"] == 3.0
    assert panel["month"]["own_use"] == {"amount": 0, "pending": True}
    assert panel["month"]["profit_pending"] is True


def test_a_withdrawal_moves_none_of_the_sale_shortfall_or_cash_figures(
    client: TestClient,
) -> None:
    a = _variety(client, "A")
    _entry(client, a, grams="50", total_cost=5_000, on="2026-09-01")
    _sale(client, a, grams="5", on=HOY)
    _adjust(client, a, grams="-1", on=HOY)
    before_panel = client.get("/panel").json()["periods"]
    before_analysis = client.get("/analysis").json()

    _withdraw(client, a, reason="promotion", grams="4", on=HOY)
    _withdraw(client, a, reason="own_use", grams="60", on=HOY)

    after_panel = client.get("/panel").json()["periods"]
    after_analysis = client.get("/analysis").json()

    untouched = (
        "sales",
        "sales_count",
        "average_sale",
        "grams_sold",
        "grams_gifted",
        "cost_of_goods",
        "pending_cost",
        "shortfall",
        "expenses",
        "purchases",
        "cash",
    )
    for name in ("today", "week", "month"):
        for key in untouched:
            assert after_panel[name][key] == before_panel[name][key], (name, key)
        assert after_panel[name]["promotion"] is not None or name == "today"
    assert after_panel["month"]["profit"] < before_panel["month"]["profit"]
    for key in ("sales", "grams_sold", "grams_gifted", "average_margin", "shortfall", "varieties"):
        assert after_analysis["month"][key] == before_analysis["month"][key], key
    assert after_analysis["weekdays"] == before_analysis["weekdays"]
    for row_before, row_after in zip(
        before_analysis["weeks"] + before_analysis["months"],
        after_analysis["weeks"] + after_analysis["months"],
        strict=True,
    ):
        for key in ("sales", "grams", "expenses", "cash"):
            assert row_after[key] == row_before[key], key
    assert (
        after_analysis["since_first_record"]["cash"]
        == before_analysis["since_first_record"]["cash"]
    )
    assert (
        after_analysis["since_first_record"]["shortfall"]
        == before_analysis["since_first_record"]["shortfall"]
    )


def test_another_business_s_withdrawals_never_reach_the_answers(
    client: TestClient, other_client: TestClient
) -> None:
    a = _variety(client, "A")
    _withdraw(client, a, reason="promotion", grams="2", on=HOY)

    panel = other_client.get("/panel").json()["periods"]
    analysis = other_client.get("/analysis").json()

    for period in panel.values():
        assert period["promotion"] is None
        assert period["own_use"] is None
        assert period["profit"] == 0
    assert analysis["first_record"] is None
    assert analysis["since_first_record"] is None
    assert analysis["month"]["promotion"] is None
    assert analysis["month"]["own_use"] is None
