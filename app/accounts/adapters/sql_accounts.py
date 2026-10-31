from datetime import datetime

from sqlalchemy import case, delete, literal, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import (
    BusinessRow,
    InvitationRow,
    LoginAddressGuardRow,
    LoginGuardRow,
    ResetLinkRow,
    UserRow,
)
from app.accounts.application.ports import LoginLocks
from app.accounts.domain.account import (
    Business,
    BusinessName,
    BusinessTimeZone,
    Email,
    StoredLanguageCorrupt,
    User,
)
from app.accounts.domain.invitation import Invitation, InvitationKind
from app.shared.language import BusinessLanguage, InvalidLanguageTag, Language


class SqlAccounts:
    """The `Accounts` port over SQLAlchemy. Flushes, never commits."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def add_business(self, business: Business) -> Business:
        row = BusinessRow(
            name=business.name.value,
            language=business.language.language.tag,
            time_zone=business.time_zone.name,
        )
        self._session.add(row)
        self._session.flush()
        return Business(business.name, business.language, business.time_zone, row.id)

    def business(self, business_id: int) -> Business | None:
        row = self._session.get(BusinessRow, business_id)
        if row is None:
            return None
        # Never `BusinessLanguage.parse`: a well-formed tag that is no longer selectable
        # still loads and stays as it is.
        try:
            language = BusinessLanguage(Language(row.language))
        except InvalidLanguageTag:
            raise StoredLanguageCorrupt from None
        return Business(BusinessName(row.name), language, BusinessTimeZone(row.time_zone), row.id)

    def save_business(self, business: Business) -> None:
        assert business.id is not None
        row = self._session.get_one(BusinessRow, business.id)
        row.name = business.name.value
        row.language = business.language.language.tag
        # `time_zone` is not written: the zone changes only through its own conditional
        # UPDATE, so a rename or a language change from a stale read never undoes it.
        self._session.flush()

    def set_time_zone_if_different(self, business_id: int, zone: BusinessTimeZone) -> bool:
        statement = (
            update(BusinessRow)
            .where(BusinessRow.id == business_id, BusinessRow.time_zone != zone.name)
            .values(time_zone=zone.name)
        )
        result = self._session.execute(statement)
        assert isinstance(result, CursorResult)
        self._session.flush()
        return result.rowcount > 0

    def add_user(self, user: User) -> User:
        row = UserRow(
            business_id=user.business_id,
            email=user.email.value,
            password_hash=user.password_hash,
            joined_at=user.joined_at,
        )
        self._session.add(row)
        self._session.flush()
        return _user(row)

    def users_of_business(self, business_id: int) -> list[User]:
        statement = (
            select(UserRow).where(UserRow.business_id == business_id).order_by(UserRow.email)
        )
        return [_user(row) for row in self._session.scalars(statement)]

    def user(self, user_id: int) -> User | None:
        row = self._session.get(UserRow, user_id)
        return None if row is None else _user(row)

    def user_by_email(self, email: Email) -> User | None:
        row = self._session.scalar(select(UserRow).where(UserRow.email == email.value))
        return None if row is None else _user(row)

    def add_invitation(self, invitation: Invitation) -> Invitation:
        row = InvitationRow(
            kind=invitation.kind.value,
            token_digest=invitation.token_digest,
            business_id=invitation.business_id,
            created_at=invitation.created_at,
            used_at=invitation.used_at,
        )
        self._session.add(row)
        self._session.flush()
        return _invitation(row)

    def invitation_by_digest(self, digest: str) -> Invitation | None:
        statement = select(InvitationRow).where(InvitationRow.token_digest == digest)
        row = self._session.scalar(statement)
        return None if row is None else _invitation(row)

    def save_invitation(self, invitation: Invitation) -> None:
        assert invitation.id is not None
        row = self._session.get_one(InvitationRow, invitation.id)
        row.used_at = invitation.used_at
        row.business_id = invitation.business_id
        self._session.flush()

    def login_locks(self, email: Email | None, address_digest: str) -> LoginLocks:
        email_locked_until = None
        if email is not None:
            email_row = self._session.get(LoginGuardRow, email.value)
            email_locked_until = None if email_row is None else email_row.locked_until
        address_row = self._session.get(LoginAddressGuardRow, address_digest)
        address_locked_until = None if address_row is None else address_row.locked_until
        return LoginLocks(email_locked_until, address_locked_until)

    def count_email_failure(self, email: Email, now: datetime) -> int:
        # One atomic upsert with RETURNING (plan invariant): never a read followed by
        # a save, so two failures that arrive together are both counted.
        insert_statement = sqlite_insert(LoginGuardRow).values(email=email.value, failures=1)
        statement = insert_statement.on_conflict_do_update(
            index_elements=["email"],
            set_={"failures": LoginGuardRow.failures + 1},
        ).returning(LoginGuardRow.failures)
        failures = self._session.execute(statement).scalar_one()
        self._session.flush()
        return failures

    def count_address_failure(self, address_digest: str, now: datetime, cutoff: datetime) -> int:
        # The address window resets inside the same statement (plan invariant): a
        # window that started at or before `cutoff` has expired, so this failure
        # starts a fresh one instead of extending the old count.
        expired = LoginAddressGuardRow.window_start <= cutoff
        insert_statement = sqlite_insert(LoginAddressGuardRow).values(
            address_digest=address_digest, failures=1, window_start=now
        )
        statement = insert_statement.on_conflict_do_update(
            index_elements=["address_digest"],
            set_={
                "failures": case((expired, 1), else_=LoginAddressGuardRow.failures + 1),
                "window_start": case((expired, now), else_=LoginAddressGuardRow.window_start),
            },
        ).returning(LoginAddressGuardRow.failures)
        failures = self._session.execute(statement).scalar_one()
        self._session.flush()
        return failures

    def lock_email(self, email: Email, now: datetime, until: datetime, max_failures: int) -> None:
        # Guarded on (locked_until IS NULL OR locked_until <= now) (plan invariant):
        # two requests that both reach the threshold set the lock only once, and
        # counting during an active lock never stretches it. Subtracts the threshold
        # rather than setting a constant, so failures counted during the lock stay in
        # force once it opens.
        statement = (
            update(LoginGuardRow)
            .where(
                LoginGuardRow.email == email.value,
                (LoginGuardRow.locked_until.is_(None)) | (LoginGuardRow.locked_until <= now),
            )
            .values(locked_until=until, failures=LoginGuardRow.failures - max_failures)
        )
        self._session.execute(statement)
        self._session.flush()

    def lock_address(self, address_digest: str, now: datetime, until: datetime) -> None:
        statement = (
            update(LoginAddressGuardRow)
            .where(
                LoginAddressGuardRow.address_digest == address_digest,
                (LoginAddressGuardRow.locked_until.is_(None))
                | (LoginAddressGuardRow.locked_until <= now),
            )
            .values(locked_until=until)
        )
        self._session.execute(statement)
        self._session.flush()

    def clear_email(self, email: Email, now: datetime) -> None:
        # Guarded the same way a lock is set (plan invariant): a lock already active
        # — set by a request that raced ahead of the one now succeeding — must not be
        # lifted, nor its count zeroed, by a read that is stale by the time this
        # writes.
        statement = (
            update(LoginGuardRow)
            .where(
                LoginGuardRow.email == email.value,
                (LoginGuardRow.locked_until.is_(None)) | (LoginGuardRow.locked_until <= now),
            )
            .values(failures=0, locked_until=None)
        )
        self._session.execute(statement)
        self._session.flush()

    def unlock_email(self, email: Email) -> None:
        # Unguarded (docs/adr/0019): only a completed Reset calls this, and it must
        # lift an active lock, not merely fail to stretch one.
        statement = (
            update(LoginGuardRow)
            .where(LoginGuardRow.email == email.value)
            .values(failures=0, locked_until=None)
        )
        self._session.execute(statement)
        self._session.flush()

    def set_password_hash(self, user_id: int, password_hash: str) -> None:
        statement = (
            update(UserRow).where(UserRow.id == user_id).values(password_hash=password_hash)
        )
        self._session.execute(statement)
        self._session.flush()

    def issue_reset_link(self, user_id: int, token_digest: str, created_at: datetime) -> None:
        # One upsert whose business comes from the user's own row (docs/adr/0019):
        # this port takes no `business_id` of its own.
        select_statement = select(
            UserRow.business_id, UserRow.id, literal(token_digest), literal(created_at)
        ).where(UserRow.id == user_id)
        insert_statement = sqlite_insert(ResetLinkRow).from_select(
            ["business_id", "user_id", "token_digest", "created_at"], select_statement
        )
        statement = insert_statement.on_conflict_do_update(
            index_elements=["user_id"],
            set_={
                "token_digest": insert_statement.excluded.token_digest,
                "created_at": insert_statement.excluded.created_at,
            },
        ).returning(ResetLinkRow.id)
        row = self._session.execute(statement).first()
        self._session.flush()
        if row is None:
            raise UnknownUser(user_id)

    def reset_link_is_live(self, token_digest: str, cutoff: datetime) -> bool:
        statement = select(ResetLinkRow.id).where(
            ResetLinkRow.token_digest == token_digest, ResetLinkRow.created_at > cutoff
        )
        return self._session.scalar(statement) is not None

    def spend_reset_link(self, token_digest: str, cutoff: datetime) -> int | None:
        statement = (
            delete(ResetLinkRow)
            .where(ResetLinkRow.token_digest == token_digest, ResetLinkRow.created_at > cutoff)
            .returning(ResetLinkRow.user_id)
        )
        row = self._session.execute(statement).first()
        self._session.flush()
        return None if row is None else int(row[0])

    def delete_reset_links_of(self, user_id: int) -> None:
        statement = delete(ResetLinkRow).where(ResetLinkRow.user_id == user_id)
        self._session.execute(statement)
        self._session.flush()


class UnknownUser(Exception):
    """`issue_reset_link` was asked for a user id that names no `app_user` row. The
    application layer only ever calls it with the id of a user it just looked up, so
    reaching this is a bug, not a request a caller can trigger."""

    def __init__(self, user_id: int) -> None:
        super().__init__(f"no user with id {user_id}")


def _user(row: UserRow) -> User:
    return User(row.business_id, Email(row.email), row.password_hash, row.id, row.joined_at)


def _invitation(row: InvitationRow) -> Invitation:
    return Invitation(
        kind=InvitationKind(row.kind),
        token_digest=row.token_digest,
        created_at=row.created_at,
        business_id=row.business_id,
        used_at=row.used_at,
        id=row.id,
    )
