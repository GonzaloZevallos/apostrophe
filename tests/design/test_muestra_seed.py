"""`muestra.md` is the output of `scripts/design/capture_muestra.py` at the date it states
(docs/product/design-system/README.md: one source for every La Huerta figure), and the seed
at that date has the states the screens draw."""

import importlib.util
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
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


def seeded_at_capture_date(client: TestClient, clock: MovableClock) -> Any:
    day = captured_on(MUESTRA.read_text(encoding="utf-8"))
    clock.set(datetime.combine(day, time(18, 0), tzinfo=UTC))
    return load_script().seed(ClientApi(client), day)


def amounts(line: dict[str, Any] | None) -> tuple[int, bool] | None:
    """A cost line as (amount, pending), whichever way its answer spells the pending mark."""
    if line is None:
        return None
    pending = line["pending"] if "pending" in line else line["pending_quantity"] > 0
    return line["amount"], bool(pending)


# The figures below also stand in muestra.md; they are literals on purpose, so a deliberate
# change of the seed fails here until muestra.md is recaptured and these are read again.
MONTH_PENDING_QUANTITY = 1  # "Consumo propio | $ 14.000 | y 1 g sin costo", and "Ganancia".
OWN_USE_AMOUNT = 14_000  # Golden Cookies' 2 g at $ 7.000; Sir Jack's gram has no lot.
SHORTFALL_AMOUNT = 10_000  # 24K Gold's 2 g at $ 5.000, "Faltante de stock" in muestra.md.
HINT = (
    " (muestra.md and scripts/design/capture_muestra.py: change the seed on purpose,"
    " then recapture and update this pin)"
)


def varieties_by_name(client: TestClient) -> dict[str, int]:
    return {v["name"]: v["id"] for v in client.get("/api/products").json()}


def movements_of(client: TestClient, variety_id: int) -> list[dict[str, Any]]:
    answer: list[dict[str, Any]] = client.get(f"/stock/varieties/{variety_id}/movements").json()
    return answer


def assert_seed_states(client: TestClient) -> None:
    """The states the screens draw, pinned on the variety they sit on: Sir Jack's own use
    is the one pending figure, promotion is costed, and the shortfall is 24K Gold's 2 g.
    Reads HTTP answers only, with literals, never the seed's own constants."""
    day = captured_on(MUESTRA.read_text(encoding="utf-8")).isoformat()
    ids = varieties_by_name(client)
    jack = ids["Sir Jack"]

    periods = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()
    week, month = analysis["weeks"][-1], analysis["months"][-1]

    # Own use: Sir Jack's gram goes beyond every lot, so only it is pending.
    own_use = {"amount": OWN_USE_AMOUNT, "pending_quantity": 1, "all_pending": False}
    assert week["own_use"] == own_use, "own use" + HINT
    assert periods["week"]["own_use"] == {"amount": OWN_USE_AMOUNT, "pending": True}, HINT
    stock = {row["variety_id"]: row["status"] for row in client.get("/stock").json()["varieties"]}
    assert stock[jack] == "sold_out", "Sir Jack sold out" + HINT
    jack_uses = [
        m for m in movements_of(client, jack) if m["kind"] == "withdrawal" and m["date"] == day
    ]
    assert [(m["reason"], m["quantity"]) for m in jack_uses] == [("own_use", 1)], "Sir Jack" + HINT

    # Promotion is costed, in the week and in the month.
    assert week["promotion"]["pending_quantity"] == 0, "promotion week" + HINT
    assert analysis["month"]["promotion"]["pending_quantity"] == 0, "promotion month" + HINT
    for name in ("week", "month"):
        assert periods[name]["promotion"]["pending"] is False, f"promotion {name}" + HINT

    # The shortfall is 24K Gold's costed 2 g adjustment, and nobody else's.
    for where in (analysis["month"], analysis["since_first_record"]):
        costed = {"amount": SHORTFALL_AMOUNT, "pending_quantity": 0, "all_pending": False}
        assert where["shortfall"] == costed, HINT
    for name in ("today", "week", "month"):
        assert amounts(periods[name]["shortfall"]) == (SHORTFALL_AMOUNT, False), name + HINT
    adjustments = {
        name: [
            (m["date"], m["quantity"])
            for m in movements_of(client, vid)
            if m.get("origin") == "adjustment"
        ]
        for name, vid in ids.items()
    }
    assert adjustments["24K Gold"] == [(day, -2)], "24K Gold adjustment" + HINT
    assert [n for n, found in adjustments.items() if found and n != "24K Gold"] == [], HINT

    # The month's "y N g sin costo", on its row and on the panel's mark.
    assert month["profit"]["pending_quantity"] == MONTH_PENDING_QUANTITY, "sin costo" + HINT
    assert periods["month"]["profit_pending"] is True, HINT


