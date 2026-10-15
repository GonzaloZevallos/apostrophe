"""`/onboarding-progress` over HTTP (docs/adr/0036): the Onboarding's one answer, read and
written through the session's own business, over the real owners' adapters."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.onboarding.adapters.tables import OnboardingRow
from tests.conftest import signed_in

STEP_NAMES = ["variety", "stock", "header_footer", "bot", "partner", "categories"]
BOT = {"token": "123456:bot-token", "own_chat": "5551", "channel_chat": "-1001"}


def _states(answer: dict[str, Any]) -> dict[str, str]:
    return {item["step"]: item["state"] for item in answer["steps"]}


def _variety(client: TestClient, name: str = "Lemon Haze") -> int:
    created = client.post("/varieties", json={"name": name})
    assert created.status_code == 201, created.text
    return int(created.json()["id"])


def _price(client: TestClient, variety_id: int, effective_from: str = "2026-10-01") -> int:
    entry = client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": effective_from, "list_price": 11_000},
    )
    assert entry.status_code == 201, entry.text
    return int(entry.json()["id"])


def _stock(client: TestClient, variety_id: int) -> None:
    entry = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "50"},
    )
    assert entry.status_code == 201, entry.text


def _required_steps(client: TestClient) -> tuple[int, int]:
    variety_id = _variety(client)
    entry_id = _price(client, variety_id)
    _stock(client, variety_id)
    return variety_id, entry_id


def _pass(client: TestClient, step: str, as_: str = "done") -> Any:
    return client.post("/onboarding-progress/passes", json={"step": step, "as": as_})


def _save_bot(client: TestClient) -> None:
    tested = client.post("/pinned-catalog/test", json=BOT)
    assert tested.status_code == 200, tested.text


def _add_partner(client: TestClient, anonymous_client: TestClient) -> str:
    issued = client.post("/invitations")
    assert issued.status_code == 201, issued.text
    token = issued.json()["url"].rsplit("/", 1)[-1]
    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"email": "socio@example.com", "password": "correct horse battery staple"},
    )
    assert accepted.status_code == 201, accepted.text
    return str(accepted.json()["token"])


def test_a_new_business_is_offered_the_onboarding_at_its_first_step(client: TestClient) -> None:
    response = client.get("/onboarding-progress")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "offered": True,
        "over": False,
        "count": 0,
        "resume": "variety",
        "steps": [{"step": name, "state": "pending"} for name in STEP_NAMES],
        "can_skip_rest": False,
        "varieties_count": 0,
        "stock_entries_count": 0,
        "price_target": None,
        "priced_target": None,
        "stock_target": None,
    }


def test_a_price_effective_tomorrow_does_not_make_the_variety_step_done(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    _price(client, variety_id, effective_from="2026-10-03")

    answer = client.get("/onboarding-progress").json()

    assert _states(answer)["variety"] == "pending"
    assert answer["resume"] == "variety"
    assert answer["price_target"] == {"id": variety_id, "name": "Lemon Haze"}


def test_a_saved_bot_and_a_second_user_count_without_any_pass_and_two_passes_end_it(
    client: TestClient, anonymous_client: TestClient
) -> None:
    _required_steps(client)
    _save_bot(client)
    _add_partner(client, anonymous_client)

    answer = client.get("/onboarding-progress").json()

    assert answer["count"] == 4
    assert answer["resume"] == "header_footer"
    assert _states(answer)["bot"] == "done"
    assert _states(answer)["partner"] == "done"

    first = _pass(client, "header_footer")
    assert first.status_code == 200, first.text
    assert first.json()["over"] is False
    assert first.json()["resume"] == "categories"

    last = _pass(client, "categories")
    assert last.json()["over"] is True
    assert last.json()["resume"] is None
    assert client.get("/onboarding-progress").json()["over"] is True


def test_a_last_pass_with_no_price_left_does_not_end_it_and_advance_ends_it_once_priced_again(
    client: TestClient,
) -> None:
    variety_id, entry_id = _required_steps(client)
    for step in ("header_footer", "bot", "partner"):
        assert _pass(client, step, "skipped").json()["over"] is False
    assert client.delete(f"/varieties/{variety_id}/prices/{entry_id}").status_code == 204

    last = _pass(client, "categories")

    assert last.status_code == 200, last.text
    assert last.json()["over"] is False
    assert last.json()["resume"] == "variety"
    _price(client, variety_id)
    assert client.get("/onboarding-progress").json()["resume"] == "finish"

    advanced = client.post("/onboarding-progress/advance")

    assert advanced.json()["over"] is True
    assert advanced.json()["resume"] is None


def test_advance_before_everything_is_done_ends_nothing(client: TestClient) -> None:
    _required_steps(client)

    answer = client.post("/onboarding-progress/advance").json()

    assert answer["over"] is False
    assert answer["resume"] == "header_footer"


def test_an_unpriced_variety_is_the_price_target_and_priced_it_becomes_the_stock_target(
    client: TestClient,
) -> None:
    variety_id = _variety(client)

    before = client.get("/onboarding-progress").json()
    assert before["price_target"] == {"id": variety_id, "name": "Lemon Haze"}
    assert before["stock_target"] is None
    assert before["varieties_count"] == 1

    _price(client, variety_id)
    after = client.get("/onboarding-progress").json()

    assert after["price_target"] is None
    assert after["stock_target"] == {"id": variety_id, "name": "Lemon Haze"}
    assert after["varieties_count"] == 1
    assert _states(after)["variety"] == "done"


def test_the_priced_target_is_the_first_priced_variety_in_name_order_and_carries_no_amount(
    client: TestClient,
) -> None:
    zapallo = _variety(client, "Zapallo")
    almendra = _variety(client, "almendra")
    _price(client, zapallo)
    _price(client, almendra)
    nuez = _variety(client, "Nuez")

    answer = client.get("/onboarding-progress").json()

    assert answer["priced_target"] == {"id": almendra, "name": "almendra"}
    assert answer["price_target"] == {"id": nuez, "name": "Nuez"}
    assert "11000" not in str(answer["priced_target"])
    assert set(answer["priced_target"]) == {"id", "name"}


def test_a_partner_session_in_the_same_business_sees_the_same_targets(
    client: TestClient, anonymous_client: TestClient
) -> None:
    priced = _variety(client)
    _price(client, priced)
    unpriced = _variety(client, "Amnesia")
    mine = client.get("/onboarding-progress").json()

    partner = signed_in(anonymous_client, _add_partner(client, anonymous_client))
    theirs = partner.get("/onboarding-progress").json()

    assert theirs["price_target"] == {"id": unpriced, "name": "Amnesia"}
    assert theirs["stock_target"] == {"id": priced, "name": "Lemon Haze"}
    assert {**theirs, "count": 0} == {**mine, "count": 0, "steps": theirs["steps"]}


def test_a_read_issues_no_write(client: TestClient, engine: Engine) -> None:
    statements: list[str] = []

    def record(*args: Any) -> None:
        statements.append(str(args[2]).lstrip().split(None, 1)[0].upper())

    event.listen(engine, "before_cursor_execute", record)
    try:
        assert client.get("/onboarding-progress").status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert statements
    assert {"INSERT", "UPDATE", "DELETE"}.isdisjoint(statements)


def test_a_business_with_no_onboarding_is_not_offered_one_and_every_write_is_404(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        session.execute(delete(OnboardingRow))
        session.commit()

    answer = client.get("/onboarding-progress")

    assert answer.status_code == 200
    assert answer.json()["offered"] is False
    assert answer.json()["resume"] is None
    writes = [
        _pass(client, "header_footer"),
        client.post("/onboarding-progress/skip-rest"),
        client.post("/onboarding-progress/advance"),
    ]
    for write in writes:
        assert write.status_code == 404, write.text
        assert write.json()["code"] == "onboarding.not_found"


@pytest.mark.parametrize(
    ("step", "as_"),
    [
        ("variety", "done"),
        ("stock", "skipped"),
        ("nothing", "done"),
        ("2", "done"),
        ("bot", "later"),
        ("bot", ""),
    ],
)
def test_a_pass_for_a_required_or_unknown_step_or_way_is_refused_and_stores_nothing(
    client: TestClient, step: str, as_: str
) -> None:
    answer = _pass(client, step, as_)

    assert answer.status_code == 422, answer.text
    assert answer.json()["code"] == "onboarding.step_invalid"
    assert client.get("/onboarding-progress").json()["count"] == 0


def test_skip_rest_is_refused_while_a_required_step_is_unmet(client: TestClient) -> None:
    answer = client.post("/onboarding-progress/skip-rest")

    assert answer.status_code == 409, answer.text
    assert answer.json()["code"] == "onboarding.required_steps_unmet"
    assert client.get("/onboarding-progress").json()["count"] == 0


def test_skip_rest_passes_every_remaining_optional_step_and_ends_it(client: TestClient) -> None:
    _required_steps(client)
    assert _pass(client, "header_footer").status_code == 200

    answer = client.post("/onboarding-progress/skip-rest").json()

    assert answer["over"] is True
    assert answer["count"] == 6
    assert _states(answer) == {
        "variety": "done",
        "stock": "done",
        "header_footer": "done",
        "bot": "skipped",
        "partner": "skipped",
        "categories": "skipped",
    }


def test_a_write_on_an_onboarding_that_is_over_stores_nothing(client: TestClient) -> None:
    _required_steps(client)
    ended = client.post("/onboarding-progress/skip-rest").json()
    assert ended["over"] is True

    again = _pass(client, "bot", "done")

    assert again.status_code == 200
    assert again.json() == ended
    assert client.post("/onboarding-progress/skip-rest").json() == ended


def test_the_state_is_the_session_s_business_only(
    client: TestClient, other_client: TestClient
) -> None:
    _required_steps(client)
    assert _pass(client, "bot", "skipped").status_code == 200

    other = other_client.get("/onboarding-progress").json()

    assert other["count"] == 0
    assert other["varieties_count"] == 0
    assert other["price_target"] is None
    assert other["priced_target"] is None
    assert other_client.post("/onboarding-progress/skip-rest").status_code == 409
    assert client.get("/onboarding-progress").json()["count"] == 3
