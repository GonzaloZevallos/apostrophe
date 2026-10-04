"""`main(argv, stdin, stdout)` end to end, over a file-backed SQLite seeded through
`TestClient` (the declared seam): the real run, every guard that must leave 0 rows
changed, the privacy invariant over the captured output, `secure_delete` over the
database file's own bytes, a table and a secret column added later by raw DDL, and
the clean slate a new invitation finds afterwards.
"""

from __future__ import annotations

import io
import json
import sqlite3
import stat
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.business_removal.adapters.cli import main
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import PASSWORD, TEST_HASHER, invite

EMAIL_LEAVING = "closing@example.com"
EMAIL_STAYING = "staying@example.com"
PHONE = "+5491122334455"
CUSTOMER_NAME = "Marta Gimenez"
SALE_NOTE = "Entrega el sabado por la tarde"
EXPENSE_DETAIL = "Factura de electricidad de septiembre"
PAYMENT_AMOUNT = 54321
EXPENSE_AMOUNT = 112233
SHIPPING_CHARGED = 98765
NOW = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)

# Every kind the export holds, as the brief lists it; `business` and `app_user` are
# checked on their own since the document carries them outside `kinds`/by a fixed
# shape.
EXPORTED_KINDS = (
    "customer",
    "variety",
    "price_entry",
    "stock_entry",
    "sale",
    "sale_line",
    "payment",
    "expense_category",
    "expense",
    "catalog_header_footer",
    "catalog_attributes",
)


def _accept(client: TestClient, engine: Engine, name: str, email: str) -> str:
    accepted = client.post(
        f"/invitations/{invite(engine, NOW)}/accept",
        json={"business_name": name, "email": email, "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text
    token: str = accepted.json()["token"]
    client.cookies.clear()
    return token


def _seed(db_path: Path) -> tuple[str, str]:
    """Business B (staying) opened first, with a customer of its own; business A
    (leaving, the newest) opened second, with one of everything the export holds:
    a customer, a variety, a price entry, a stock entry, a sale with a line and a
    note, a payment, an expense category and expense, and catalog settings. One
    failed login for the leaving business's email leaves a `login_guard` row, so
    the clean slate can be checked afterwards. Returns both session tokens."""
    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(settings, engine=engine, hasher=TEST_HASHER)
    with TestClient(app) as client:
        token_b = _accept(client, engine, "Otro Negocio", EMAIL_STAYING)
        client.headers["Authorization"] = f"Bearer {token_b}"
        other_customer = client.post(
            "/customers", json={"name": "Cliente de Otro Negocio", "phone": "+5491100000000"}
        )
        assert other_customer.status_code == 201, other_customer.text
        del client.headers["Authorization"]

        token_a = _accept(client, engine, "La Huerta", EMAIL_LEAVING)
        client.headers["Authorization"] = f"Bearer {token_a}"

        customer = client.post(
            "/customers", json={"name": CUSTOMER_NAME, "phone": PHONE, "vip": False}
        )
        assert customer.status_code == 201, customer.text
        customer_id = customer.json()["id"]

        variety = client.post("/varieties", json={"name": "Lavanda"})
        assert variety.status_code == 201, variety.text
        variety_id = variety.json()["id"]

        price = client.post(
            f"/varieties/{variety_id}/prices",
            json={"effective_from": "2026-01-01", "list_price": 5000},
        )
        assert price.status_code == 201, price.text

        entry = client.post(
            "/stock/entries",
            json={
                "variety_id": variety_id,
                "origin": "purchase",
                "grams": 100,
                "total_cost": 300000,
                "note": "stock seed",
            },
        )
        assert entry.status_code == 201, entry.text

        sale = client.post(
            "/sales",
            json={
                "customer_id": customer_id,
                "shipping_charged": SHIPPING_CHARGED,
                "note": SALE_NOTE,
                "payment": "owing",
                "lines": [{"variety_id": variety_id, "grams": 10, "special_price": 6000}],
            },
        )
        assert sale.status_code == 201, sale.text

        payment = client.post(
            f"/customers/{customer_id}/payments",
            json={"paid_on": "2026-10-01", "amount": PAYMENT_AMOUNT, "method": "cash"},
        )
        assert payment.status_code == 201, payment.text

        category = client.post("/expense-categories", json={"name": "Servicios"})
        assert category.status_code == 201, category.text
        category_id = category.json()["id"]

        expense = client.post(
            "/expenses",
            json={
                "spent_on": "2026-10-02",
                "category_id": category_id,
                "amount": EXPENSE_AMOUNT,
                "detail": EXPENSE_DETAIL,
            },
        )
        assert expense.status_code == 201, expense.text

        header_footer = client.put(
            "/catalog/header-footer", json={"header": "Catalogo", "footer": "Gracias"}
        )
        assert header_footer.status_code == 200, header_footer.text

        attributes = client.put(
            f"/catalog/varieties/{variety_id}",
            json={"shown": True, "emoji": "\U0001f33f", "indica_share": 50, "aroma": "floral"},
        )
        assert attributes.status_code == 200, attributes.text

        failed_login = client.post(
            "/auth/login", json={"email": EMAIL_LEAVING, "password": "wrong password"}
        )
        assert failed_login.status_code == 401, failed_login.text

        del client.headers["Authorization"]
    engine.dispose()
    return token_a, token_b


def _env(
    monkeypatch: pytest.MonkeyPatch, db_path: Path, export_dir: Path
) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("APOSTROPHE_EXPORT_DIR", str(export_dir))


def _row_counts(db_path: Path, table: str, business_id: int) -> int:
    connection = sqlite3.connect(db_path)
    try:
        column = "id" if table == "business" else "business_id"
        query = f"SELECT COUNT(*) FROM {table} WHERE {column} = ?"
        cursor = connection.execute(query, (business_id,))
        return int(cursor.fetchone()[0])
    finally:
        connection.close()


def _all_table_names(db_path: Path) -> list[str]:
    """Every table with its own `business_id` column (`business` itself is checked
    separately, by `id`; `invitation` and `login_guard` have no `business_id` of
    their own and are checked by other means in the clean-slate test)."""
    with sqlite3.connect(db_path) as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' "
                "AND name NOT IN ('alembic_version', 'business', 'invitation', 'login_guard')"
            ).fetchall()
        ]
        return [name for name in tables if _has_business_id(connection, name)] + ["business"]


