"""`settings_from_row` (the plan's declared seam, "wrong key reads as no token"): the
one place `InvalidToken` is caught, so a secret-key rotation is read as "no token
saved" rather than as an error — exercised directly over a row saved under one
`TokenCipher` and read under another, never only through the cipher's own round trip.
"""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pinned_catalog.adapters.sql_settings import SqlSettingsWriter, settings_from_row
from app.pinned_catalog.adapters.tables import PinnedCatalogRow
from app.pinned_catalog.adapters.token_cipher import TokenCipher


def _business(engine: Engine) -> int:
    with Session(engine) as session:
        business = BusinessRow(name="a business")
        session.add(business)
        session.commit()
        return business.id


def _row_for(engine: Engine, business_id: int) -> PinnedCatalogRow | None:
    with Session(engine) as session:
        return session.scalar(
            select(PinnedCatalogRow).where(PinnedCatalogRow.business_id == business_id)
        )


def test_a_token_saved_under_one_key_and_read_under_another_is_no_token_saved(
    client: TestClient, engine: Engine
) -> None:
    # `client` only to have the app's lifespan run the migrations on `engine` before
    # this test writes to it directly; its own signed-in business is unused.
    business_id = _business(engine)
    saved_under = TokenCipher("one-secret-key")
    read_under = TokenCipher("a-different-secret-key")
    writer = SqlSettingsWriter(engine, saved_under)

    writer.save(business_id, "123456:abcDEF", "111", "@canal", date(2026, 8, 12))

    row = _row_for(engine, business_id)
    settings = settings_from_row(row, read_under)

    assert settings.token is None
    assert settings.token_fingerprint is None
    assert settings.token_saved_on is None
    # Unaffected by the key change — only the token itself, never the chats, is
    # confused by a secret-key rotation (the plan's invariant).
    assert settings.own_chat == "111"
    assert settings.channel_chat == "@canal"


def test_the_same_key_reads_the_token_back(client: TestClient, engine: Engine) -> None:
    business_id = _business(engine)
    cipher = TokenCipher("one-secret-key")
    writer = SqlSettingsWriter(engine, cipher)

    writer.save(business_id, "123456:abcDEF", "111", "@canal", date(2026, 8, 12))

    row = _row_for(engine, business_id)
    settings = settings_from_row(row, cipher)

    assert settings.token == "123456:abcDEF"
    assert settings.token_saved_on == date(2026, 8, 12)
