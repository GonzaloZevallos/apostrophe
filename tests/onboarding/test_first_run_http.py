"""`GET /first-run` and `POST /first-run/import-notice/dismissal` over HTTP (docs/adr/0046):
the one answer Inicio's first-run elements are drawn from, through the real owners'
adapters. A pre-Onboarding business is one with no `onboarding` row, made here by
deleting it; an imported one has `imported_at`, which only the import writes, so the
tests stamp it through the same `FirstRuns` port the import uses."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.onboarding.adapters.sql_first_runs import SqlFirstRuns
from app.onboarding.adapters.sql_onboardings import SqlOnboardings
from app.onboarding.adapters.tables import OnboardingRow
from app.onboarding.application.ports import CatalogFacts
from app.onboarding.domain.first_run import Stamp
from tests.conftest import NOW, TODAY
from tests.contract_shapes import assert_matches_fixture
from tests.statement_log import captured_statements

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
    assert answer["checklist"] != []
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
        "checklist": [],
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
    assert met["checklist"] == []
    assert _stamps(engine)["checklist_gone_at"] == NOW

    assert client.delete(f"/varieties/{variety_id}/prices/{price_id}").status_code == 204
    after = _first_run(client)

    assert after["kind"] == "start_varieties"
    assert after["checklist"] == []


def test_an_imported_business_never_sees_the_checklist_but_sees_the_notice(
    client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    _imported(engine, onboarding_ended=False)

    answer = _first_run(client)

    assert answer["kind"] == "start_varieties"
    assert answer["checklist"] == []
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


def test_the_answers_match_the_fixture_the_front_is_built_from(
    client: TestClient, engine: Engine
) -> None:
    assert_matches_fixture(_first_run(client), "firstRun")  # onboarding: no checklist
    _without_onboarding(engine)
    assert_matches_fixture(_first_run(client), "firstRun")  # the checklist
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)
    assert_matches_fixture(_first_run(client), "firstRun")  # none


def test_the_app_wires_the_first_run_routes(app: FastAPI) -> None:
    paths = app.openapi()["paths"]

    assert "get" in paths["/first-run"]
    assert "post" in paths["/first-run/import-notice/dismissal"]


# -- reads and writes ------------------------------------------------------------------


def _dml(statements: list[tuple[str, object]]) -> list[str]:
    return [
        statement
        for statement, _ in statements
        if statement.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]


def _small_checklist(client: TestClient) -> None:
    """A pre-Onboarding business whose checklist shows: one variety whose price takes
    effect tomorrow, one stock entry."""
    variety_id = _variety(client, "Chica")
    _price(client, variety_id, effective_from="2026-10-03")
    _stock(client, variety_id)


def _year_checklist(client: TestClient) -> None:
    """The same quiet state over many rows: many varieties, each with a run of price
    entries that all take effect after today, and many stock entries, so no variety is
    priced today, the checklist still shows and the catalog qualification pass runs over
    all of it."""
    for index in range(8):
        variety_id = _variety(client, f"Variedad {index}")
        for day in range(3, 28):
            _price(client, variety_id, effective_from=f"2026-11-{day:02d}")
        for _ in range(9):
            _stock(client, variety_id, grams="100")


def _statement_count(engine: Engine, client: TestClient) -> int:
    with captured_statements(engine) as statements:
        assert client.get("/first-run").status_code == 200
    return len(statements)


def test_a_quiet_read_issues_no_insert_update_or_delete(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    _small_checklist(client)

    with captured_statements(engine) as statements:
        answer = _first_run(client)

    assert answer["kind"] == "checklist"
    assert _dml(statements) == []


def test_a_quiet_read_costs_the_same_statements_on_a_small_business_and_a_seeded_year(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        session.execute(delete(OnboardingRow))
        session.commit()
    _small_checklist(client)
    _year_checklist(other_client)

    small = _statement_count(engine, client)
    year = _statement_count(engine, other_client)

    assert _first_run(client)["kind"] == "checklist"
    assert _first_run(other_client)["kind"] == "checklist"
    assert small == year, (small, year)


def test_a_quiet_read_of_a_new_business_costs_the_same_small_or_seeded(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _small_checklist(client)
    _year_checklist(other_client)

    assert _statement_count(engine, client) == _statement_count(engine, other_client)


def test_the_stamping_read_costs_exactly_one_insert_and_one_update_more_than_a_quiet_one(
    client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)

    with captured_statements(engine) as stamping:
        _first_run(client)
    with captured_statements(engine) as quiet:
        _first_run(client)

    assert [statement.split()[0] for statement in _dml(stamping)] == ["INSERT", "UPDATE"]
    assert _dml(quiet) == []
    assert len(stamping) - len(quiet) == 2


def test_a_dismissal_for_a_business_that_was_not_imported_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    with captured_statements(engine) as statements:
        response = client.post("/first-run/import-notice/dismissal")

    assert response.status_code == 204, response.text
    assert _dml(statements) == []


def test_a_stamp_that_the_database_cannot_take_never_changes_the_answer(
    client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)
    expected = {
        "kind": "none",
        "checklist": [],
        "import_notice": False,
        "nothing_qualifies": False,
    }

    def locked(self: SqlFirstRuns, column: Stamp, at: datetime) -> None:
        raise OperationalError("UPDATE first_run", {}, Exception("database is locked"))

    monkeypatch.setattr(SqlFirstRuns, "stamp", locked)
    response = client.get("/first-run")

    assert response.status_code == 200, response.text
    assert response.json() == expected
    monkeypatch.undo()
    with Session(engine) as session:
        assert SqlFirstRuns(session, _business_id(engine)).get() is None
    assert client.get("/first-run").json() == expected
    assert _stamps(engine)["checklist_gone_at"] == NOW


def test_the_guard_logs_the_exception_class_only(
    client: TestClient,
    engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client, "Nombre Secreto")
    _price(client, variety_id)
    _stock(client, variety_id)

    def locked(self: SqlFirstRuns, column: Stamp, at: datetime) -> None:
        raise OperationalError("UPDATE first_run", {}, Exception("secreto 11000"))

    monkeypatch.setattr(SqlFirstRuns, "stamp", locked)
    with caplog.at_level(logging.WARNING, logger="apostrophe.onboarding"):
        client.get("/first-run")

    assert [record.getMessage() for record in caplog.records] == [
        "first run stamp failed: OperationalError"
    ]


def test_any_other_failure_of_the_stamp_is_not_swallowed(
    client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)

    def broken(self: SqlFirstRuns, column: Stamp, at: datetime) -> None:
        raise RuntimeError("not a locked database")

    monkeypatch.setattr(SqlFirstRuns, "stamp", broken)

    with pytest.raises(RuntimeError, match="not a locked database"):
        client.get("/first-run")


# -- nothing_qualifies agrees with the catalog -----------------------------------------


def _agrees(app: FastAPI, client: TestClient, engine: Engine) -> bool:
    """`any_qualifies` through the port the Onboarding reads it by, against `GET /catalog`:
    it holds exactly when the catalog answers no text."""
    with Session(engine) as session:
        facts: CatalogFacts = app.state.onboarding_catalog_facts(
            session, _business_id(engine), TODAY
        )
        qualifies = facts.any_qualifies()
    text = client.get("/catalog").json()["text"]
    return bool(qualifies == (text is not None))


def test_nothing_qualifies_agrees_with_the_catalog_text_over_every_reason_not_to_qualify(
    app: FastAPI, client: TestClient, engine: Engine
) -> None:
    _without_onboarding(engine)
    unpriced = _variety(client, "Sin precio")
    assert unpriced > 0
    assert _agrees(app, client, engine)

    hidden = _variety(client, "Oculta")
    _price(client, hidden)
    hid = client.put(
        f"/catalog/varieties/{hidden}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert hid.status_code == 200, hid.text
    never_stocked = _variety(client, "Sin stock")
    _price(client, never_stocked)
    assert _agrees(app, client, engine)
    assert _first_run(client)["nothing_qualifies"] is True

    sold_out = _variety(client, "Agotada")
    _price(client, sold_out)
    _stock(client, sold_out, grams="10")
    sold = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": sold_out, "grams": "10"}]}
    )
    assert sold.status_code == 201, sold.text
    assert client.get("/catalog").json()["text"] is None
    assert _agrees(app, client, engine)

    qualifying = _variety(client, "Buena")
    _price(client, qualifying)
    _stock(client, qualifying)
    assert client.get("/catalog").json()["text"] is not None
    assert _agrees(app, client, engine)


# -- the whole answer agrees with its sources and with GET /catalog ----------------------


def _build_no_variety(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    _variety(client, "Sin precio")


def _build_priced_without_stock(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    _price(client, _variety(client))


def _build_stock_without_price(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    _stock(client, _variety(client))


def _build_sold_out(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id, grams="10")
    sold = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]}
    )
    assert sold.status_code == 201, sold.text


def _build_qualifying(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)


def _build_checklist_gone_then_price_deleted(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    variety_id = _variety(client)
    price_id = _price(client, variety_id)
    _stock(client, variety_id)
    assert _first_run(client)["kind"] == "none"  # this read stamps `checklist_gone_at`
    assert client.delete(f"/varieties/{variety_id}/prices/{price_id}").status_code == 204


def _build_open_onboarding(client: TestClient, engine: Engine) -> None:
    """The business `accept_invitation` made, left as it is."""


def _build_imported_notice_showing(client: TestClient, engine: Engine) -> None:
    _without_onboarding(engine)
    _imported(engine, onboarding_ended=False)


def _build_imported_notice_dismissed(client: TestClient, engine: Engine) -> None:
    _build_imported_notice_showing(client, engine)
    assert client.post("/first-run/import-notice/dismissal").status_code == 204


def _build_imported_notice_ended_by_publishing(client: TestClient, engine: Engine) -> None:
    _imported(engine, onboarding_ended=True)
    variety_id = _variety(client)
    _price(client, variety_id)
    _stock(client, variety_id)
    _publish(client)


@dataclass(frozen=True)
class State:
    name: str
    build: Callable[[TestClient, Engine], None]
    kind: str
    catalog_has_text: bool
    import_notice: bool
    done: tuple[bool, bool] = (False, False)  # priced_variety, stock_entry (checklist only)


STATES = (
    State("no_variety", _build_no_variety, "checklist", False, False),
    State(
        "priced_without_stock",
        _build_priced_without_stock,
        "checklist",
        False,
        False,
        (True, False),
    ),
    State(
        "stock_without_price", _build_stock_without_price, "checklist", False, False, (False, True)
    ),
    State("sold_out", _build_sold_out, "none", False, False),
    State("qualifying", _build_qualifying, "none", True, False),
    State(
        "checklist_gone_then_price_deleted",
        _build_checklist_gone_then_price_deleted,
        "start_varieties",
        False,
        False,
    ),
    State("open_onboarding", _build_open_onboarding, "onboarding", False, False),
    State(
        "imported_notice_showing", _build_imported_notice_showing, "start_varieties", False, True
    ),
    State(
        "imported_notice_dismissed",
        _build_imported_notice_dismissed,
        "start_varieties",
        False,
        False,
    ),
    State(
        "imported_notice_ended_by_publishing",
        _build_imported_notice_ended_by_publishing,
        "none",
        True,
        False,
    ),
)


def _nothing_qualifies(state: State) -> bool:
    return state.kind == "checklist" and not state.catalog_has_text


@pytest.mark.parametrize("state", STATES, ids=[state.name for state in STATES])
def test_first_run_agrees_with_its_sources(
    state: State, client: TestClient, engine: Engine
) -> None:
    state.build(client, engine)

    answer = _first_run(client)
    catalog_text = client.get("/catalog").json()["text"]
    progress = client.get("/onboarding-progress").json()
    with Session(engine) as session:
        stored = SqlFirstRuns(session, _business_id(engine)).get()
    imported = stored is not None and stored.imported_at is not None
    notice_over = stored is not None and stored.import_notice_over_at is not None
    gone = stored is not None and stored.checklist_gone_at is not None

    # the flag, read from /first-run itself, against the catalog the seller sees
    assert answer["nothing_qualifies"] is (answer["kind"] == "checklist" and catalog_text is None)
    assert (catalog_text is not None) is state.catalog_has_text
    assert answer["nothing_qualifies"] is _nothing_qualifies(state)

    # the kind, against the Onboarding's own answer and the first-run stamps
    assert answer["kind"] == state.kind
    assert (answer["kind"] == "onboarding") is (progress["offered"] and not progress["over"])
    if answer["kind"] == "checklist":
        assert not progress["offered"] and not progress["over"]
        assert not imported
        assert not gone

    # the notice, against the import fact and its end (a dismissal or a publication)
    assert answer["import_notice"] is (imported and not notice_over)
    assert answer["import_notice"] is state.import_notice

    # the checklist shows only for its own kind, and then holds the four steps in order
    if answer["kind"] != "checklist":
        assert answer["checklist"] == []
    else:
        assert [item["step"] for item in answer["checklist"]] == STEPS
        assert [item["required"] for item in answer["checklist"]] == [True, True, False, False]
        assert [item["done"] for item in answer["checklist"]] == [*state.done, False, False]


def test_the_agreement_table_reaches_every_value_it_must() -> None:
    assert {_nothing_qualifies(state) for state in STATES} == {True, False}
    assert {state.catalog_has_text for state in STATES} == {True, False}
    assert {"onboarding", "checklist", "start_varieties", "none"} <= {s.kind for s in STATES}
    assert any(state.import_notice for state in STATES)
    assert len({state.name for state in STATES}) == len(STATES)
