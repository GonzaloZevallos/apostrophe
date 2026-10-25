"""A new business starts in the language of the phone that accepted its invitation, among
the selectable ones, or in English (docs/adr/0050). Selectable `en` and `de`, read back
through `GET /business` once signed in."""

from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_partner
from app.settings import Settings
from app.shared.language import ENGLISH, Language
from tests.conftest import PASSWORD, SETTINGS, MovableClock, invite, signed_in

LOCALES = Path(__file__).resolve().parent.parent / "fixtures" / "locales"


@pytest.fixture
def settings() -> Settings:
    return replace(SETTINGS, selectable_languages=(ENGLISH, Language("de")), locales_dir=LOCALES)


def _accept(
    client: TestClient, token: str, email: str, header: str | None, name: str | None
) -> TestClient:
    headers = {} if header is None else {"Accept-Language": header}
    body = {"email": email, "password": PASSWORD, "business_name": name}
    accepted = client.post(f"/invitations/{token}/accept", json=body, headers=headers)
    assert accepted.status_code == 201, accepted.text
    client.cookies.clear()
    return signed_in(client, accepted.json()["token"])


def _opened_with(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock, header: str | None
) -> str:
    signed = _accept(
        anonymous_client, invite(engine, clock()), "uno@example.com", header, "Primer Negocio"
    )
    language: str = signed.get("/business").json()["language"]
    return language


@pytest.mark.parametrize(
    ("header", "stored"),
    [
        ("de", "de"),
        ("de-DE,de;q=0.9", "de"),
        ("fr", "en"),
        ("*", "en"),
        ("de;q=oops;;;", "en"),
        ("\x00\x01 bad", "en"),
        (None, "en"),
        ("en-XA", "en"),
    ],
)
def test_a_new_business_starts_in_the_language_of_the_accepting_phone(
    anonymous_client: TestClient,
    engine: Engine,
    clock: MovableClock,
    header: str | None,
    stored: str,
) -> None:
    assert _opened_with(anonymous_client, engine, clock, header) == stored


def test_a_join_invitation_leaves_the_inviting_business_language_as_it_was(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    owner = _accept(
        anonymous_client, invite(engine, clock()), "uno@example.com", "de", "Primer Negocio"
    )
    assert owner.put("/business/language", json={"language": "en"}).status_code == 200
    business_id = _business_id(engine)
    with Session(engine) as session:
        token = invite_partner(SqlAccounts(session), session, business_id, clock()).token

    partner = _accept(anonymous_client, token, "dos@example.com", "de", None)

    assert partner.get("/business").json()["language"] == "en"


def _business_id(engine: Engine) -> int:
    with engine.connect() as connection:
        found: int = connection.execute(text("select id from business")).scalar_one()
    return found