def _has_business_id(connection: sqlite3.Connection, table: str) -> bool:
    columns = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(column[1] == "business_id" for column in columns)


def test_a_real_run_exports_then_deletes_and_leaves_the_other_business_whole(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        other_business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'Otro Negocio'"
        ).fetchone()["id"]
        leaving_business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()["id"]
    all_tables = _all_table_names(db_path)
    other_before = {name: _row_counts(db_path, name, other_business_id) for name in all_tables}
    leaving_before = {
        name: _row_counts(db_path, name, leaving_business_id) for name in all_tables
    }
    assert other_before["customer"] == 1  # the other business's own seed

    stdout = io.StringIO()
    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout)

    assert result == 0
    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    document = json.loads(files[0].read_text())
    assert document["business"]["name"] == "La Huerta"
    business_id = document["business"]["id"]
    kinds = document["kinds"]

    for kind in EXPORTED_KINDS:
        assert kind in kinds, f"{kind} is missing from the export"
        assert len(kinds[kind]) >= 1, f"{kind} was not seeded"

    customers = {record["name"]: record for record in kinds["customer"]}
    assert customers[CUSTOMER_NAME]["phone"] == PHONE

    varieties = {record["name"]: record for record in kinds["variety"]}
    variety_id = varieties["Lavanda"]["id"]

    sale = kinds["sale"][0]
    assert sale["note"] == SALE_NOTE
    assert sale["shipping_charged"] == SHIPPING_CHARGED
    assert sale["customer_id"] == {"id": customers[CUSTOMER_NAME]["id"], "name": CUSTOMER_NAME}

    sale_line = kinds["sale_line"][0]
    assert sale_line["variety_id"] == {"id": variety_id, "name": "Lavanda"}

    payment = kinds["payment"][0]
    assert payment["amount"] == PAYMENT_AMOUNT
    assert payment["customer_id"] == {"id": customers[CUSTOMER_NAME]["id"], "name": CUSTOMER_NAME}

    categories = {record["name"]: record for record in kinds["expense_category"]}
    expense = kinds["expense"][0]
    assert expense["amount"] == EXPENSE_AMOUNT
    assert expense["detail"] == EXPENSE_DETAIL
    assert expense["category_id"] == {"id": categories["Servicios"]["id"], "name": "Servicios"}

    dumped = json.dumps(document)
    assert "password_hash" not in dumped
    assert "token_digest" not in dumped
    assert "invitation" not in kinds
    assert "login_guard" not in kinds

    # exported count == the row count from just before the run (every row of this
    # business was exported, nothing more and nothing less), and 0 rows remain.
    for kind, records in kinds.items():
        assert len(records) == leaving_before.get(kind, 0)
        assert _row_counts(db_path, kind, business_id) == 0

    # the other business's rows, in every table, are exactly as they were
    other_after = {name: _row_counts(db_path, name, other_business_id) for name in all_tables}
    assert other_after == other_before

    output = stdout.getvalue()
    for secret in (
        EMAIL_LEAVING,
        EMAIL_STAYING,
        CUSTOMER_NAME,
        PHONE,
        SALE_NOTE,
        EXPENSE_DETAIL,
        str(PAYMENT_AMOUNT),
        str(EXPENSE_AMOUNT),
        str(SHIPPING_CHARGED),
    ):
        assert secret not in output


