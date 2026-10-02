"""Passwords, session tokens, invitations and the login brake, with no infrastructure."""

from datetime import UTC, datetime, timedelta

import pytest

from app.accounts.domain.account import (
    BusinessName,
    Email,
    InvalidBusinessName,
    InvalidEmail,
    WeakPassword,
    check_password_strength,
)
from app.accounts.domain.invitation import (
    Invitation,
    InvitationKind,
    InvitationNotUsable,
    token_digest,
)
from app.accounts.domain.login_guard import LoginGuard
from app.accounts.domain.password import PasswordHasher, ScryptParams
from app.accounts.domain.session_token import SessionSigner

NOW = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
CHEAP = PasswordHasher(ScryptParams(n=16, r=1, p=1))


def test_an_email_is_trimmed_and_lowercased() -> None:
    assert Email.of("  Uno@Example.COM ").value == "uno@example.com"


@pytest.mark.parametrize("raw", ["", "uno", "uno@", "@example.com", "uno@example", "u no@x.com"])
def test_anything_else_is_not_an_email(raw: str) -> None:
    with pytest.raises(InvalidEmail):
        Email.of(raw)


def test_a_business_needs_a_short_name() -> None:
    assert BusinessName.of("  La   Huerta ").value == "La Huerta"
    with pytest.raises(InvalidBusinessName):
        BusinessName.of("   ")
    with pytest.raises(InvalidBusinessName):
        BusinessName.of("x" * 61)


def test_a_password_has_at_least_ten_characters() -> None:
    check_password_strength("0123456789")
    with pytest.raises(WeakPassword):
        check_password_strength("012345678")


def test_a_password_hash_verifies_only_its_password_and_never_contains_it() -> None:
    stored = CHEAP.hash("correct horse")

    assert "correct horse" not in stored
    assert CHEAP.verify("correct horse", stored)
    assert not CHEAP.verify("wrong horse", stored)
    assert not CHEAP.verify("correct horse", "not a hash")


def test_a_hash_keeps_verifying_after_the_parameters_change() -> None:
    stored = CHEAP.hash("correct horse")

    assert PasswordHasher(ScryptParams(n=32, r=1, p=1)).verify("correct horse", stored)


def test_a_session_token_names_its_user_and_closes_when_the_password_changes() -> None:
    signer = SessionSigner("secret")
    token = signer.issue(7, "hash-1", NOW)

    claims = signer.read(token)

    assert claims is not None and claims.user_id == 7
    assert signer.is_open(claims, "hash-1", NOW)
    assert not signer.is_open(claims, "hash-2", NOW)


def test_a_session_token_lasts_thirty_days() -> None:
    signer = SessionSigner("secret")
    claims = signer.read(signer.issue(7, "hash", NOW))
    assert claims is not None

    assert signer.is_open(claims, "hash", NOW + timedelta(days=30))
    assert not signer.is_open(claims, "hash", NOW + timedelta(days=30, seconds=1))


def test_a_token_signed_with_another_key_or_tampered_is_not_read() -> None:
    token = SessionSigner("secret").issue(7, "hash", NOW)

    assert SessionSigner("other secret").read(token) is None
    assert SessionSigner("secret").read(token[:-1] + ("0" if token[-1] != "0" else "1")) is None
    assert SessionSigner("secret").read("garbage") is None


def test_an_invitation_works_once_within_seven_days() -> None:
    invitation = Invitation(InvitationKind.NEW_BUSINESS, token_digest("t"), NOW)

    assert not invitation.is_usable(NOW + timedelta(days=7))
    invitation.use(NOW + timedelta(days=6))
    with pytest.raises(InvitationNotUsable):
        invitation.use(NOW + timedelta(days=6))


def test_a_join_invitation_names_its_business_and_a_new_business_one_does_not() -> None:
    with pytest.raises(ValueError):
        Invitation(InvitationKind.JOIN_BUSINESS, token_digest("t"), NOW)
    with pytest.raises(ValueError):
        Invitation(InvitationKind.NEW_BUSINESS, token_digest("t"), NOW, business_id=1)


def test_five_failures_in_a_row_lock_for_fifteen_minutes() -> None:
    guard = LoginGuard()
    for _ in range(4):
        guard.record_failure(NOW)
    assert not guard.is_locked(NOW)

    guard.record_failure(NOW)

    assert guard.is_locked(NOW + timedelta(minutes=14, seconds=59))
    assert not guard.is_locked(NOW + timedelta(minutes=15))


def test_a_success_resets_the_count() -> None:
    guard = LoginGuard()
    for _ in range(4):
        guard.record_failure(NOW)

    guard.record_success()
    guard.record_failure(NOW)

    assert not guard.is_locked(NOW)
