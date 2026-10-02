"""Businesses, users and the values they are made of (CONTEXT.md: Business, User)."""

from __future__ import annotations

from dataclasses import dataclass

BUSINESS_NAME_MAX_LENGTH = 60
EMAIL_MAX_LENGTH = 254
MIN_PASSWORD_LENGTH = 10


class AccountRuleBroken(ValueError):
    """A rule of businesses and users was broken; the message says which."""


class InvalidEmail(AccountRuleBroken):
    pass


class InvalidBusinessName(AccountRuleBroken):
    pass


class WeakPassword(AccountRuleBroken):
    pass


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
            raise InvalidEmail(f"{self.value!r} is not an email address")

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


@dataclass(frozen=True)
class Business:
    name: BusinessName
    id: int | None = None


@dataclass(frozen=True)
class User:
    """Works on exactly one business, for good: there is no way to move a user."""

    business_id: int
    email: Email
    password_hash: str
    id: int | None = None
