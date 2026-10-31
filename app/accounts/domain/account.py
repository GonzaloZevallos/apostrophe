"""Businesses, users and the values they are made of (CONTEXT.md: Business, User)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.shared.language import BusinessLanguage

BUSINESS_NAME_MAX_LENGTH = 60
EMAIL_MAX_LENGTH = 254
MIN_PASSWORD_LENGTH = 10


class AccountRuleBroken(ValueError):
    """A rule of businesses and users was broken; the message says which."""

    code: ClassVar[str] = "account.rule_broken"


class InvalidEmail(AccountRuleBroken):
    code: ClassVar[str] = "account.email_invalid"


class InvalidBusinessName(AccountRuleBroken):
    code: ClassVar[str] = "account.business_name_invalid"


class WeakPassword(AccountRuleBroken):
    code: ClassVar[str] = "account.password_weak"


class UnknownTimeZone(AccountRuleBroken):
    """The name is not one of the zones a business may choose (`accepted_time_zones`). The
    message is the fixed rule: it never echoes the name."""

    code: ClassVar[str] = "unknown_time_zone"


@dataclass(frozen=True)
class Email:
    """Lowercased and trimmed, so the same address typed twice is the same address."""

    value: str

    def __post_init__(self) -> None:
        local, at, domain = self.value.partition("@")
        if (
            not at
            or not local
            or "." not in domain.strip(".")
            or "@" in domain
            or any(c.isspace() for c in self.value)
            or self.value != self.value.lower()
            or len(self.value) > EMAIL_MAX_LENGTH
        ):
            # No address in the message (docs/adr/0008; CODING_STANDARDS §9): an email
            # never reaches a log or an error body.
            raise InvalidEmail("that is not an email address")

    @classmethod
    def of(cls, raw: str) -> Email:
        return cls(raw.strip().lower())


@dataclass(frozen=True)
class BusinessName:
    value: str

    def __post_init__(self) -> None:
        if not self.value or self.value != " ".join(self.value.split()):
            raise InvalidBusinessName("a business needs a name, without extra spaces")
        if len(self.value) > BUSINESS_NAME_MAX_LENGTH:
            raise InvalidBusinessName(
                f"a business name has at most {BUSINESS_NAME_MAX_LENGTH} characters"
            )

    @classmethod
    def of(cls, raw: str) -> BusinessName:
        return cls(" ".join(raw.split()))


def check_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise WeakPassword(f"a password has at least {MIN_PASSWORD_LENGTH} characters")


class StoredLanguageCorrupt(RuntimeError):
    """A business's stored language is not a language tag. A broken row, not a broken
    request: it is no `AccountRuleBroken`, so it never maps to a refusal. The message
    never carries the stored value."""

    def __init__(self) -> None:
        super().__init__("a business's stored language is not a language tag")


class TimeZoneUnavailable(RuntimeError):
    """A business's stored time zone cannot be loaded from the installed IANA data: a
    broken row, not a broken request. It never falls back to another zone, so the one
    business is refused (500) and no other is touched. The message never carries the
    stored value."""

    code: ClassVar[str] = "time_zone_unavailable"

    def __init__(self) -> None:
        super().__init__("this business's stored time zone cannot be loaded")


@dataclass(frozen=True)
class BusinessTimeZone:
    """The IANA name of the zone a business's days are counted in (docs/adr/0057). Only
    non-blank is checked here: whether the name is a zone the installed data can load is
    `app.shared.calendar.load_zone`'s question, answered where the zone is used."""

    name: str

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("a business time zone needs a name")


DEFAULT_TIME_ZONE = BusinessTimeZone("America/Argentina/Buenos_Aires")


@dataclass(frozen=True)
class Business:
    """`language` and `time_zone` are required with no default: every write starts from
    the stored business (`dataclasses.replace`), so a write never resets either."""

    name: BusinessName
    language: BusinessLanguage
    time_zone: BusinessTimeZone
    id: int | None = None


@dataclass(frozen=True)
class User:
    """Works on exactly one business, for good: there is no way to move a user."""

    business_id: int
    email: Email
    password_hash: str
    id: int | None = None
    joined_at: datetime | None = None