def test_the_seed_at_the_capture_date_has_the_states_the_screens_draw(
    client: TestClient, clock: MovableClock
) -> None:
    seeded_at_capture_date(client, clock)

    assert_seed_states(client)

    analysis = client.get("/analysis").json()
    periods = client.get("/panel").json()["periods"]
    # The analysis spells the shortfall on the month's header, on the total since the
    # first record and on the current week and month rows.
    assert analysis["month"]["shortfall"] is not None
    assert analysis["since_first_record"]["shortfall"] is not None
    assert amounts(analysis["month"]["shortfall"]) == amounts(periods["month"]["shortfall"])
    assert amounts(analysis["since_first_record"]["shortfall"]) == amounts(
        periods["month"]["shortfall"]
    )
    assert amounts(analysis["weeks"][-1]["shortfall"]) == amounts(periods["week"]["shortfall"])
    assert amounts(analysis["months"][-1]["shortfall"]) == amounts(periods["month"]["shortfall"])
    # The current month's shortfall is one figure in the header, on the row and on Inicio.
    assert analysis["month"]["shortfall"] == analysis["months"][-1]["shortfall"]
    assert amounts(analysis["months"][-1]["shortfall"]) == amounts(periods["month"]["shortfall"])


ARCHIVED_NAME = "Blue Dream"


def test_the_archived_variety_has_one_opening_stock_entry_and_nothing_else(
    client: TestClient, clock: MovableClock
) -> None:
    sample = seeded_at_capture_date(client, clock)

    archived = client.get("/api/products", params={"archived": "true"}).json()
    assert [(v["id"], v["name"], v["archived"]) for v in archived] == [
        (sample.archived, ARCHIVED_NAME, True)
    ]
    assert archived[0]["current_price"] is not None
    movements = movements_of(client, sample.archived)
    assert [(m["kind"], m["origin"], m["quantity"], m["total_cost"]) for m in movements] == [
        ("entry", "opening_stock", 25, None)
    ]
    first_record = client.get("/analysis").json()["first_record"]
    assert movements[0]["date"] >= first_record
    # A day the sample already has a record on: the sales and entries of the others.
    others = {
        m["date"] for vid in varieties_by_name(client).values() for m in movements_of(client, vid)
    }
    assert movements[0]["date"] in others
    stock = {
        r["variety_id"]: r
        for r in client.get("/stock", params={"archived": "true"}).json()["varieties"]
    }
    assert stock[sample.archived]["threshold"] == 15
    assert stock[sample.archived]["quantity"] == 25


def test_the_archived_variety_is_hidden_and_carries_its_catalog_attributes(
    client: TestClient, clock: MovableClock
) -> None:
    sample = seeded_at_capture_date(client, clock)

    client.post(f"/api/products/{sample.archived}/restore")
    catalog = {v["id"]: v for v in client.get("/catalog").json()["varieties"]}

    assert catalog[sample.archived]["shown"] is False
    assert catalog[sample.archived]["emoji"] == "🫐"
    assert catalog[sample.archived]["indica_share"] == 40
    assert catalog[sample.archived]["aroma"] == "Frutos rojos"


