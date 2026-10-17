"""`GET /panel`'s `setup` block and `POST /panel/bot-notice/dismissal` read back
through it (CODING_STANDARDS section 5: behaviour test, `TestClient`, real adapters,
the movable clock). Seams: `GET /panel` and the dismissal route; the stored facts are
read from the table only to prove they are written once, with the injected clock.

Covers: the step matrix (price today or not, one stock entry of each origin, Publicar
against Probarlo, one user, two, a pending join link), the checklist going and staying
gone, the bot notice's four conditions, one partner's dismissal hiding it for the
other, and `periods.today` carrying only four keys.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.results.adapters.tables import InicioSetupStateRow
from tests.conftest import NOW, PASSWORD, MovableClock, signed_in
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
OTHER_TOKEN = "987654321:a-different-bot-token"
STEPS = ["priced_variety", "stock_entry", "bot_published", "partner"]


def _variety(client: TestClient, name: str = "Criolla") -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _price(client: TestClient, variety_id: int, effective_from: str = "2020-01-01") -> int:
    priced = client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": effective_from, "list_price": 10_000},
    )
    assert priced.status_code == 201, priced.text
    return int(priced.json()["id"])


def _entry(client: TestClient, variety_id: int, origin: str = "opening_stock") -> int:
    body: dict[str, Any] = {
        "variety_id": variety_id,
        "origin": origin,
        "grams": "10",
        "date": "2026-10-01",
    }
    if origin == "purchase":
        body["total_cost"] = 1_000
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _sale(client: TestClient, variety_id: int) -> None:
    response = client.post(
        "/sales",
        json={
            "date": "2026-10-02",
            "payment": "cash",
            "lines": [{"variety_id": variety_id, "grams": "1", "gift": False}],
        },
    )
    assert response.status_code == 201, response.text


def _setup(client: TestClient) -> dict[str, Any]:
    answer = client.get("/panel")
    assert answer.status_code == 200, answer.text
    setup: dict[str, Any] = answer.json()["setup"]
    return setup


def _done(setup: dict[str, Any]) -> dict[str, bool]:
    return {step["step"]: step["done"] for step in setup["checklist"]["steps"]}


def _connect_bot(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )


def _publish(client: TestClient) -> None:
    _connect_bot(client)
    assert client.post("/pinned-catalog/publish").status_code == 200


def _set_up(client: TestClient) -> int:
    variety_id = _variety(client)
    _price(client, variety_id)
    _entry(client, variety_id)
    return variety_id


def _stored(engine: Engine) -> list[tuple[int, datetime | None, datetime | None]]:
    with Session(engine) as session:
        return [
            (row.business_id, row.checklist_gone_at, row.bot_notice_dismissed_at)
            for row in session.scalars(
                select(InicioSetupStateRow).order_by(InicioSetupStateRow.business_id)
            )
        ]


def test_a_new_business_sees_the_four_steps_in_order_none_done(client: TestClient) -> None:
    setup = _setup(client)

    assert setup["checklist"]["steps"] == [
        {"step": "priced_variety", "done": False, "required": True},
        {"step": "stock_entry", "done": False, "required": True},
        {"step": "bot_published", "done": False, "required": False},
        {"step": "partner", "done": False, "required": False},
    ]
    assert setup["priced_today"] is False
    assert setup["bot_notice"] is False


def test_today_carries_only_period_sales_count_and_grams_sold(client: TestClient) -> None:
    today = client.get("/panel").json()["periods"]["today"]

    assert sorted(today) == ["end", "grams_sold", "sales", "sales_count", "start"]


def test_a_priced_variety_with_stock_and_a_sale_ends_the_checklist_and_shows_the_notice(
    client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    _sale_ready = _set_up(client)
    _sale(client, _sale_ready)

    first = _setup(client)
    assert first == {"checklist": None, "priced_today": True, "bot_notice": True}
    [(_, gone_at, dismissed_at)] = _stored(engine)
    assert gone_at == NOW.astimezone(UTC)
    assert dismissed_at is None

    clock.set(NOW + timedelta(days=4))
    assert _setup(client) == first
    assert _stored(engine)[0][1] == NOW.astimezone(UTC)


def test_an_unchanged_business_writes_nothing_while_the_checklist_shows(
    client: TestClient, engine: Engine
) -> None:
    _variety(client)

    _setup(client)

    assert _stored(engine) == []


def test_a_price_dated_after_today_does_not_complete_step_one(client: TestClient) -> None:
    variety_id = _variety(client)
    _price(client, variety_id, effective_from="2026-12-01")

    setup = _setup(client)

    assert _done(setup)["priced_variety"] is False
    assert setup["priced_today"] is False


def test_a_price_dated_today_completes_step_one_and_priced_today(client: TestClient) -> None:
    variety_id = _variety(client)
    _price(client, variety_id, effective_from="2026-10-02")

    setup = _setup(client)

    assert _done(setup)["priced_variety"] is True
    assert setup["priced_today"] is True


@pytest.mark.parametrize("origin", ["opening_stock", "purchase", "harvest", "adjustment"])
def test_one_stock_entry_of_any_origin_completes_the_stock_step(
    client: TestClient, origin: str
) -> None:
    _entry(client, _variety(client), origin)

    assert _done(_setup(client))["stock_entry"] is True


def test_stock_with_no_price_shows_the_checklist_with_the_stock_step_done(
    client: TestClient,
) -> None:
    _entry(client, _variety(client))

    setup = _setup(client)

    assert _done(setup) == {
        "priced_variety": False,
        "stock_entry": True,
        "bot_published": False,
        "partner": False,
    }


def test_probarlo_alone_does_not_complete_the_bot_step_and_publicar_does(
    client: TestClient,
) -> None:
    _connect_bot(client)
    assert _done(_setup(client))["bot_published"] is False

    assert client.post("/pinned-catalog/publish").status_code == 200

    assert _done(_setup(client))["bot_published"] is True


def test_the_partner_step_needs_a_second_user_not_a_pending_link(
    client: TestClient, anonymous_client: TestClient
) -> None:
    issued = client.post("/invitations")
    assert _done(_setup(client))["partner"] is False

    token = issued.json()["url"].rsplit("/", 1)[-1]
    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"business_name": "Ignored", "email": "socio@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text

    assert _done(_setup(client))["partner"] is True


def test_the_checklist_stays_gone_after_the_price_is_deleted(client: TestClient) -> None:
    variety_id = _set_up(client)
    price_id = int(client.get(f"/varieties/{variety_id}/prices").json()[0]["id"])
    assert _setup(client)["checklist"] is None

    deleted = client.delete(f"/varieties/{variety_id}/prices/{price_id}")
    assert deleted.status_code == 204

    setup = _setup(client)
    assert setup["checklist"] is None
    assert setup["priced_today"] is False


def test_the_notice_needs_a_sale_or_a_stock_entry(client: TestClient) -> None:
    # Gone through stock and price, so the entry alone qualifies; a business gone with
    # nothing else cannot exist, which is why the stock entry is the one condition here.
    _set_up(client)

    assert _setup(client)["bot_notice"] is True


def test_the_notice_goes_on_the_first_publish(client: TestClient) -> None:
    _set_up(client)
    assert _setup(client)["bot_notice"] is True

    _publish(client)

    assert _setup(client)["bot_notice"] is False


def test_the_notice_never_shows_with_the_checklist(client: TestClient) -> None:
    variety_id = _set_up(client)
    _sale(client, variety_id)
    price_id = int(client.get(f"/varieties/{variety_id}/prices").json()[0]["id"])
    client.delete(f"/varieties/{variety_id}/prices/{price_id}")

    setup = _setup(client)

    assert setup["checklist"] is not None
    assert setup["bot_notice"] is False


def test_dismissing_hides_the_notice_for_a_partner_too(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _set_up(client)
    token = client.post("/invitations").json()["url"].rsplit("/", 1)[-1]
    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"business_name": "Ignored", "email": "socio@example.com", "password": PASSWORD},
    )
    partner = signed_in(anonymous_client, accepted.json()["token"])
    assert _setup(partner)["bot_notice"] is True

    assert client.post("/panel/bot-notice/dismissal").status_code == 204

    assert _setup(partner)["bot_notice"] is False


def test_the_checklist_state_is_per_business(client: TestClient, other_client: TestClient) -> None:
    _set_up(client)
    assert _setup(client)["checklist"] is None

    other = _setup(other_client)

    assert other["priced_today"] is False
    assert other["bot_notice"] is False
    assert _done(other) == dict.fromkeys(STEPS, False)


def test_a_published_catalog_stays_published_after_a_token_and_a_channel_change(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _set_up(client)
    _publish(client)

    for settings in (
        {"token": OTHER_TOKEN, "own_chat": "111", "channel_chat": "@canal"},
        {"token": OTHER_TOKEN, "own_chat": "111", "channel_chat": "@otro-canal"},
    ):
        changed = client.post("/pinned-catalog/test", json=settings)
        assert changed.status_code == 200, changed.text

    setup = _setup(client)
    assert setup["bot_notice"] is False
    assert setup["checklist"] is None


def test_a_published_catalog_counts_on_the_checklist_after_a_settings_change(
    client: TestClient,
) -> None:
    _publish(client)
    client.post(
        "/pinned-catalog/test",
        json={"token": OTHER_TOKEN, "own_chat": "111", "channel_chat": "@otro-canal"},
    )

    assert _done(_setup(client))["bot_published"] is True


def _statements(client: TestClient, engine: Engine) -> int:
    count = 0

    def counting(*_: object) -> None:
        nonlocal count
        count += 1

    event.listen(engine, "before_cursor_execute", counting)
    try:
        assert client.get("/panel").status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", counting)
    return count


def test_the_panel_asks_the_same_number_of_statements_whatever_the_history(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _sale(client, _set_up(client))
    _statements(client, engine)  # marks "gone", the one write of a business's life
    small = _statements(client, engine)

    variety_id = _set_up(other_client)
    for _ in range(12):
        _sale(other_client, variety_id)
    _statements(other_client, engine)
    year = _statements(other_client, engine)

    assert year == small
