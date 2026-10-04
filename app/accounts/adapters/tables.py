"""The platform tables: the only tables without a `business_id` of their own
(tests/migrations/test_business_ownership.py lists them)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.accounts.domain.account import BUSINESS_NAME_MAX_LENGTH, EMAIL_MAX_LENGTH
from app.db import Base, UtcDateTime


class BusinessRow(Base):
    __tablename__ = "business"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(BUSINESS_NAME_MAX_LENGTH))


class UserRow(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id"))
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    joined_at: Mapped[datetime | None] = mapped_column(UtcDateTime)


class InvitationRow(Base):
    __tablename__ = "invitation"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20))
    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    # Null for a new-business invitation: the business does not exist yet.
    business_id: Mapped[int | None] = mapped_column(ForeignKey("business.id"))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)
    used_at: Mapped[datetime | None] = mapped_column(UtcDateTime)


class LoginGuardRow(Base):
    __tablename__ = "login_guard"

    # Keyed by the email tried, known or not, so the brake never tells which exist.
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), primary_key=True)
    failures: Mapped[int]
    locked_until: Mapped[datetime | None] = mapped_column(UtcDateTime)


class LoginAddressGuardRow(Base):
    __tablename__ = "login_address_guard"

    # Keyed by the HMAC digest of the client address (app/accounts/adapters/deps.py),
    # never the raw IP: the brake only ever needs to tell two addresses apart. Like
    # `login_guard`, it decides who is let in rather than belonging to a business, so
    # it carries no `business_id` (tests/migrations/test_business_ownership.py).
    address_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    failures: Mapped[int]
    window_start: Mapped[datetime] = mapped_column(UtcDateTime)
    locked_until: Mapped[datetime | None] = mapped_column(UtcDateTime)
