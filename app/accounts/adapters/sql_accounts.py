from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow, InvitationRow, LoginGuardRow, UserRow
from app.accounts.domain.account import Business, BusinessName, Email, User
from app.accounts.domain.invitation import Invitation, InvitationKind
from app.accounts.domain.login_guard import LoginGuard


class SqlAccounts:
    """The `Accounts` port over SQLAlchemy. Flushes, never commits."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def add_business(self, business: Business) -> Business:
        row = BusinessRow(name=business.name.value)
        self._session.add(row)
        self._session.flush()
        return Business(business.name, row.id)

    def business(self, business_id: int) -> Business | None:
        row = self._session.get(BusinessRow, business_id)
        return None if row is None else Business(BusinessName(row.name), row.id)

    def save_business(self, business: Business) -> None:
        assert business.id is not None
        row = self._session.get_one(BusinessRow, business.id)
        row.name = business.name.value
        self._session.flush()

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

    def login_guard(self, email: Email) -> LoginGuard:
        row = self._session.get(LoginGuardRow, email.value)
        return LoginGuard() if row is None else LoginGuard(row.failures, row.locked_until)

    def save_login_guard(self, email: Email, guard: LoginGuard) -> None:
        row = self._session.get(LoginGuardRow, email.value)
        if row is None:
            row = LoginGuardRow(email=email.value)
            self._session.add(row)
        row.failures = guard.failures
        row.locked_until = guard.locked_until
        self._session.flush()


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
