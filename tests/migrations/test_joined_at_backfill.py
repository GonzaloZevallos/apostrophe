"""Migration 0007 backfills `app_user.joined_at` and the opened-business link from
spent invitations, pairing by count, never by guesswork (the plan's migration spec):
a matched opening invitation stamps the business and its first user; a count mismatch
leaves the rows NULL."""

from datetime import UTC, datetime

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import InvitationRow, UserRow
from app.db import make_engine
from app.migrations.runner import MIGRATIONS_ROOT, upgrade_to_head

OPENED_AT = datetime(2026, 1, 1, 12, 0)
JOINED_AT = datetime(2026, 1, 2, 12, 0)


def _upgrade_to(engine: Engine, revision: str) -> None:
    with engine.connect() as connection:
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, revision)


def _insert_business(engine: Engine, business_id: int, name: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name) VALUES (:id, :name)"),
            {"id": business_id, "name": name},
        )


def _insert_user(engine: Engine, user_id: int, business_id: int, email: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO app_user (id, business_id, email, password_hash) "
                "VALUES (:id, :business_id, :email, 'hash')"
            ),
            {"id": user_id, "business_id": business_id, "email": email},
        )


def _insert_invitation(
    engine: Engine,
    invitation_id: int,
    kind: str,
    digest: str,
    business_id: int | None,
    used_at: datetime | None,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO invitation "
                "(id, kind, token_digest, business_id, created_at, used_at) "
                "VALUES (:id, :kind, :digest, :business_id, :created, :used)"
            ),
            {
                "id": invitation_id,
                "kind": kind,
                "digest": digest,
                "business_id": business_id,
                "created": OPENED_AT,
                "used": used_at,
            },
        )


def test_a_matched_opening_invitation_stamps_the_business_and_its_first_user() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0006")
    _insert_business(engine, 1, "Sola")
    _insert_user(engine, 1, 1, "uno@example.com")
    _insert_invitation(engine, 1, "new_business", "digest-1", None, OPENED_AT)

    upgrade_to_head(engine)

    with Session(engine) as session:
        user = session.get(UserRow, 1)
        invitation = session.get(InvitationRow, 1)
        assert user is not None and user.joined_at == OPENED_AT.replace(tzinfo=UTC)
        assert invitation is not None and invitation.business_id == 1


def test_a_matched_join_invitation_stamps_the_remaining_user_within_its_business() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0006")
    _insert_business(engine, 1, "Sola")
    _insert_user(engine, 1, 1, "uno@example.com")
    _insert_user(engine, 2, 1, "socia@example.com")
    _insert_invitation(engine, 1, "new_business", "digest-1", None, OPENED_AT)
    _insert_invitation(engine, 2, "join_business", "digest-2", 1, JOINED_AT)

    upgrade_to_head(engine)

    with Session(engine) as session:
        owner = session.get(UserRow, 1)
        partner = session.get(UserRow, 2)
        assert owner is not None and owner.joined_at == OPENED_AT.replace(tzinfo=UTC)
        assert partner is not None and partner.joined_at == JOINED_AT.replace(tzinfo=UTC)


def test_a_count_mismatch_leaves_joined_at_and_the_business_link_null() -> None:
    engine = make_engine("sqlite://")
    _upgrade_to(engine, "0006")
    _insert_business(engine, 1, "Sola")
    _insert_business(engine, 2, "Otra")
    _insert_user(engine, 1, 1, "uno@example.com")
    _insert_user(engine, 2, 2, "dos@example.com")
    # Only one opening invitation for two businesses: the counts do not match.
    _insert_invitation(engine, 1, "new_business", "digest-1", None, OPENED_AT)

    upgrade_to_head(engine)

    with Session(engine) as session:
        assert session.get(UserRow, 1) is not None and session.get(UserRow, 1).joined_at is None
        assert session.get(UserRow, 2) is not None and session.get(UserRow, 2).joined_at is None
        invitation = session.get(InvitationRow, 1)
        assert invitation is not None and invitation.business_id is None
