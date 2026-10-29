"""The sample app's data (agentic-system ADR-0040): seeded through the API alone, never
through the front it exists to compare, so a redesigned screen cannot break it. Every
state the design's screens show has to exist after seeding."""

import importlib.util
import json
import os
import sqlite3
import sys
import threading
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from types import ModuleType
from typing import Any

import openpyxl
import pytest
import uvicorn
from fastapi.testclient import TestClient

from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import NOW, PASSWORD, TEST_HASHER, TODAY, MovableClock
from tests.fakes.telegram import FakeTelegram

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "design" / "sample_app.py"


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sample_app", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Registered first: a dataclass resolves its annotations through `sys.modules`.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ClientApi:
    """The seed's `Api` over a signed-in TestClient."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def call(self, method: str, path: str, body: object | None = None) -> Any:
        response = self.client.request(method, path, json=body)
        assert response.is_success, f"{method} {path}: {response.status_code} {response.text}"
        return response.json() if response.content else None


def test_the_sample_business_has_every_state_the_design_shows(client: TestClient) -> None:
    sample = load_script().seed(ClientApi(client), TODAY)

    debtors = client.get("/payments/debtors").json()
    names = {d["customer"]["name"] for d in debtors["debtors"]}
    assert {"Nico Parra", "Tincho Aguirre"} <= names

    week = client.get("/panel").json()["periods"]["week"]
    assert week["sales_count"] >= 3
    assert week["quantity_gifted"] > 0
    assert week["expenses"] > 0
    assert week["purchases"] > 0

    owing = client.get(f"/sales/{sample.owing_sale}").json()
    assert owing["still_owing"] is True
    assert owing["customer"]["name"] == "Nico Parra"
    assert client.get(f"/customers/{sample.debtor}").json()["name"] == "Nico Parra"

    stock = {row["product_id"]: row["status"] for row in client.get("/stock").json()["products"]}
    assert stock[sample.sold_out] == "sold_out"
    assert stock[sample.low] == "low"
    assert stock[sample.no_entries] == "no_entries"

    # Stock withdrawals: both reasons this week and month, one with pending cost, on the
    # variety the comparisons open, which stays under its threshold.
    periods = client.get("/panel").json()["periods"]
    for name in ("week", "month"):
        assert periods[name]["promotion"] is not None
        assert periods[name]["own_use"] is not None
    assert periods["week"]["promotion"]["pending"] is False
    assert periods["week"]["own_use"]["pending"] is True
    assert client.get(f"/stock/withdrawals/{sample.withdrawal}").json()["reason"] == "promotion"
    movements = client.get(f"/stock/products/{sample.low}/movements").json()
    assert len(movements) > 3
    assert {m["reason"] for m in movements if m["kind"] == "withdrawal"} == {
        "promotion",
        "own_use",
    }
    analysis = client.get("/analysis").json()
    assert analysis["since_first_record"]["promotion"] is not None
    assert analysis["since_first_record"]["own_use"]["pending_quantity"] > 0

    expenses = client.get("/expenses").json()
    assert expenses["total"] > 0
    assert len(expenses["categories"]) >= 2


def test_reset_token_opens_a_live_reset_link(tmp_path: Path) -> None:
    # The token the comparisons use is minted by the real operator command against the
    # sample's own database, then must open a link the app answers 204 for.
    sample_app = load_script()
    url = f"sqlite:///{tmp_path / 'sample.db'}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("APOSTROPHE_")},
        "APOSTROPHE_SECRET_KEY": "sample-secret",
        "APOSTROPHE_DATABASE_URL": url,
        "APOSTROPHE_PUBLIC_URL": "http://127.0.0.1:9",
    }
    invite = sample_app.new_business_token(env)
    app = create_app(
        Settings("sample-secret", url),
        engine=make_engine(url),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
        clock=MovableClock(NOW),
    )
    with TestClient(app) as web:
        accepted = web.post(
            f"/invitations/{invite}/accept",
            json={"email": sample_app.EMAIL, "password": PASSWORD, "business_name": "La Huerta"},
        )
        assert accepted.status_code == 201

        token = sample_app.reset_token(env, sample_app.EMAIL)

        assert web.get(f"/reset-links/{token}").status_code == 204


@contextmanager
def running_sample(tmp_path: Path) -> Iterator[tuple[ModuleType, dict[str, str], str]]:
    """The sample app's own arrangement in miniature: a real server on a real port over a
    database file, and the env the operator CLI needs to mint invitations against it."""
    sample_app = load_script()
    url = f"sqlite:///{tmp_path / 'sample.db'}"
    port = sample_app.free_port()
    base = f"http://127.0.0.1:{port}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("APOSTROPHE_")},
        "APOSTROPHE_SECRET_KEY": "sample-secret",
        "APOSTROPHE_DATABASE_URL": url,
        "APOSTROPHE_PUBLIC_URL": base,
    }
    app = create_app(
        Settings("sample-secret", url),
        engine=make_engine(url),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        clock=MovableClock(NOW),
        upkeep_ticker=False,
    )
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        while not server.started:
            assert thread.is_alive(), "the test server stopped before it started"
            time.sleep(0.05)
        yield sample_app, env, base
    finally:
        server.should_exit = True
        thread.join(timeout=10)


def sign_in(sample_app: ModuleType, base: str, email: str, password: str) -> Any:
    api = sample_app.HttpApi(base)
    api.call("POST", "/auth/login", {"email": email, "password": password})
    return api


def test_onboarding_accounts_are_isolated_businesses_still_in_onboarding(tmp_path: Path) -> None:
    with running_sample(tmp_path) as (sample_app, env, base):
        # La Huerta, as `main()` opens it, seeded and with its own onboarding open.
        token = sample_app.new_business_token(env)
        huerta = sample_app.HttpApi(base)
        huerta.call(
            "POST",
            f"/invitations/{token}/accept",
            {
                "email": sample_app.EMAIL,
                "password": sample_app.PASSWORD,
                "business_name": sample_app.BUSINESS,
            },
        )
        huerta.call(
            "POST", "/auth/login", {"email": sample_app.EMAIL, "password": sample_app.PASSWORD}
        )
        sample_app.seed(huerta, TODAY)
        huerta_customers = {c["id"] for c in huerta.call("GET", "/customers")}

        accounts = sample_app.onboarding_accounts(env, base, TODAY)

        assert set(accounts) == set(sample_app.ONBOARDING_ACCOUNTS)
        assert len(accounts) >= 2
        optional_steps = {"bot", "partner", "categories", "header_footer"}
        apis = {
            name: sign_in(sample_app, base, account.email, account.password)
            for name, account in accounts.items()
        }
        for name, account in accounts.items():
            api = apis[name]
            progress = api.call("GET", "/onboarding-progress")
            assert progress["offered"] is True
            assert progress["over"] is False
            assert progress["resume"] in optional_steps
            assert api.call("GET", "/auth/me")["email"] == account.email
            mine = {c["id"] for c in api.call("GET", "/customers")}
            assert mine
            assert mine.isdisjoint(huerta_customers)

        # Ending one account's Onboarding leaves La Huerta's and the other account's open.
        first, *others = list(apis)
        assert apis[first].call("POST", "/onboarding-progress/skip-rest")["over"] is True
        assert apis[first].call("GET", "/onboarding-progress")["over"] is True
        for other in others:
            assert apis[other].call("GET", "/onboarding-progress")["over"] is False
        assert huerta.call("GET", "/onboarding-progress")["over"] is False


def test_a_business_opened_as_an_ended_account_has_its_onboarding_over_beside_la_huerta(
    tmp_path: Path,
) -> None:
    with running_sample(tmp_path) as (sample_app, env, base):
        huerta = sample_app.HttpApi(base)
        huerta.call(
            "POST",
            f"/invitations/{sample_app.new_business_token(env)}/accept",
            {
                "email": sample_app.EMAIL,
                "password": sample_app.PASSWORD,
                "business_name": sample_app.BUSINESS,
            },
        )
        huerta.call(
            "POST", "/auth/login", {"email": sample_app.EMAIL, "password": sample_app.PASSWORD}
        )
        sample_app.seed(huerta, TODAY)

        def accept_invitation(api: Any) -> Any:
            account = sample_app.Account(email="ended@lahuerta.com", password=sample_app.PASSWORD)
            api.call(
                "POST",
                f"/invitations/{sample_app.new_business_token(env)}/accept",
                {
                    "email": account.email,
                    "password": account.password,
                    "business_name": sample_app.BUSINESS,
                },
            )
            return account

        account = sample_app.open_ended_account(sample_app.HttpApi(base), accept_invitation, TODAY)

        ended = sign_in(sample_app, base, account.email, account.password)
        assert ended.call("GET", "/onboarding-progress")["over"] is True
        first_run = ended.call("GET", "/first-run")
        assert first_run["kind"] == "none"
        assert first_run["import_notice"] is False
        assert ended.call("GET", "/api/products")

        progress = huerta.call("GET", "/onboarding-progress")
        assert progress["over"] is False
        assert progress["count"] == 2
        assert len(progress["steps"]) == 6


def test_end_onboarding_refuses_an_onboarding_the_app_leaves_open() -> None:
    sample_app = load_script()

    class StillOpen:
        def call(self, method: str, path: str, body: object | None = None) -> Any:
            return {"over": False}

    with pytest.raises(SystemExit) as refused:
        sample_app.end_onboarding(StillOpen())

    assert str(refused.value) == "sample-app: the Onboarding did not end"


def test_end_onboarding_refuses_a_business_that_still_shows_a_first_run_element() -> None:
    sample_app = load_script()

    class ShowsChecklist:
        def call(self, method: str, path: str, body: object | None = None) -> Any:
            if path == "/first-run":
                return {"kind": "checklist", "import_notice": False}
            return {"over": True}

    with pytest.raises(SystemExit) as refused:
        sample_app.end_onboarding(ShowsChecklist())

    assert str(refused.value) == "sample-app: the ended account still shows a first-run element"


def test_the_ended_and_the_onboarding_accounts_share_no_name() -> None:
    sample_app = load_script()

    assert sample_app.ENDED_ONBOARDING_ACCOUNTS
    assert set(sample_app.ENDED_ONBOARDING_ACCOUNTS).isdisjoint(sample_app.ONBOARDING_ACCOUNTS)


COUNT_ROWS = {
    "onboarding": "SELECT COUNT(*) FROM onboarding WHERE business_id = ?",
    "first_run": "SELECT COUNT(*) FROM first_run WHERE business_id = ?",
}


def rows_of(db_path: Path, table: str, business_id: int) -> int:
    with closing(sqlite3.connect(db_path, timeout=30)) as conn:
        found: int = conn.execute(COUNT_ROWS[table], (business_id,)).fetchone()[0]
    return found


def test_the_checklist_account_is_a_business_with_no_onboarding_and_one_priced_variety(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "sample.db"
    with running_sample(tmp_path) as (sample_app, env, base):
        account = sample_app.pre_onboarding_account(
            env, base, TODAY, db_path, "checklist", priced=True
        )

        api = sign_in(sample_app, base, account.email, account.password)
        shown = api.call("GET", "/first-run")
        assert shown["kind"] == "checklist"
        assert [(step["step"], step["done"]) for step in shown["checklist"]] == [
            ("priced_variety", True),
            ("stock_entry", False),
            ("published", False),
            ("second_user", False),
        ]
        assert shown["import_notice"] is False
        business = sample_app.business_id_of(db_path, account.email)
        assert rows_of(db_path, "onboarding", business) == 0
        assert rows_of(db_path, "first_run", business) == 0
        assert len(api.call("GET", "/api/products")) == 1


def test_the_imported_account_is_a_business_the_real_import_loaded(tmp_path: Path) -> None:
    db_path = tmp_path / "sample.db"
    with running_sample(tmp_path) as (sample_app, env, base):
        account = sample_app.imported_account(env, base, TODAY, db_path)

        api = sign_in(sample_app, base, account.email, account.password)
        shown = api.call("GET", "/first-run")
        assert shown["kind"] == "none"
        assert shown["checklist"] == []
        assert shown["import_notice"] is True
        assert api.call("GET", "/onboarding-progress")["over"] is True
        assert len(api.call("GET", "/api/products")) == 1
        business = sample_app.business_id_of(db_path, account.email)
        with closing(sqlite3.connect(db_path, timeout=30)) as conn:
            stamps = conn.execute(
                "SELECT imported_at, import_notice_over_at, checklist_gone_at"
                " FROM first_run WHERE business_id = ?",
                (business,),
            ).fetchall()
        assert len(stamps) == 1
        imported_at, notice_over_at, checklist_gone_at = stamps[0]
        assert imported_at is not None
        assert notice_over_at is None
        assert checklist_gone_at is None


def test_the_sample_refuses_a_dotenv_that_would_send_the_import_to_another_database(
    tmp_path: Path,
) -> None:
    sample_app = load_script()
    dotenv = tmp_path / ".env"

    sample_app.refuse_database_override(dotenv)
    dotenv.write_text("APOSTROPHE_SECRET_KEY=a\nAPOSTROPHE_PUBLIC_URL=b\n", encoding="utf-8")
    sample_app.refuse_database_override(dotenv)

    for line in (
        "APOSTROPHE_DATABASE_URL=sqlite:///mine.db",
        "export APOSTROPHE_DATABASE_URL = sqlite:///mine.db",
    ):
        dotenv.write_text(f"APOSTROPHE_SECRET_KEY=a\n{line}\n", encoding="utf-8")
        with pytest.raises(SystemExit) as refused:
            sample_app.refuse_database_override(dotenv)
        assert "mine.db" not in str(refused.value)
        assert "APOSTROPHE_DATABASE_URL" in str(refused.value)


def test_expect_first_run_stops_the_sample_on_any_other_answer_without_naming_data() -> None:
    sample_app = load_script()

    class Answers:
        def __init__(self, answer: dict[str, Any]) -> None:
            self.answer = answer

        def call(self, method: str, path: str, body: object | None = None) -> Any:
            assert (method, path) == ("GET", "/first-run")
            return self.answer

    def step(name: str, done: bool) -> dict[str, Any]:
        return {"step": name, "required": True, "done": done}

    both: dict[str, Any] = {
        "kind": "checklist",
        "import_notice": False,
        "checklist": [step("a", True), step("b", False)],
    }
    wanted = (("a", True), ("b", False))
    sample_app.expect_first_run(
        Answers(both), "checklist", account="pre_onboarding", steps=wanted, import_notice=False
    )
    none = {"kind": "none", "import_notice": True, "checklist": []}
    sample_app.expect_first_run(Answers(none), "none", account="imported", import_notice=True)

    wrong: dict[str, tuple[dict[str, Any], str]] = {
        "kind": ({**both, "kind": "none"}, "kind"),
        "step flipped": ({**both, "checklist": [step("a", True), step("b", True)]}, "step b"),
        "step missing": ({**both, "checklist": [step("a", True)]}, "step b"),
        "step extra": ({**both, "checklist": [*both["checklist"], step("c", False)]}, "steps"),
        "notice": ({**both, "import_notice": True}, "import_notice"),
    }
    for answer, check in wrong.values():
        with pytest.raises(SystemExit) as refused:
            sample_app.expect_first_run(
                Answers(answer),
                "checklist",
                account="pre_onboarding",
                steps=wanted,
                import_notice=False,
            )
        assert str(refused.value) == (
            f"sample-app: the pre_onboarding account's first run is wrong: {check}"
        )
    with pytest.raises(SystemExit) as refused:
        sample_app.expect_first_run(
            Answers(both), "checklist", account="pre_onboarding", import_notice=False
        )
    assert str(refused.value).endswith("steps")


def test_no_account_name_has_two_kinds_and_the_capture_accounts_are_declared() -> None:
    sample_app = load_script()
    groups = (
        sample_app.ONBOARDING_ACCOUNTS,
        sample_app.ENDED_ONBOARDING_ACCOUNTS,
        sample_app.PRE_ONBOARDING_ACCOUNTS,
        sample_app.IMPORTED_ACCOUNTS,
        sample_app.ONBOARDING_FRAME_ACCOUNTS,
    )

    assert sample_app.PRE_ONBOARDING_ACCOUNTS == ("checklist", "primera_vez")
    assert sample_app.ONBOARDING_FRAME_ACCOUNTS == ("en_curso", "completo")
    assert sample_app.IMPORTED_ACCOUNTS == ("importada",)
    names = [name for group in groups for name in group]
    assert len(names) == len(set(names))


def test_run_import_stops_the_sample_on_a_failed_import_and_on_a_reported_problem(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "sample.db"
    with running_sample(tmp_path) as (sample_app, env, base):
        account, _ = sample_app.accept_new_business(env, base, "importada")
        business = sample_app.business_id_of(db_path, account.email)
        good = tmp_path / "good.xlsx"
        sample_app.load_import_workbook().build(good, TODAY)

        # A business the import does not know: the command exits non-zero.
        with pytest.raises(SystemExit) as failed:
            sample_app.run_import(env, business + 100, good, dry_run=True)
        assert str(failed.value) == "sample-app: the import dry run failed"

        # A stock entry with an origin the import does not know: the dry run exits 0 but
        # reports a blocking problem, and the sample stops on the report's heading.
        unknown_origin = tmp_path / "unknown-origin.xlsx"
        workbook = openpyxl.load_workbook(good)
        workbook["Entradas"]["D2"] = "Regalo"
        workbook.save(unknown_origin)
        with pytest.raises(SystemExit) as reported:
            sample_app.run_import(env, business, unknown_origin, dry_run=True)
        assert str(reported.value) == "sample-app: the import dry run reported a problem"

        # Nothing was written by either refusal, and the good workbook still imports.
        sample_app.run_import(env, business, good, dry_run=True)
        assert rows_of(db_path, "first_run", business) == 0


def test_the_direct_row_write_is_refused_for_a_business_it_must_not_touch(tmp_path: Path) -> None:
    db_path = tmp_path / "sample.db"
    message = "sample-app: the pre_onboarding account's Onboarding row was not removed"
    with running_sample(tmp_path) as (sample_app, env, base):
        checklist = sample_app.pre_onboarding_account(
            env, base, TODAY, db_path, "checklist", priced=True
        )
        imported = sample_app.imported_account(env, base, TODAY, db_path)

        # No Onboarding row left to delete: the delete removes zero rows.
        gone = sample_app.business_id_of(db_path, checklist.email)
        with pytest.raises(SystemExit) as nothing:
            sample_app.drop_onboarding_row(db_path, gone)
        assert str(nothing.value) == message

        # A business with a first_run row is refused before anything is deleted.
        stamped = sample_app.business_id_of(db_path, imported.email)
        assert rows_of(db_path, "onboarding", stamped) == 1
        with pytest.raises(SystemExit) as stamped_refusal:
            sample_app.drop_onboarding_row(db_path, stamped)
        assert str(stamped_refusal.value) == message
        assert rows_of(db_path, "onboarding", stamped) == 1


def test_primera_vez_is_a_business_with_no_onboarding_and_nothing_priced(tmp_path: Path) -> None:
    db_path = tmp_path / "sample.db"
    with running_sample(tmp_path) as (sample_app, env, base):
        account = sample_app.pre_onboarding_account(
            env, base, TODAY, db_path, "primera_vez", priced=False
        )

        api = sign_in(sample_app, base, account.email, account.password)
        shown = api.call("GET", "/first-run")
        assert shown["kind"] == "checklist"
        assert [(step["step"], step["done"]) for step in shown["checklist"]] == [
            ("priced_variety", False),
            ("stock_entry", False),
            ("published", False),
            ("second_user", False),
        ]
        assert shown["import_notice"] is False
        business = sample_app.business_id_of(db_path, account.email)
        assert rows_of(db_path, "onboarding", business) == 0
        assert rows_of(db_path, "first_run", business) == 0
        assert api.call("GET", "/api/products") == []


def test_the_en_curso_account_is_an_onboarding_with_one_step_done(tmp_path: Path) -> None:
    with running_sample(tmp_path) as (sample_app, env, base):
        account = sample_app.onboarding_frame_account(env, base, TODAY, "en_curso")

        api = sign_in(sample_app, base, account.email, account.password)
        shown = api.call("GET", "/first-run")
        assert (shown["kind"], shown["checklist"], shown["import_notice"]) == (
            "onboarding",
            [],
            False,
        )
        progress = api.call("GET", "/onboarding-progress")
        assert progress["offered"] is True
        assert progress["over"] is False
        assert (progress["count"], progress["resume"]) == (1, "stock")
        assert [(item["step"], item["state"]) for item in progress["steps"]] == [
            ("variety", "done"),
            ("stock", "pending"),
            ("header_footer", "pending"),
            ("bot", "pending"),
            ("partner", "pending"),
            ("categories", "pending"),
        ]
        assert len(api.call("GET", "/api/products")) == 1


def test_the_completo_account_has_every_step_answered_and_its_onboarding_still_open(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "sample.db"
    with running_sample(tmp_path) as (sample_app, env, base):
        account = sample_app.onboarding_frame_account(env, base, TODAY, "completo")

        api = sign_in(sample_app, base, account.email, account.password)
        assert api.call("GET", "/first-run")["kind"] == "onboarding"
        progress = api.call("GET", "/onboarding-progress")
        assert (progress["count"], progress["resume"], progress["over"]) == (6, "finish", False)
        assert progress["can_skip_rest"] is True
        assert [(item["step"], item["state"]) for item in progress["steps"]] == [
            ("variety", "done"),
            ("stock", "done"),
            ("header_footer", "skipped"),
            ("bot", "skipped"),
            ("partner", "skipped"),
            ("categories", "skipped"),
        ]
        # Nothing wrote the database directly: the business keeps its own Onboarding row.
        business = sample_app.business_id_of(db_path, account.email)
        assert rows_of(db_path, "onboarding", business) == 1
        assert rows_of(db_path, "first_run", business) == 0


STEP_SLUGS = ("variety", "stock", "header_footer", "bot", "partner", "categories")


def progress_answer(**changes: Any) -> dict[str, Any]:
    """The `GET /onboarding-progress` answer of the `en_curso` account, then changed."""
    states = ("done", "pending", "pending", "pending", "pending", "pending")
    answer: dict[str, Any] = {
        "offered": True,
        "over": False,
        "count": 1,
        "resume": "stock",
        "can_skip_rest": False,
        "steps": [
            {"step": slug, "state": state} for slug, state in zip(STEP_SLUGS, states, strict=True)
        ],
    }
    return {**answer, **changes}


def test_expect_onboarding_progress_stops_the_sample_on_any_other_answer_without_naming_data() -> (
    None
):
    sample_app = load_script()

    class Answers:
        def __init__(self, answer: dict[str, Any]) -> None:
            self.answer = answer

        def call(self, method: str, path: str, body: object | None = None) -> Any:
            assert (method, path) == ("GET", "/onboarding-progress")
            return self.answer

    wanted = (
        ("variety", "done"),
        ("stock", "pending"),
        ("header_footer", "pending"),
        ("bot", "pending"),
        ("partner", "pending"),
        ("categories", "pending"),
    )

    def check(answer: dict[str, Any]) -> None:
        sample_app.expect_onboarding_progress(
            Answers(answer),
            account="onboarding",
            steps=wanted,
            count=1,
            resume="stock",
            over=False,
            can_skip_rest=False,
        )

    check(progress_answer())

    steps = progress_answer()["steps"]
    wrong: dict[str, tuple[dict[str, Any], str]] = {
        "offered": (progress_answer(offered=False), "offered"),
        "over": (progress_answer(over=True), "over"),
        "resume": (progress_answer(resume="bot"), "resume"),
        "count": (progress_answer(count=2), "count"),
        "can_skip_rest": (progress_answer(can_skip_rest=True), "can_skip_rest"),
        "can_skip_rest missing": (
            {k: v for k, v in progress_answer().items() if k != "can_skip_rest"},
            "can_skip_rest",
        ),
        "step flipped": (
            progress_answer(steps=[*steps[:1], {"step": "stock", "state": "done"}, *steps[2:]]),
            "step stock",
        ),
        "step missing": (progress_answer(steps=steps[:5]), "step categories"),
        "step extra": (
            progress_answer(steps=[*steps, {"step": "extra", "state": "pending"}]),
            "steps",
        ),
        "step renamed": (
            progress_answer(steps=[{"step": "mystery", "state": "done"}, *steps[1:]]),
            "step variety",
        ),
    }
    for answer, failed in wrong.values():
        with pytest.raises(SystemExit) as refused:
            check(answer)
        assert str(refused.value) == (
            f"sample-app: the onboarding account's progress is wrong: {failed}"
        )


def test_the_kinds_the_sample_can_write_are_the_account_kinds_of_screens_json() -> None:
    sample_app = load_script()
    registry = json.loads((SCRIPT.parent / "screens.json").read_text(encoding="utf-8"))

    assert set(registry["account_kinds"]) == set(sample_app.ACCOUNT_KINDS)
    assert len(registry["account_kinds"]) == len(set(registry["account_kinds"]))
    # Every kind is written for at least one account name, and no name has two kinds.
    assert all(sample_app.ACCOUNT_KINDS.values())
