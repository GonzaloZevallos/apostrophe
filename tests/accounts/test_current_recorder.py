"""`current_recorder` called directly, with a `SignedIn` built from domain values."""

from __future__ import annotations

import pytest

from app.accounts.adapters.deps import current_recorder
from app.accounts.application.sign_in import SignedIn
from app.accounts.domain.account import Business, BusinessName, Email, User
from app.shared.language import ENGLISH, BusinessLanguage
from app.shared.recorder import MAX_INITIALS, Recorder


def _signed_in(local: str) -> SignedIn:
    user = Email(f"{local}@x.co")
    return SignedIn(
        User(business_id=3, email=user, password_hash="x", id=7),
        Business(BusinessName("La Flor"), BusinessLanguage(ENGLISH), None, id=3),
    )


def test_a_plain_user_gets_their_initials_and_their_id() -> None:
    assert current_recorder(_signed_in("zeta")) == Recorder(7, "ZE")


@pytest.mark.parametrize(
    ("local", "initials"),
    [
        pytest.param("﻿", "?", id="feff-only"),
        pytest.param(".", ".", id="dot"),
        pytest.param("́", "́", id="lone-combining-mark"),
        pytest.param("😀" * 60, "😀😀", id="emoji-60"),
    ],
)
def test_awkward_emails_still_give_a_valid_recorder(local: str, initials: str) -> None:
    recorder = current_recorder(_signed_in(local))
    assert recorder.app_user_id == 7
    assert recorder.initials == initials
    assert 0 < len(recorder.initials) <= MAX_INITIALS
