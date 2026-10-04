"""`BusinessDirectory.name_of` (app/accounts/adapters/import_port.py), the spreadsheet
import's one way of naming its target business (ADR-0004): a known id and an unknown
one, over real SQLite — `SqlAccounts` built the same way `tests/accounts` already
builds it, never a row inserted by hand.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.import_port import BusinessDirectory
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.adapters.tables import UserRow


def _business_id_of(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == email))
        assert row is not None
        return row.business_id


def test_name_of_answers_the_business_name_of_a_known_id(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id_of(engine, "uno@example.com")

    with Session(engine) as session:
        directory = BusinessDirectory(SqlAccounts(session))
        name = directory.name_of(business_id)

    assert name == "Primer Negocio"


def test_name_of_answers_none_for_an_unknown_id(client: TestClient, engine: Engine) -> None:
    business_id = _business_id_of(engine, "uno@example.com")

    with Session(engine) as session:
        directory = BusinessDirectory(SqlAccounts(session))
        name = directory.name_of(business_id + 1_000)

    assert name is None