def test_the_other_business_still_reads_its_own_data_after_the_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _token_a, token_b = _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    assert main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO()) == 0

    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(settings, engine=engine, hasher=TEST_HASHER)
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token_b}"
        listed = client.get("/customers")
        assert listed.status_code == 200
        assert len(listed.json()) == 1
        assert listed.json()[0]["name"] == "Cliente de Otro Negocio"
    engine.dispose()


def test_a_dry_run_writes_no_file_and_deletes_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=stdout)

    assert result == 0
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    assert _row_counts(db_path, "customer", business_id) == 1
    output = stdout.getvalue()
    assert "La Huerta" in output
    assert "customer: 1" in output
    assert CUSTOMER_NAME not in output
    assert PHONE not in output


def test_an_unknown_email_changes_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    result = main(["nobody@example.com"], stdin=io.StringIO(""), stdout=io.StringIO())

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_a_wrong_name_at_the_prompt_writes_no_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    result = main([EMAIL_LEAVING], stdin=io.StringIO("Not The Name\n"), stdout=io.StringIO())

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    assert _row_counts(db_path, "customer", business_id) == 1


def test_eof_at_the_prompt_writes_no_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    result = main([EMAIL_LEAVING], stdin=io.StringIO(""), stdout=io.StringIO())

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_secure_delete_scrubs_the_removed_customers_bytes_from_the_database_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    assert main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO()) == 0

    raw = db_path.read_bytes()
    assert PHONE.encode() not in raw
    assert CUSTOMER_NAME.encode() not in raw
    assert b"Otro Negocio" in raw


def test_the_export_file_is_owner_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    assert main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO()) == 0

    files = list(export_dir.glob("*.json"))
    mode = stat.S_IMODE(files[0].stat().st_mode)
    assert mode == 0o600


def test_a_table_added_later_by_raw_ddl_is_exported_with_a_name_reference_and_emptied(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    with sqlite3.connect(db_path) as connection:
        # A table added later needs its own `name` (or a declared label) like every
        # owned table does: that is `unlabelled_tables`'s own guard, proven over the
        # migrated schema in `tests/business_removal/test_migrated_schema.py`. This
        # table has one, so it is covered without touching the command.
        connection.execute(
            "CREATE TABLE loyalty_point ("
            "id INTEGER PRIMARY KEY, "
            "business_id INTEGER NOT NULL REFERENCES business(id), "
            "variety_id INTEGER NOT NULL REFERENCES variety(id), "
            "name TEXT NOT NULL, "
            "points INTEGER NOT NULL)"
        )
        business_id, variety_id = connection.execute(
            "SELECT business.id, variety.id FROM business "
            "JOIN variety ON variety.business_id = business.id "
            "WHERE business.name = 'La Huerta'"
        ).fetchone()
        connection.execute(
            "INSERT INTO loyalty_point (business_id, variety_id, name, points) VALUES (?, ?, ?, ?)",
            (business_id, variety_id, "Puntos de Lavanda", 10),
        )
        connection.commit()
    _env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    dry = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=stdout)
    assert dry == 0
    assert "loyalty_point: 1" in stdout.getvalue()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO())
    assert result == 0

    files = list(export_dir.glob("*.json"))
    document = json.loads(files[0].read_text())
    loyalty = document["kinds"]["loyalty_point"]
    assert len(loyalty) == 1
    assert loyalty[0]["variety_id"] == {"id": variety_id, "name": "Lavanda"}
    assert _row_counts(db_path, "loyalty_point", business_id) == 0


