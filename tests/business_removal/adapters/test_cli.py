"""`main(argv, stdin, stdout)` end to end, over a file-backed SQLite seeded through
`TestClient` (the declared seam): the real run, every guard that must leave 0 rows
changed, the privacy invariant over the captured output, `secure_delete` over the
database file's own bytes, a table and a secret column added later by raw DDL, and
the clean slate a new invitation finds afterwards.
"""

from __future__ import annotations

import io
import json
import re
import signal
import sqlite3
import stat
import unicodedata
from collections.abc import Callable
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import TextIO, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.reset_password import issue_reset_link
from app.accounts.domain.invitation import token_digest
from app.business_removal.adapters.cli import main
from app.db import make_engine
from app.shared.calendar import business_day
from tests.business_removal.adapters.seed import (
    BUENOS_AIRES,
    CATALOG_FOOTER,
    CATALOG_HEADER,
    CUSTOMER_NAME,
    EMAIL_LEAVING,
    EMAIL_STAYING,
    EXPENSE_AMOUNT,
    EXPENSE_DETAIL,
    LOW_STOCK_THRESHOLD,
    PAYMENT_AMOUNT,
    PHONE,
    PINNED,
    SALE_NOTE,
    SHIPPING_CHARGED,
    accept_invitation,
    build_app,
    row_counts,
    seed,
    seeded_days,
    set_env,
)
from tests.business_removal.english_words import baseline_text
from tests.conftest import MovableClock

BUSY_MESSAGE = baseline_text("operator.removal.busy")
NO_PHONE_CUSTOMER_NAME = "Sin Numero"  # exported only in the export test; not counted
# elsewhere, so the shared `seed()`'s own row counts stay untouched.

ARGENTINA = timezone(timedelta(hours=-3))

# Every kind the export holds, as the brief lists it. `business` is checked on its
# own since the document carries it outside `kinds`, by a fixed shape.
EXPORTED_KINDS = (
    "app_user",
    "customer",
    "variety",
    "price_entry",
    "stock_entry",
    "stock_threshold",
    "sale",
    "sale_line",
    "payment",
    "expense_category",
    "expense",
    "catalog_header_footer",
    "catalog_attributes",
    "onboarding",
    "first_run",
)


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


# (seed instant, removal instant): the Argentina day, the UTC day, the month and the
# year each differ between the two instants in at least one case.
REMOVAL_CASES = {
    "pinned": (PINNED, PINNED),
    "year-at-seed": (
        datetime(2026, 12, 31, 23, 30, tzinfo=ARGENTINA),
        datetime(2027, 1, 1, 0, 30, tzinfo=ARGENTINA),
    ),
    "month": (
        datetime(2026, 10, 31, 23, 30, tzinfo=ARGENTINA),
        datetime(2026, 11, 1, 0, 30, tzinfo=ARGENTINA),
    ),
    "year-at-removal": (
        datetime(2026, 12, 31, 12, 0, tzinfo=ARGENTINA),
        datetime(2026, 12, 31, 22, 30, tzinfo=ARGENTINA),
    ),
}


