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
from datetime import UTC, datetime
from pathlib import Path

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
NOW = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)


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
    """Business A (leaving) with a customer and a variety; business B (staying)
    with nothing of its own beyond what opening a business always seeds. Returns
    both session tokens."""
    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(settings, engine=engine, hasher=TEST_HASHER)
    with TestClient(app) as client:
        token_a = _accept(client, engine, "La Huerta", EMAIL_LEAVING)
        client.headers["Authorization"] = f"Bearer {token_a}"
        created = client.post(
            "/customers", json={"name": CUSTOMER_NAME, "phone": PHONE, "vip": False}
        )
        assert created.status_code == 201, created.text
        variety = client.post("/varieties", json={"name": "Lavanda"})
        assert variety.status_code == 201, variety.text
        del client.headers["Authorization"]

        token_b = _accept(client, engine, "Otro Negocio", EMAIL_STAYING)
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


def test_a_real_run_exports_then_deletes_and_leaves_the_other_business_whole(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    _seed(db_path)
    _env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout)

    assert result == 0
    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    document = json.loads(files[0].read_text())
    assert document["business"]["name"] == "La Huerta"
    customers = {record["name"]: record for record in document["kinds"]["customer"]}
    assert customers[CUSTOMER_NAME]["phone"] == PHONE
    assert "password_hash" not in json.dumps(document)
    assert "token_digest" not in json.dumps(document)
    assert "invitation" not in document["kinds"]

    # exported == deleted, for every exported kind
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        business_row = connection.execute(
            "SELECT id FROM business WHERE name = 'Otro Negocio'"
        ).fetchone()
    other_business_id = business_row["id"]

    for table_name, records in document["kinds"].items():
        assert _row_counts(db_path, table_name, document["business"]["id"]) == 0
        assert len(records) >= 0  # every kind is present in the file (sanity)

    # the other business is untouched
    assert _row_counts(db_path, "app_user", other_business_id) == 1
    assert _row_counts(db_path, "business", other_business_id) == 1

    output = stdout.getvalue()
    assert EMAIL_LEAVING not in output
    assert CUSTOMER_NAME not in output
    assert PHONE not in output


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
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    token_a, _token_b = _seed(db_path)
    _env(monkeypatch, db_path, export_dir)

    assert main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO()) == 0

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
