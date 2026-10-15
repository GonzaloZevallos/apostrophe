"""`muestra.md` is the output of `scripts/design/capture_muestra.py` at the date it states
(docs/product/design-system/README.md: one source for every La Huerta figure), and the seed
at that date has the states the screens draw."""

import importlib.util
import re
import sys
from datetime import UTC, date, datetime, time
from pathlib import Path
from types import ModuleType
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import MovableClock
from tests.design.test_sample_app import ClientApi, load_script

ROOT = Path(__file__).resolve().parents[2]
MUESTRA = ROOT / "docs" / "product" / "design-system" / "muestra.md"
CAPTURE = ROOT / "scripts" / "design" / "capture_muestra.py"


def load_capture() -> ModuleType:
    spec = importlib.util.spec_from_file_location("capture_muestra", CAPTURE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def captured_on(text: str) -> date:
    """The one place the capture date lives: the `Capturada:` line of muestra.md."""
    found = re.findall(r"^Capturada: (\d{4}-\d{2}-\d{2})$", text, flags=re.MULTILINE)
    assert len(found) == 1, "muestra.md states exactly one `Capturada:` line"
    return date.fromisoformat(found[0])


def generated_section(text: str, start: str, end: str) -> str:
    """What sits between the two fixed headings, which delimit the generated tables."""
    assert text.count(start) == 1 and text.count(end) == 1
    return text.split(start, 1)[1].split(end, 1)[0]


def drift(text: str) -> bool:
    """Whether `text`'s generated section differs from what the script prints at the date
    `text` states."""
    capture = load_capture()
    section = generated_section(text, capture.SECTION_START, capture.SECTION_END)
    rendered: str = capture.render_muestra(captured_on(text))
    return section != rendered


def test_muestra_tables_are_the_capture_script_output_byte_for_byte() -> None:
    assert not drift(MUESTRA.read_text(encoding="utf-8"))


def test_a_hand_edited_figure_is_caught() -> None:
    text = MUESTRA.read_text(encoding="utf-8")
    assert "$ 194.000" in text

    assert drift(text.replace("$ 194.000", "$ 195.000", 1))
    assert drift(text.replace("Capturada: 2026-10-07", "Capturada: 2026-10-08", 1))


def seeded_at_capture_date(client: TestClient, clock: MovableClock) -> None:
    day = captured_on(MUESTRA.read_text(encoding="utf-8"))
    clock.set(datetime.combine(day, time(18, 0), tzinfo=UTC))
    load_script().seed(ClientApi(client), day)


def amounts(line: dict[str, Any] | None) -> tuple[int, bool] | None:
    """A cost line as (amount, pending), whichever way its answer spells the pending mark."""
    if line is None:
        return None
    pending = line["pending"] if "pending" in line else line["pending_grams"] > 0
    return line["amount"], bool(pending)


def test_the_seed_at_the_capture_date_has_the_states_the_screens_draw(
    client: TestClient, clock: MovableClock
) -> None:
    seeded_at_capture_date(client, clock)

    periods = client.get("/panel").json()["periods"]
    for name in ("today", "week", "month"):
        assert periods[name]["shortfall"] is not None, name
    # Own use goes beyond every lot of Sir Jack, so it is pending; promotion is not.
    assert periods["week"]["own_use"]["pending"] is True
    assert periods["week"]["promotion"]["pending"] is False

    analysis = client.get("/analysis").json()
    # The analysis spells the shortfall on the month's header, on the total since the
    # first record and on its week and month rows.
    assert analysis["month"]["shortfall"] is not None
    assert analysis["since_first_record"]["shortfall"] is not None
    assert amounts(analysis["month"]["shortfall"]) == amounts(periods["month"]["shortfall"])
    assert amounts(analysis["since_first_record"]["shortfall"]) == amounts(
        periods["month"]["shortfall"]
    )
    assert amounts(analysis["weeks"][-1]["shortfall"]) == amounts(periods["week"]["shortfall"])
    assert amounts(analysis["months"][-1]["shortfall"]) == amounts(periods["month"]["shortfall"])


def test_the_captured_weeks_and_months_hold_the_three_kinds_of_period(
    client: TestClient, clock: MovableClock
) -> None:
    seeded_at_capture_date(client, clock)
    analysis = client.get("/analysis").json()

    for name in ("weeks", "months"):
        rows = analysis[name]
        # A costed shortfall: the amount is not zero and nothing of it waits for a cost.
        assert any(
            r["shortfall"] is not None
            and r["shortfall"]["amount"] > 0
            and r["shortfall"]["pending_grams"] == 0
            for r in rows
        ), name
        # A pending figure on a row (this period's own use on Sir Jack).
        assert any(
            r[field] is not None and r[field]["pending_grams"] > 0
            for r in rows
            for field in ("own_use", "cost_of_goods", "shortfall", "promotion")
        ), name
        # A period with no negative adjustment: no shortfall, cost of goods still there.
        assert any(r["shortfall"] is None for r in rows), name
        assert all(r["cost_of_goods"] is not None for r in rows), name

        # The two named periods, not just any: today's 24K Gold -2 g is the current
        # period's costed shortfall ($ 10.000, nothing pending), and Sir Jack's gram of
        # own use, beyond every lot, is its pending figure (the cookies' share is costed).
        current = rows[-1]
        assert current["shortfall"] == {
            "amount": 10_000,
            "pending_grams": 0,
            "all_pending": False,
        }, name
        assert current["own_use"]["pending_grams"] == 1, name
        assert current["own_use"]["all_pending"] is False, name
        assert current["own_use"]["amount"] > 0, name


def test_the_panel_and_the_analysis_agree_on_the_current_week_and_month(
    client: TestClient, clock: MovableClock
) -> None:
    seeded_at_capture_date(client, clock)
    periods = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()

    rows = {"week": analysis["weeks"][-1], "month": analysis["months"][-1]}
    for name, row in rows.items():
        panel = periods[name]
        assert row["first_day"] == panel["start"] and row["last_day"] == panel["end"]
        assert row["profit"]["amount"] == panel["profit"]
        assert (row["profit"]["pending_grams"] > 0) == panel["profit_pending"]
        assert amounts(row["cost_of_goods"]) == (panel["cost_of_goods"], panel["pending_cost"])
        assert amounts(row["shortfall"]) == amounts(panel["shortfall"])
        assert (row["shortfall"] is None) == (panel["shortfall"] is None)
        assert amounts(row["promotion"]) == amounts(panel["promotion"])
        assert amounts(row["own_use"]) == amounts(panel["own_use"])
        assert row["expenses"] == panel["expenses"]
        assert row["cash"] == panel["cash"]

    varieties = analysis["month"]["varieties"]
    assert sum(v["cost"]["costed"] for v in varieties) == periods["month"]["cost_of_goods"]
    assert analysis["month"]["sales"] == periods["month"]["sales"]


def test_the_capture_prints_the_two_new_lines_on_every_week_and_month_row() -> None:
    text = MUESTRA.read_text(encoding="utf-8")
    for heading in ("Análisis · semanas", "Análisis · meses"):
        lines = text.split(f"### {heading}\n", 1)[1].split("\n### ", 1)[0].splitlines()
        periods = sum(1 for line in lines if " | Ventas | " in line)
        assert periods > 0
        # Cost of goods is on every row; the shortfall only where there was an adjustment.
        assert sum(1 for line in lines if " | Costo de lo vendido | " in line) == periods
        assert 0 < sum(1 for line in lines if " | Faltante de stock | " in line) < periods


def test_a_cost_figure_is_printed_in_the_screens_pending_form() -> None:
    capture = load_capture()
    figure = capture.cost_figure

    assert figure({"amount": 9000, "pending_grams": 0, "all_pending": False}) == ("$ 9.000", "no")
    assert figure({"amount": 9000, "pending_grams": 1.5, "all_pending": False}) == (
        "$ 9.000",
        "y 1,5 g sin costo",
    )
    # Entirely pending: grams only, never a peso amount, and no second note.
    assert figure({"amount": 0, "pending_grams": 2, "all_pending": True}) == (
        "2 g sin costo",
        "no",
    )
    # A real $ 0 (a lot recorded with no cost) is not pending.
    assert figure({"amount": 0, "pending_grams": 0, "all_pending": False}) == ("$ 0", "no")