def test_a_secret_like_column_added_later_by_raw_ddl_refuses_both_modes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("ALTER TABLE app_user ADD COLUMN bot_token_encrypted TEXT")
        connection.commit()
    _env(monkeypatch, db_path, export_dir)
    dry_stdout = io.StringIO()
    real_stdout = io.StringIO()

    dry = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=dry_stdout)
    real = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=real_stdout)

    assert dry == 1
    assert real == 1
    assert "bot_token_encrypted" in dry_stdout.getvalue()
    assert "bot_token_encrypted" in real_stdout.getvalue()
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_a_clean_slate_lets_the_same_email_open_a_new_business(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # `_seed` opens the staying business first, then the leaving one: the one this
    # removes (EMAIL_LEAVING) is the newest, as the brief's clean-slate scenario asks.
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    token_a, _token_b = _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    with sqlite3.connect(db_path) as connection:
        old_user_id = connection.execute(
            "SELECT id FROM app_user WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
        brake_rows_before = connection.execute(
            "SELECT COUNT(*) FROM login_guard WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
    assert brake_rows_before == 1  # the one failed login `_seed` recorded

    assert main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO()) == 0

    with sqlite3.connect(db_path) as connection:
        brake_rows_after = connection.execute(
            "SELECT COUNT(*) FROM login_guard WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
    assert brake_rows_after == 0  # the brake count is clean

    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(settings, engine=engine, hasher=TEST_HASHER)
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token_a}"
        rejected = client.get("/customers")
        assert rejected.status_code == 401
        del client.headers["Authorization"]

        reopened = _accept(client, engine, "La Huerta Nueva", EMAIL_LEAVING)
        client.headers["Authorization"] = f"Bearer {reopened}"
        listed = client.get("/customers")
        assert listed.status_code == 200
        assert listed.json() == []
    engine.dispose()

    with sqlite3.connect(db_path) as connection:
        new_user_id = connection.execute(
            "SELECT id FROM app_user WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
    assert new_user_id == old_user_id  # the id is reused, not skipped


def test_a_refused_export_directory_ends_in_a_fixed_message_with_no_traceback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    # `prepare()` runs before the use case's own try in earlier revisions of this
    # module; a directory open to group or other must still end in one fixed line,
    # never a traceback on the real stderr `capsys` observes.
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    export_dir.mkdir(mode=0o755)
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout)

    assert result == 1
    assert stdout.getvalue() == "Failed: nothing deleted.\n"
    captured = capsys.readouterr()
    assert captured.err == ""
    assert captured.out == ""
    assert list(export_dir.glob("*.json")) == []


def test_an_nfd_typed_name_matches_through_main(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(settings, engine=engine, hasher=TEST_HASHER)
    stored_name = "Café Central"
    with TestClient(app) as client:
        _accept(client, engine, stored_name, "cafe@example.com")
    engine.dispose()
    _env(monkeypatch, db_path, export_dir)
    typed_nfd = unicodedata.normalize("NFD", stored_name) + "\n"

    result = main(["cafe@example.com"], stdin=io.StringIO(typed_nfd), stdout=io.StringIO())

    assert result == 0
    assert list(export_dir.glob("*.json"))


def test_a_broken_pipe_on_the_report_keeps_the_commit_through_main(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class _BreaksAfterExportWritten:
        def __init__(self) -> None:
            self.text = ""
            self._broken = False

        def write(self, data: str) -> int:
            if self._broken:
                raise BrokenPipeError()
            self.text += data
            if "Export written" in data:
                self._broken = True
            return len(data)

        def flush(self) -> None:
            pass

    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    stdout = _BreaksAfterExportWritten()

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=cast(TextIO, stdout)
    )

    assert result == 1
    assert "nothing deleted" not in stdout.text.lower()
    assert _row_counts(db_path, "customer", business_id) == 0  # the delete still committed
    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    json.loads(files[0].read_text())  # the export file still parses