def test_the_archived_variety_touches_no_read_of_the_live_business(
    client: TestClient, clock: MovableClock
) -> None:
    sample = seeded_at_capture_date(client, clock)
    gone = sample.archived

    assert gone not in [r["variety_id"] for r in client.get("/panel").json()["stock"]]
    assert gone not in [r["variety_id"] for r in client.get("/stock").json()["varieties"]]
    assert gone not in [v["id"] for v in client.get("/api/products").json()]
    catalog = client.get("/catalog").json()
    assert gone not in [v["id"] for v in catalog["varieties"]]
    assert ARCHIVED_NAME not in (catalog["text"] or "")
    analysis = client.get("/analysis").json()
    assert gone not in [v["variety_id"] for v in analysis["month"]["varieties"]]

    assert gone in [
        r["variety_id"]
        for r in client.get("/stock", params={"archived": "true"}).json()["varieties"]
    ]
    assert gone in [v["id"] for v in client.get("/api/products", params={"archived": "true"}).json()]
    assert gone in {e["variety_id"] for e in client.get("/stock").json()["entries"]}


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
        assert (row["profit"]["pending_quantity"] > 0) == panel["profit_pending"]
        assert row["cost_of_goods"]["amount"] == panel["cost_of_goods"]
        assert (row["cost_of_goods"]["pending_quantity"] > 0) == panel["pending_cost"]
        assert amounts(row["shortfall"]) == amounts(panel["shortfall"])
        assert amounts(row["promotion"]) == amounts(panel["promotion"])
        assert amounts(row["own_use"]) == amounts(panel["own_use"])
        assert row["expenses"] == panel["expenses"]
        assert row["cash"] == panel["cash"]

    varieties = analysis["month"]["varieties"]
    assert sum(v["cost"]["costed"] for v in varieties) == periods["month"]["cost_of_goods"]
    assert analysis["month"]["sales"] == periods["month"]["sales"]


def test_every_analysis_week_and_month_row_prints_its_cost_of_goods() -> None:
    capture = load_capture()
    text: str = capture.render_muestra(captured_on(MUESTRA.read_text(encoding="utf-8")))
    weeks = generated_section(text + "§", "### Análisis · semanas", "### Análisis · meses")
    months = generated_section(text + "§", "### Análisis · meses", "### Análisis · días")
    # Periods before the first record are absent, so each table has as many rows of
    # Ventas as it has periods, and every one of them prints its cost of goods.
    for table in (weeks, months):
        periods = table.count(" | Ventas |")
        assert periods > 1
        assert table.count(" | Costo de lo vendido |") == periods
        # Faltante de stock appears only on the periods that have one.
        assert 0 < table.count(" | Faltante de stock |") < periods


def test_a_row_cost_reads_grams_alone_only_when_everything_behind_it_is_pending() -> None:
    row_cost = load_capture().row_cost
    assert row_cost({"amount": 0, "pending_quantity": 4.0, "all_pending": True}) == "4 g sin costo"
    # A partly pending figure keeps its amount; its grams are the Pendiente column.
    assert row_cost({"amount": 9000, "pending_quantity": 2.5, "all_pending": False}) == "$ 9.000"
    # Costed at zero with nothing pending is a real $ 0, not a missing cost.
    assert row_cost({"amount": 0, "pending_quantity": 0, "all_pending": False}) == "$ 0"


@dataclass
class Rewrite:
    """A call's replacement body and the calls to make right after it."""

    body: dict[str, Any]
    then: list[tuple[str, str, dict[str, Any]]] = field(default_factory=list)


Swap = Callable[[str, str, dict[str, Any], dict[str, int]], Rewrite | None]