@pytest.mark.parametrize(
    ("seed_instant", "removal_instant"), REMOVAL_CASES.values(), ids=REMOVAL_CASES.keys()
)
def test_a_real_run_exports_then_deletes_and_leaves_the_other_business_whole(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    seed_instant: datetime,
    removal_instant: datetime,
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(seed_instant)
    token_a, _token_b = seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    days = seeded_days(clock)

    # One customer with no phone (ADR-0021), added only to this test: the shared
    # `seed()` keeps its row counts, which other tests in this module pin at exactly
    # one customer. `leaving_before`, captured below, counts it dynamically.
    app, engine = build_app(db_path, clock)
    with TestClient(app) as extra_client:
        extra_client.headers["Authorization"] = f"Bearer {token_a}"
        no_phone = extra_client.post("/customers", json={"name": NO_PHONE_CUSTOMER_NAME})
        assert no_phone.status_code == 201, no_phone.text
    engine.dispose()

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        other_business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'Otro Negocio'"
        ).fetchone()["id"]
        leaving_business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()["id"]
    # The first-run stamps the import and the guarded read leave (docs/adr/0046): one row
    # for each business, so the export, the count and the delete all meet it.
    with sqlite3.connect(db_path) as connection:
        for owner in (other_business_id, leaving_business_id):
            connection.execute(
                "INSERT INTO first_run (business_id, imported_at) VALUES (?, ?)",
                (owner, "2026-10-01 12:00:00"),
            )
    all_tables = _all_table_names(db_path)
    other_before = {name: row_counts(db_path, name, other_business_id) for name in all_tables}
    leaving_before = {name: row_counts(db_path, name, leaving_business_id) for name in all_tables}
    assert other_before["customer"] == 1  # the other business's own seed

    stdout = io.StringIO()
    clock.set(removal_instant)
    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout, clock=clock)

    assert result == 0
    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    removed_at = removal_instant.astimezone(UTC)
    assert files[0].name.endswith(removed_at.strftime("%Y%m%d-%H%M%S") + ".json")
    document = json.loads(files[0].read_text())
    assert document["business"]["name"] == "La Huerta"
    business_id = document["business"]["id"]
    kinds = document["kinds"]

    for kind in EXPORTED_KINDS:
        assert kind in kinds, f"{kind} is missing from the export"
        assert len(kinds[kind]) >= 1, f"{kind} was not seeded"

    user = next(record for record in kinds["app_user"] if record["email"] == EMAIL_LEAVING)
    assert "password_hash" not in user
    assert user["joined_at"] == seed_instant.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    customers = {record["name"]: record for record in kinds["customer"]}
    assert customers[CUSTOMER_NAME]["phone"] == PHONE
    assert customers[NO_PHONE_CUSTOMER_NAME]["phone"] is None

    varieties = {record["name"]: record for record in kinds["variety"]}
    variety_id = varieties["Lavanda"]["id"]
    variety_ref = {"id": variety_id, "name": "Lavanda"}

    stock_entry = kinds["stock_entry"][0]
    assert stock_entry["variety_id"] == variety_ref
    assert stock_entry["grams"] == "100.00"
    assert stock_entry["origin"] == "purchase"
    assert stock_entry["total_cost"] == 300000
    assert stock_entry["note"] == "stock seed"
    # `seed()` never passes a `date`, so the entry is recorded on the business day
    # of the seed instant.
    assert stock_entry["entry_date"] == business_day(seed_instant, BUENOS_AIRES).isoformat()

    price_entry = kinds["price_entry"][0]
    assert price_entry["variety_id"] == variety_ref
    assert price_entry["effective_from"] == days.price.isoformat()
    assert price_entry["list_price"] == 5000

    threshold = kinds["stock_threshold"][0]
    assert threshold["variety_id"] == variety_ref
    assert threshold["threshold"] == f"{LOW_STOCK_THRESHOLD}.00"

    onboarding = kinds["onboarding"][0]
    assert onboarding["ended_at"] is None
    assert onboarding["bot_pass"] is None

    first_run = kinds["first_run"][0]
    assert first_run["imported_at"] == "2026-10-01T12:00:00Z"
    assert first_run["checklist_gone_at"] is None
    assert first_run["import_notice_over_at"] is None

    header_footer = kinds["catalog_header_footer"][0]
    assert header_footer["header"] == CATALOG_HEADER
    assert header_footer["footer"] == CATALOG_FOOTER

    attributes = kinds["catalog_attributes"][0]
    assert attributes["variety_id"] == variety_ref
    assert attributes["shown"] is True
    assert attributes["aroma"] == "floral"
    assert attributes["indica_share"] == 50

    sale = kinds["sale"][0]
    assert sale["note"] == SALE_NOTE
    assert sale["shipping_charged"] == SHIPPING_CHARGED
    assert sale["customer_id"] == {"id": customers[CUSTOMER_NAME]["id"], "name": CUSTOMER_NAME}

    sale_line = kinds["sale_line"][0]
    assert sale_line["variety_id"] == {"id": variety_id, "name": "Lavanda"}

    payment = kinds["payment"][0]
    assert payment["amount"] == PAYMENT_AMOUNT
    assert payment["paid_on"] == days.payment.isoformat()
    assert payment["customer_id"] == {"id": customers[CUSTOMER_NAME]["id"], "name": CUSTOMER_NAME}

    categories = {record["name"]: record for record in kinds["expense_category"]}
    expense = kinds["expense"][0]
    assert expense["amount"] == EXPENSE_AMOUNT
    assert expense["spent_on"] == days.expense.isoformat()
    assert expense["detail"] == EXPENSE_DETAIL
    assert expense["category_id"] == {"id": categories["Servicios"]["id"], "name": "Servicios"}

    sale_line_total = sale_line["line_total"]
    assert document["exported_at"] == removed_at.strftime("%Y-%m-%dT%H:%M:%SZ")

    dumped = json.dumps(document)
    assert "password_hash" not in dumped
    assert "token_digest" not in dumped
    assert "invitation" not in kinds
    assert "login_guard" not in kinds

    # exported count == the row count from just before the run (every row of this
    # business was exported, nothing more and nothing less), and 0 rows remain.
    for kind, records in kinds.items():
        assert len(records) == leaving_before.get(kind, 0)
        assert row_counts(db_path, kind, business_id) == 0

    # the other business's rows, in every table, are exactly as they were
    other_after = {name: row_counts(db_path, name, other_business_id) for name in all_tables}
    assert other_after == other_before

    output = stdout.getvalue()
    captured = capsys.readouterr()
    for secret in (
        EMAIL_LEAVING,
        EMAIL_STAYING,
        CUSTOMER_NAME,
        PHONE,
        SALE_NOTE,
        EXPENSE_DETAIL,
    ):
        assert secret not in output
        assert secret not in captured.out
        assert secret not in captured.err

    # The export path (under `tmp_path`) can itself hold digits that would spoil a
    # whole-number match below; it is not a secret amount, so it is scrubbed first,
    # along with the raw `tmp_path` prefix.
    export_path = str(files[0])
    scrubbed_output = output.replace(export_path, "").replace(str(tmp_path), "")
    scrubbed_out = captured.out.replace(export_path, "").replace(str(tmp_path), "")
    scrubbed_err = captured.err.replace(export_path, "").replace(str(tmp_path), "")
    for amount in (
        PAYMENT_AMOUNT,
        EXPENSE_AMOUNT,
        SHIPPING_CHARGED,
        5000,
        300000,
        6000,
        sale_line_total,
    ):
        plain = re.compile(rf"(?<!\d){amount}(?!\d)")
        grouped = re.compile(rf"(?<!\d){amount:,}(?!\d)".replace(",", r"\."))
        for text in (scrubbed_output, scrubbed_out, scrubbed_err):
            assert plain.search(text) is None
            assert grouped.search(text) is None


