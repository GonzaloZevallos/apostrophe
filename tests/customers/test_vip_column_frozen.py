"""`customer.vip` is frozen: no path writes it any more (docs/adr/0070). A recorder on
the engine's `before_cursor_execute` event sees every statement of the flows that touch
customers, and none of them is an INSERT or UPDATE that names the column. Seam: the
statement recorder over SQLAlchemy engine events, driven through the HTTP API, the
spreadsheet import CLI and the opening of a business.
"""

from __future__ import annotations

import io
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.shared.copy import OperatorText
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

_INSERT = re.compile(r"^\s*INSERT\s+INTO\s+\"?customer\"?\s*\((?P<columns>[^)]*)\)", re.IGNORECASE)
_UPDATE = re.compile(
    r"^\s*UPDATE\s+\"?customer\"?\s+SET\s+(?P<rest>.*)$", re.IGNORECASE | re.DOTALL
)
_NESTED = re.compile(r"\([^()]*\)")
_ASSIGNS_VIP = re.compile(r"(?:^|,)\s*\"?vip\"?\s*=", re.IGNORECASE)


def writes_the_vip_column(statement: str) -> bool:
    """Whether the statement is an INSERT into `customer` whose column list names `vip`,
    or an UPDATE of `customer` whose SET clause assigns it. A `vip` in a WHERE or a
    RETURNING clause is a read, not a write."""
    inserted = _INSERT.match(statement)
    if inserted is not None:
        return any(c.strip().strip('"').lower() == "vip" for c in inserted["columns"].split(","))
    updated = _UPDATE.match(statement)
    if updated is None:
        return False
    rest = updated["rest"]
    while _NESTED.search(rest):
        rest = _NESTED.sub("", rest)
    assignments = re.split(r"\s+(?:WHERE|RETURNING)\b", rest, maxsplit=1, flags=re.IGNORECASE)[0]
    return bool(_ASSIGNS_VIP.search(assignments))


@pytest.fixture
def statements(engine: Engine) -> Iterator[list[str]]:
    """Every statement the engine runs, from before the first business is opened."""
    seen: list[str] = []

    def record(*args: Any) -> None:
        seen.append(args[2])

    event.listen(engine, "before_cursor_execute", record)
    yield seen
    event.remove(engine, "before_cursor_execute", record)


def test_the_recorder_flags_a_statement_that_writes_the_column() -> None:
    assert writes_the_vip_column("INSERT INTO customer (business_id, name, vip) VALUES (?, ?, ?)")
    assert writes_the_vip_column("UPDATE customer SET vip=? WHERE customer.id = ?")
    assert not writes_the_vip_column("INSERT INTO customer (business_id, name) VALUES (?, ?)")
    assert not writes_the_vip_column("UPDATE customer SET name=? WHERE customer.id = ?")
    assert not writes_the_vip_column("SELECT customer.vip FROM customer")
    # A `vip` that is only read: the migration's WHERE and an INSERT's RETURNING.
    assert not writes_the_vip_column(
        "UPDATE customer SET customer_type_id = (SELECT id FROM customer_type WHERE x = 1)"
        " WHERE vip = 1"
    )
    assert not writes_the_vip_column(
        "INSERT INTO customer (business_id, name) VALUES (?, ?) RETURNING id, vip"
    )


@pytest.mark.parametrize("switch_on", [True, False])
def test_creating_and_editing_a_customer_never_writes_the_column(
    statements: list[str], client: TestClient, switch_on: bool
) -> None:
    client.put("/pricing-settings", json={"is_bulk_pricing": False, "is_vip_customers": switch_on})
    kind = client.post("/api/customer-types", json={"name": "Friends"}).json()

    # A body that still sends the old `vip` is ignored like any extra field.
    created = client.post(
        "/customers",
        json={"name": "Ana", "phone": None, "customer_type_id": kind["id"], "vip": True},
    )
    edited = client.patch(
        f"/customers/{created.json()['id']}",
        json={"name": "Ana B", "customer_type_id": None, "vip": True},
    )

    assert (created.status_code, edited.status_code) == (201, 200)
    assert statements, "the recorder saw nothing"
    assert [s for s in statements if writes_the_vip_column(s)] == []


def test_the_spreadsheet_import_never_writes_the_column(
    statements: list[str],
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
    tmp_path: Path,
    operator_text_en: OperatorText,
) -> None:
    workbook = _workbook()
    workbook["Ventas"].cell(row=2, column=7, value="Amigo")
    xlsx = _save_workbook(workbook, tmp_path)
    mapping = _save_mapping(tmp_path, ((CUSTOMER, PHONE),))
    err = io.StringIO()

    code = run(
        [str(_business_id(engine)), str(xlsx), "--mapping", str(mapping)],
        engine=engine,
        clock=clock,
        out=io.StringIO(),
        err=err,
        text=operator_text_en,
    )

    assert code == 0, err.getvalue()
    assert any(s.lstrip().upper().startswith("INSERT INTO CUSTOMER ") for s in statements)
    assert [s for s in statements if writes_the_vip_column(s)] == []


def test_opening_a_business_never_writes_the_column(
    statements: list[str], client: TestClient
) -> None:
    # `client` opens a business; the recorder was listening before it did.
    assert any("business" in s.lower() for s in statements)
    assert [s for s in statements if writes_the_vip_column(s)] == []
