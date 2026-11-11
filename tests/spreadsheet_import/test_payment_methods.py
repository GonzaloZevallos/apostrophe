"""The import's payment words and the business's own methods (docs/adr/0084): a sheet word
whose default method is archived refuses the whole plan before anything is written, the
dry run and the real run alike; with the methods offered the run imports."""

from __future__ import annotations

import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.payment_methods.adapters.babel_defaults import BabelMethodDefaults
from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog, OperatorText
from app.shared.language import Language
from app.spreadsheet_import.adapters.cli import run
from tests.conftest import MovableClock
from tests.spreadsheet_import.test_cli import (
    CUSTOMER,
    PHONE,
    _business_id,
    _save_mapping,
    _save_workbook,
    _workbook,
)

ARCHIVED = "import.payment_method_archived"


def _import(
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    text: OperatorText,
    *,
    dry_run: bool,
) -> tuple[int, str]:
    xlsx = _save_workbook(_workbook(payment="Efectivo"), tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    argv = [str(_business_id(engine)), str(xlsx), "--mapping", str(mapping)]
    out = io.StringIO()
    code = run(
        [*argv, "--dry-run"] if dry_run else argv,
        engine=engine,
        clock=clock,
        out=out,
        err=io.StringIO(),
        text=text,
    )
    return code, out.getvalue()


def _archive_the_defaults(client: TestClient) -> None:
    """The last offered method cannot be archived: a third one stays."""
    assert client.post("/api/payment-methods", json={"name": "Wallet app"}).status_code == 201
    for method in client.get("/api/payment-methods").json()[:2]:
        assert client.post(f"/api/payment-methods/{method['id']}/archive").status_code == 204


def test_a_sheet_word_naming_an_archived_default_method_refuses_the_plan_and_writes_nothing(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    _archive_the_defaults(client)

    for dry_run in (True, False):
        code, out = _import(engine, clock, tmp_path, operator_text_en, dry_run=dry_run)

        assert ARCHIVED in out
        assert "Writable: no" in out
        assert code == (0 if dry_run else 1)

    assert client.get("/api/products").json() == []
    assert client.get("/sales").json() == []


def test_with_the_default_methods_offered_the_same_sheet_imports(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    code, out = _import(engine, clock, tmp_path, operator_text_en, dry_run=False)

    assert ARCHIVED not in out
    assert code == 0
    assert client.get("/sales").json() != []


def _stored_language_defaults(client: TestClient, engine: Engine) -> list[str]:
    """Moves the business to the pseudo-locale and gives its two methods that language's
    default names (a business opened in that language holds them from the start)."""
    names = [
        name.value
        for name in BabelMethodDefaults(CopyCatalog(DEFAULT_LOCALES_DIR)).for_language(
            Language("en-XA")
        )
    ]
    assert names != ["Cash", "Transfer"]
    with engine.begin() as connection:
        connection.execute(text("UPDATE business SET language = 'en-XA'"))
    for method, name in zip(client.get("/api/payment-methods").json()[:2], names, strict=True):
        assert (
            client.patch(f"/api/payment-methods/{method['id']}", json={"name": name}).status_code
            == 200
        )
    return names


def test_the_sheet_word_means_the_default_name_of_the_business_s_stored_language(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    names = _stored_language_defaults(client, engine)
    assert client.post("/api/payment-methods", json={"name": "Wallet app"}).status_code == 201
    first = client.get("/api/payment-methods").json()[0]
    assert first["name"] == names[0]
    assert client.post(f"/api/payment-methods/{first['id']}/archive").status_code == 204

    code, out = _import(engine, clock, tmp_path, operator_text_en, dry_run=True)

    assert ARCHIVED in out
    assert code == 0


def test_with_the_stored_language_defaults_offered_the_import_adds_no_method(
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    _stored_language_defaults(client, engine)
    before = [method["id"] for method in client.get("/api/payment-methods").json()]

    code, out = _import(engine, clock, tmp_path, operator_text_en, dry_run=False)

    assert ARCHIVED not in out
    assert code == 0
    assert [method["id"] for method in client.get("/api/payment-methods").json()] == before