def test_the_other_business_still_reads_its_own_data_after_the_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    _token_a, token_b = seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    assert (
        main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock)
        == 0
    )

    app, engine = build_app(db_path, clock)
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token_b}"
        listed = client.get("/customers")
        assert listed.status_code == 200
        assert len(listed.json()) == 1
        assert listed.json()[0]["name"] == "Cliente de Otro Negocio"
    engine.dispose()


def test_removal_withholds_a_live_reset_link(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A business holding a live reset link (docs/adr/0019): the dry run counts it
    as "deleted only", the real export never carries its digest or a `reset_link`
    key, reconciliation still passes (the real run would otherwise refuse), every
    row of the leaving business's link is gone afterwards, and the other business's
    own link is untouched."""
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    url = f"sqlite:///{db_path}"

    with Session(make_engine(url)) as session:
        accounts = SqlAccounts(session)
        leaving_issued = issue_reset_link(accounts, session, EMAIL_LEAVING, clock())
        staying_issued = issue_reset_link(accounts, session, EMAIL_STAYING, clock())
    assert leaving_issued is not None and staying_issued is not None
    leaving_digest = token_digest(leaving_issued.token)

    dry_stdout = io.StringIO()
    dry_result = main(
        [EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=dry_stdout, clock=clock
    )
    assert dry_result == 0
    assert "reset_link: 1 (deleted only)" in dry_stdout.getvalue()

    with sqlite3.connect(db_path) as connection:
        other_business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'Otro Negocio'"
        ).fetchone()[0]

    real_result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )
    assert real_result == 0

    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    dumped = files[0].read_text()
    document = json.loads(dumped)
    assert "reset_link" not in document["kinds"]
    assert leaving_digest not in dumped
    assert not any(
        len(word) == 64 and all(character in "0123456789abcdef" for character in word)
        for word in dumped.replace('"', " ").split()
    )

    assert row_counts(db_path, "reset_link", document["business"]["id"]) == 0
    assert row_counts(db_path, "reset_link", other_business_id) == 1


def test_a_dry_run_writes_no_file_and_deletes_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=stdout, clock=clock)

    assert result == 0
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    assert row_counts(db_path, "customer", business_id) == 1
    output = stdout.getvalue()
    captured = capsys.readouterr()
    assert "La Huerta" in output
    assert "customer: 1" in output
    assert "onboarding: 1" in output
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
        assert secret not in captured.out
        assert secret not in captured.err


def test_an_unknown_email_changes_nothing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    result = main(["nobody@example.com"], stdin=io.StringIO(""), stdout=io.StringIO(), clock=clock)

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_a_wrong_name_at_the_prompt_writes_no_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("Not The Name\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    assert row_counts(db_path, "customer", business_id) == 1


def test_eof_at_the_prompt_writes_no_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    result = main([EMAIL_LEAVING], stdin=io.StringIO(""), stdout=io.StringIO(), clock=clock)

    assert result == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_secure_delete_scrubs_the_removed_customers_bytes_from_the_database_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    assert (
        main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock)
        == 0
    )

    raw = db_path.read_bytes()
    assert PHONE.encode() not in raw
    assert CUSTOMER_NAME.encode() not in raw
    assert b"Otro Negocio" in raw


def test_the_export_file_is_owner_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    assert (
        main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock)
        == 0
    )

    files = list(export_dir.glob("*.json"))
    mode = stat.S_IMODE(files[0].stat().st_mode)
    assert mode == 0o600


def test_a_table_added_later_by_raw_ddl_is_exported_with_a_name_reference_and_emptied(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
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
    set_env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    dry = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=stdout, clock=clock)
    assert dry == 0
    assert "loyalty_point: 1" in stdout.getvalue()

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )
    assert result == 0

    files = list(export_dir.glob("*.json"))
    document = json.loads(files[0].read_text())
    loyalty = document["kinds"]["loyalty_point"]
    assert len(loyalty) == 1
    assert loyalty[0]["variety_id"] == {"id": variety_id, "name": "Lavanda"}
    assert row_counts(db_path, "loyalty_point", business_id) == 0


def test_a_secret_like_column_added_later_by_raw_ddl_refuses_both_modes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    with sqlite3.connect(db_path) as connection:
        connection.execute("ALTER TABLE app_user ADD COLUMN bot_token_encrypted TEXT")
        connection.commit()
    set_env(monkeypatch, db_path, export_dir)
    dry_stdout = io.StringIO()
    real_stdout = io.StringIO()

    dry = main([EMAIL_LEAVING, "--dry-run"], stdin=io.StringIO(""), stdout=dry_stdout, clock=clock)
    real = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=real_stdout, clock=clock)

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
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    token_a, _token_b = seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)

    with sqlite3.connect(db_path) as connection:
        old_user_id = connection.execute(
            "SELECT id FROM app_user WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
        brake_rows_before = connection.execute(
            "SELECT COUNT(*) FROM login_guard WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
    assert brake_rows_before == 1  # the one failed login `_seed` recorded

    assert (
        main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock)
        == 0
    )

    with sqlite3.connect(db_path) as connection:
        brake_rows_after = connection.execute(
            "SELECT COUNT(*) FROM login_guard WHERE email = ?", (EMAIL_LEAVING,)
        ).fetchone()[0]
    assert brake_rows_after == 0  # the brake count is clean

    app, engine = build_app(db_path, clock)
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token_a}"
        rejected = client.get("/customers")
        assert rejected.status_code == 401
        del client.headers["Authorization"]

        reopened = accept_invitation(client, engine, clock, "La Huerta Nueva", EMAIL_LEAVING)
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
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    export_dir.mkdir(mode=0o755)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=stdout, clock=clock)

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
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    app, engine = build_app(db_path, clock)
    stored_name = "Café Central"
    with TestClient(app) as client:
        accept_invitation(client, engine, clock, stored_name, "cafe@example.com")
    engine.dispose()
    set_env(monkeypatch, db_path, export_dir)
    typed_nfd = unicodedata.normalize("NFD", stored_name) + "\n"

    result = main(
        ["cafe@example.com"], stdin=io.StringIO(typed_nfd), stdout=io.StringIO(), clock=clock
    )

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
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        business_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
    stdout = _BreaksAfterExportWritten()

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=cast(TextIO, stdout), clock=clock
    )

    assert result == 1
    assert "nothing deleted" not in stdout.text.lower()
    assert row_counts(db_path, "customer", business_id) == 0  # the delete still committed
    files = list(export_dir.glob("*.json"))
    assert len(files) == 1
    json.loads(files[0].read_text())  # the export file still parses


class _LocksWhileConfirming:
    """`stdin`, as `main` sees it, for the one moment it calls `readline()` to read
    the operator's typed name. At that moment this opens a second, independent
    `sqlite3` connection on the same file and takes `BEGIN EXCLUSIVE`, so the
    primary connection's next statement blocks until `busy_timeout` (5 s) gives up
    with SQLite's own "database is locked" -- the real condition
    `_BusyTranslatingSchemaRows`/`_looks_locked` (both private to `cli.py`, so this
    test only ever calls `main`) turn into `StorageBusy`. The lock is released in
    `finally`, from the test, however `main` ends."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self.locker: sqlite3.Connection | None = None

    def readline(self) -> str:
        self.locker = sqlite3.connect(self._db_path)
        self.locker.execute("BEGIN EXCLUSIVE")
        return "La Huerta\n"

    def release(self) -> None:
        if self.locker is not None:
            self.locker.rollback()
            self.locker.close()
            self.locker = None


def test_a_locked_database_ends_on_the_busy_line_through_main(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Slow on purpose: a real "database is locked" only surfaces once SQLite's own
    # 5 s `busy_timeout` gives up. No hook, no setting shortens it (the brief).
    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    export_dir = tmp_path / "exports"
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        leaving_id = connection.execute(
            "SELECT id FROM business WHERE name = 'La Huerta'"
        ).fetchone()[0]
        staying_id = connection.execute(
            "SELECT id FROM business WHERE name = 'Otro Negocio'"
        ).fetchone()[0]
    stdin = _LocksWhileConfirming(db_path)
    stdout = io.StringIO()

    try:
        result = main([EMAIL_LEAVING], stdin=cast(TextIO, stdin), stdout=stdout, clock=clock)
    finally:
        stdin.release()

    # In WAL mode a plain read need not block on an exclusive writer; whichever way
    # the lock bites, the run still ends on the one fixed busy line, through `main`.
    assert result == 1
    assert stdout.getvalue().endswith(BUSY_MESSAGE + "\n")
    assert row_counts(db_path, "customer", leaving_id) == 1
    assert row_counts(db_path, "customer", staying_id) == 1
    assert not export_dir.exists() or list(export_dir.glob("*")) == []


def test_the_export_carries_the_stored_language_of_the_removed_business(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, export_dir)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE business SET language = 'de' WHERE name = 'La Huerta'")

    result = main(
        [EMAIL_LEAVING], stdin=io.StringIO("La Huerta\n"), stdout=io.StringIO(), clock=clock
    )

    assert result == 0
    (written,) = export_dir.glob("*.json")
    document = json.loads(written.read_text())
    assert document["business"]["language"] == "de"
    with sqlite3.connect(db_path) as connection:
        remaining = connection.execute("SELECT name FROM business ORDER BY id").fetchall()
    assert remaining == [("Otro Negocio",)]


def test_an_invalid_forced_language_prints_one_refused_line_before_any_handler_is_installed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "apostrophe.db"
    export_dir = tmp_path / "exports"
    set_env(monkeypatch, db_path, export_dir)
    monkeypatch.setenv("APOSTROPHE_FORCED_LANGUAGE", "fr-secret")
    handlers = (signal.getsignal(signal.SIGHUP), signal.getsignal(signal.SIGTERM))
    stdout = io.StringIO()

    result = main([EMAIL_LEAVING], stdin=io.StringIO(""), stdout=stdout, clock=MovableClock(PINNED))

    assert result == 1
    assert stdout.getvalue() == "refused: InvalidSetting\n"
    assert (signal.getsignal(signal.SIGHUP), signal.getsignal(signal.SIGTERM)) == handlers
    assert not db_path.exists()
    assert not export_dir.exists()


def test_a_line_that_cannot_be_rendered_ends_in_one_refused_line_through_main(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class Broken:
        def __init__(self, _text: object) -> None:
            pass

        def __getattr__(self, name: str) -> Callable[..., str]:
            def fail(*_args: object, **_kwargs: object) -> str:
                raise RuntimeError("no text")

            return fail

    db_path = tmp_path / "apostrophe.db"
    clock = MovableClock(PINNED)
    seed(db_path, clock)
    set_env(monkeypatch, db_path, tmp_path / "exports")
    monkeypatch.setattr("app.business_removal.adapters.cli.TranslatedOperatorWords", Broken)
    stdout = io.StringIO()

    result = main(
        ["nobody@example.com", "--dry-run"], stdin=io.StringIO(""), stdout=stdout, clock=clock
    )

    assert result == 1
    assert stdout.getvalue() == "refused: RuntimeError\n"
