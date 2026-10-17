"""`GET /first-run` and `POST /first-run/import-notice/dismissal` over HTTP (docs/adr/0046):
the one answer Inicio's first-run elements are drawn from, through the real owners'
adapters. A pre-Onboarding business is one with no `onboarding` row, made here by
deleting it; an imported one has `imported_at`, which only the import writes, so the
tests stamp it through the same `FirstRuns` port the import uses."""

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.adapters.tables import OnboardingRow
from tests.conftest import NOW

BOT = {"token": "123456:bot-token", "own_chat": "5551", "channel_chat": "@canal"}
STEPS = ["priced_variety", "stock_entry", "published", "second_user"]


def _business_id(engine: Engine, name: str = "Primer Negocio") -> int:
    with Session(engine) as session:
        return session.scalars(select(BusinessRow.id).where(BusinessRow.name == name)).one()


def _without_onboarding(engine: Engine) -> None:
    with Session(engine) as session:
        session.execute(delete(OnboardingRow))
        session.commit()


def _imported(engine: Engine, *, onboarding_ended: bool) -> None:
    business_id = _business_id(engine)
    with Session(engine) as session:
        SqlFirstRuns(session, business_id).imported(NOW)
        onboardings = SqlOnboardings(session, business_id)
        onboarding = onboardings.get()
        if onboarding is not None and onboarding_ended:
            onboarding.end(NOW)
            onboardings.save(onboarding)
        session.commit()


def _stamps(engine: Engine) -> dict[str, Any]:
    with Session(engine) as session:
        stored = SqlFirstRuns(session, _business_id(engine)).get()
    assert stored is not None
    return {
        "checklist_gone_at": stored.checklist_gone_at,
        "imported_at": stored.imported_at,
        "import_notice_over_at": stored.import_notice_over_at,
    }


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


def _stock(client: TestClient, variety_id: int, grams: str = "50") -> None:
    entry = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": grams},
    )
    assert entry.status_code == 201, entry.text


def _first_run(client: TestClient) -> dict[str, Any]:
    response = client.get("/first-run")
    assert response.status_code == 200, response.text
    answer: dict[str, Any] = response.json()
    return answer


def _done(answer: dict[str, Any]) -> dict[str, bool]:
    assert answer["checklist"] is not None
    return {item["step"]: item["done"] for item in answer["checklist"]}


def _partner(client: TestClient, anonymous_client: TestClient) -> TestClient:
    issued = client.post("/invitations")
    assert issued.status_code == 201, issued.text
    token = issued.json()["url"].rsplit("/", 1)[-1]
    accepted = anonymous_client.post(
        f"/invitations/{token}/accept",
        json={"email": "socio@example.com", "password": "correct horse battery staple"},
    )
    assert accepted.status_code == 201, accepted.text
    anonymous_client.cookies.clear()
    anonymous_client.headers["Authorization"] = f"Bearer {accepted.json()['token']}"
    return anonymous_client


def _publish(client: TestClient) -> None:
    tested = client.post("/pinned-catalog/test", json=BOT)
    assert tested.status_code == 200, tested.text
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text


def test_a_brand_new_business_gets_the_onboarding_and_nothing_else(client: TestClient) -> None:
    assert _first_run(client) == {
        "kind": "onboarding",
        "checklist": None,
        "import_notice": False,
        "nothing_qualifies": False,
    }


def test_a_business_without_an_onboarding_row_gets_the_four_step_checklist(
    client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)

    answer = _first_run(client)

    assert answer == {
        "kind": "checklist",
        "checklist": [
            {"step": "priced_variety", "required": True, "done": False},
            {"step": "stock_entry", "required": True, "done": False},
            {"step": "published", "required": False, "done": False},
            {"step": "second_user", "required": False, "done": False},
        ],
        "import_notice": False,
        "nothing_qualifies": True,
    }


def test_each_step_is_worked_out_from_the_data_on_every_read(
    client: TestClient, anonymous_client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _stock(client, variety_id)
    _price(client, variety_id, effective_from="2026-10-03")  # tomorrow: not priced today

    assert _done(_first_run(client)) == {
        "priced_variety": False,
        "stock_entry": True,
        "published": False,
        "second_user": False,
    }

    _partner(client, anonymous_client)

    assert _done(_first_run(client))["second_user"] is True
    assert _first_run(client)["nothing_qualifies"] is True


def test_the_checklist_goes_when_both_required_steps_are_met_and_never_returns(
    client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    price_id = _price(client, variety_id)
    _stock(client, variety_id)

    met = _first_run(client)

    assert met["kind"] == "none"
    assert met["checklist"] is None
    assert _stamps(engine)["checklist_gone_at"] == NOW

    assert client.delete(f"/varieties/{variety_id}/prices/{price_id}").status_code == 204
    after = _first_run(client)

    assert after["kind"] == "start_varieties"
    assert after["checklist"] is None


def test_an_imported_business_never_sees_the_checklist_but_sees_the_notice(
    client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    _imported(engine, onboarding_ended=False)

    answer = _first_run(client)

    assert answer["kind"] == "start_varieties"
    assert answer["checklist"] is None
    assert answer["import_notice"] is True
    assert answer["nothing_qualifies"] is False


def test_an_imported_business_with_an_ended_onboarding_sees_the_notice_too(
    client: TestClient, engine: Engine
) -> None:
    _imported(engine, onboarding_ended=True)

    answer = _first_run(client)

    assert answer["kind"] == "start_varieties"
    assert answer["import_notice"] is True


def test_the_import_notice_shows_beside_the_onboarding(client: TestClient, engine: Engine) -> None:
    _imported(engine, onboarding_ended=False)

    answer = _first_run(client)

    assert answer["kind"] == "onboarding"
    assert answer["import_notice"] is True


def test_the_dismissal_ends_the_notice_once_and_is_idempotent(
    client: TestClient, engine: Engine, clock: Any
) -> None:
    _imported(engine, onboarding_ended=True)

    first = client.post("/first-run/import-notice/dismissal")
    stamped = _stamps(engine)["import_notice_over_at"]
    clock.set(NOW.replace(day=NOW.day + 1))
    second = client.post("/first-run/import-notice/dismissal")

    assert first.status_code == 204, first.text
    assert second.status_code == 204, second.text
    assert stamped == NOW
    assert _stamps(engine)["import_notice_over_at"] == NOW
    assert _first_run(client)["import_notice"] is False


def test_a_publicar_ends_the_import_notice_and_stamps_it(
    client: TestClient, engine: Engine
) -> None:
    _imported(engine, onboarding_ended=True)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)
    assert _first_run(client)["import_notice"] is True

    _publish(client)
    answer = _first_run(client)

    assert answer["import_notice"] is False
    assert _stamps(engine)["import_notice_over_at"] == NOW


def test_a_joined_user_reads_the_same_answer_as_the_business(
    client: TestClient, anonymous_client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    partner = _partner(client, anonymous_client)

    assert _first_run(partner) == _first_run(client)
    assert _done(_first_run(partner))["second_user"] is True


def test_the_first_run_of_a_business_is_not_read_by_another(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _imported(engine, onboarding_ended=True)

    assert _first_run(client)["import_notice"] is True
    assert _first_run(other_client)["import_notice"] is False


def test_the_app_wires_the_first_run_routes(app: FastAPI) -> None:
    paths = app.openapi()["paths"]

    assert "get" in paths["/first-run"]
    assert "post" in paths["/first-run/import-notice/dismissal"]
