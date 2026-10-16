"""The sample app's archived variety (GH-131): one archived, hidden variety with stock, a
price entry, a threshold, a sale and an entry, dated so that it never lands in Hoy, Semana
or Mes on any run date, and absent from every live list."""

from datetime import UTC, date, datetime, time, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.shared.calendar import Month, Week
from tests.conftest import MovableClock
from tests.design.test_muestra_seed import MUESTRA, captured_on
from tests.design.test_sample_app import ClientApi, load_script

RUN_DATES = [
    pytest.param(captured_on(MUESTRA.read_text(encoding="utf-8")), id="muestra-date"),
    pytest.param(date(2026, 10, 17), id="17th-of-a-month"),
    pytest.param(date(2026, 11, 1), id="first-of-a-month"),
]


class RecordingApi(ClientApi):
    """The seed's `Api`, remembering the writes it made."""

    def __init__(self, client: TestClient) -> None:
        super().__init__(client)
        self.writes: list[tuple[str, str, object | None]] = []

    def call(self, method: str, path: str, body: object | None = None) -> Any:
        if method != "GET":
            self.writes.append((method, path, body))
        return super().call(method, path, body)


def seed_at(
    client: TestClient, clock: MovableClock, day: date, *, archived: bool = True
) -> RecordingApi:
    clock.set(datetime.combine(day, time(18, 0), tzinfo=UTC))
    api = RecordingApi(client)
    load_script().seed(api, day, with_archived=archived)
    return api


@pytest.mark.parametrize("day", RUN_DATES)
def test_exactly_one_archived_hidden_variety_with_its_records(
    client: TestClient, clock: MovableClock, day: date
) -> None:
    api = seed_at(client, clock, day)

    archived = client.get("/varieties?archived=true").json()
    assert len(archived) == 1
    variety_id = archived[0]["id"]
    # No stored route says a variety is hidden once it is archived, so the seed's own write
    # is what is checked: it hid the variety from the catalog before archiving it.
    hidden = [b for m, p, b in api.writes if (m, p) == ("PUT", f"/catalog/varieties/{variety_id}")]
    assert [b["shown"] for b in hidden if isinstance(b, dict)] == [False]

    row = next(
        r
        for r in client.get("/stock?archived=true").json()["varieties"]
        if r["variety_id"] == variety_id
    )
    assert row["grams"] > 0
    assert row["threshold"] is not None
    assert client.get(f"/varieties/{variety_id}/prices").json()

    movements = client.get(f"/stock/varieties/{variety_id}/movements").json()
    assert any(m["kind"] == "entry" for m in movements)

    sales = [
        s
        for s in client.get("/sales").json()
        if any(line["variety_id"] == variety_id for line in s["lines"])
    ]
    assert len(sales) == 1
    sale = client.get(f"/sales/{sales[0]['id']}").json()
    sold = date.fromisoformat(sale["date"])
    assert sold < Week.containing(day).first_day
    assert sold < Month.containing(day).first_day
    assert sold >= day - timedelta(days=40)
    line = next(ln for ln in sale["lines"] if ln["variety_id"] == variety_id)
    assert line["cost"]["pending_grams"] == 0


@pytest.mark.parametrize("day", RUN_DATES)
def test_the_archived_variety_is_in_no_live_list(
    client: TestClient, clock: MovableClock, day: date
) -> None:
    seed_at(client, clock, day)
    variety_id = client.get("/varieties?archived=true").json()[0]["id"]

    assert variety_id not in [v["id"] for v in client.get("/varieties").json()]
    assert variety_id not in [r["variety_id"] for r in client.get("/stock").json()["varieties"]]
    assert variety_id not in [r["id"] for r in client.get("/catalog").json()["varieties"]]
    assert variety_id not in [r["variety_id"] for r in client.get("/panel").json()["stock"]]


@pytest.mark.parametrize("day", RUN_DATES)
def test_the_archived_variety_changes_no_current_period_figure(
    client: TestClient, other_client: TestClient, clock: MovableClock, day: date
) -> None:
    seed_at(client, clock, day, archived=True)
    seed_at(other_client, clock, day, archived=False)

    with_it = client.get("/panel").json()["periods"]
    without = other_client.get("/panel").json()["periods"]
    for name in ("today", "week", "month"):
        assert with_it[name] == without[name], name
