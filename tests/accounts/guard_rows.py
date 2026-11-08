"""Reads of the login guard rows by their unique column, never by primary key: the `id`
carries no meaning (docs/adr/0077)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.accounts.adapters.deps import client_address
from app.accounts.adapters.tables import LoginAddressGuardRow, LoginGuardRow
from tests.conftest import SETTINGS


def address_digest_of(host: str) -> str:
    """The digest the app stores for a test client connecting from `host`, worked out by
    the app's own `client_address`."""
    request = Request({"type": "http", "client": (host, 12345), "headers": []})
    return client_address(request, SETTINGS)


def find_guard_row(session: Session, email: str) -> LoginGuardRow | None:
    return session.scalar(select(LoginGuardRow).where(LoginGuardRow.email == email))


def find_address_guard_row(session: Session, digest: str) -> LoginAddressGuardRow | None:
    return session.scalar(
        select(LoginAddressGuardRow).where(LoginAddressGuardRow.address_digest == digest)
    )


def guard_row(session: Session, email: str) -> LoginGuardRow:
    row = find_guard_row(session, email)
    if row is None:
        raise LookupError(f"no login_guard row for {email}")
    return row


def address_guard_row(session: Session, digest: str) -> LoginAddressGuardRow:
    row = find_address_guard_row(session, digest)
    if row is None:
        raise LookupError("no login_address_guard row for that digest")
    return row