class RewritingApi(ClientApi):
    """The seed's `Api` that changes the one call a swap targets, found by its method,
    path and body, never by its position, and counts how many it changed."""

    def __init__(self, client: TestClient, swap: Swap) -> None:
        super().__init__(client)
        self.swap = swap
        self.ids: dict[str, int] = {}
        self.rewrites = 0

    def call(self, method: str, path: str, body: object | None = None) -> Any:
        if isinstance(body, dict):
            rewrite = self.swap(method, path, body, self.ids)
            if rewrite is not None:
                self.rewrites += 1
                answer = super().call(method, path, rewrite.body)
                for then_method, then_path, then_body in rewrite.then:
                    super().call(then_method, then_path, then_body)
                return answer
        answer = super().call(method, path, body)
        if method == "POST" and path == "/api/products" and isinstance(body, dict):
            self.ids[body["name"]] = answer["id"]
        return answer


def own_use_of(method: str, path: str, body: dict[str, Any], ids: dict[str, int]) -> bool:
    return (
        (method, path) == ("POST", "/stock/withdrawals")
        and body["reason"] == "own_use"
        and any(line["variety_id"] == ids["Sir Jack"] for line in body["lines"])
    )


def adjustment_of(method: str, path: str, body: dict[str, Any], ids: dict[str, int]) -> bool:
    return (
        (method, path) == ("POST", "/stock/entries")
        and body["origin"] == "adjustment"
        and body["variety_id"] == ids["24K Gold"]
    )


def jack_line_to_cookies(
    method: str, path: str, body: dict[str, Any], ids: dict[str, int]
) -> Rewrite | None:
    if not own_use_of(method, path, body, ids):
        return None
    lines = [
        {**line, "variety_id": ids["Golden Cookies"]}
        if line["variety_id"] == ids["Sir Jack"]
        else line
        for line in body["lines"]
    ]
    return Rewrite({**body, "lines": lines})


def jack_gram_to_promotion(
    method: str, path: str, body: dict[str, Any], ids: dict[str, int]
) -> Rewrite | None:
    """One rewritten call (the own use loses its Sir Jack line) and one added call (the
    capture day's promotion of Sir Jack's 1 g); the brief's "removed here, added there"."""
    if not own_use_of(method, path, body, ids):
        return None
    lines = [line for line in body["lines"] if line["variety_id"] != ids["Sir Jack"]]
    promotion = {
        "date": body["date"],
        "reason": "promotion",
        "note": None,
        "lines": [{"variety_id": ids["Sir Jack"], "quantity": "1"}],
    }
    return Rewrite({**body, "lines": lines}, [("POST", "/stock/withdrawals", promotion)])


def adjustment_to_cookies(
    method: str, path: str, body: dict[str, Any], ids: dict[str, int]
) -> Rewrite | None:
    if not adjustment_of(method, path, body, ids):
        return None
    return Rewrite({**body, "variety_id": ids["Golden Cookies"]})


def adjustment_of_three(
    method: str, path: str, body: dict[str, Any], ids: dict[str, int]
) -> Rewrite | None:
    if not adjustment_of(method, path, body, ids):
        return None
    return Rewrite({**body, "quantity": "-3"})


@pytest.mark.parametrize(
    "swap",
    [jack_line_to_cookies, jack_gram_to_promotion, adjustment_to_cookies, adjustment_of_three],
    ids=[
        "own-use-jack-line-to-cookies",
        "own-use-jack-gram-to-promotion",
        "adjustment-to-cookies",
        "adjustment-of-three",
    ],
)
def test_moving_a_pending_figure_or_the_shortfall_fails_the_seed_pins(
    client: TestClient, clock: MovableClock, swap: Swap
) -> None:
    day = captured_on(MUESTRA.read_text(encoding="utf-8"))
    clock.set(datetime.combine(day, time(18, 0), tzinfo=UTC))
    api = RewritingApi(client, swap)
    load_script().seed(api, day)

    assert api.rewrites == 1

    with pytest.raises(AssertionError):
        assert_seed_states(client)
