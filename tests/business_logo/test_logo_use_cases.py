"""The Business logo use cases over the in-memory repository."""

import pytest

from app.business_logo.application.logo import read_logo, remove_logo, upload_logo
from app.business_logo.domain.business_logo import (
    MAX_LOGO_BYTES,
    BusinessLogo,
    LogoNotFound,
    LogoTooBig,
    WrongLogoType,
)
from tests.fakes.business_logo import InMemoryBusinessLogoRepository
from tests.fakes.transaction import RecordingTransaction

PNG = b"\x89PNG\r\n\x1a\nfirst"
JPEG = b"\xff\xd8\xff\xe0second"


def test_an_upload_stores_the_logo_and_commits_once() -> None:
    logos = InMemoryBusinessLogoRepository()
    tx = RecordingTransaction()

    logo = upload_logo(logos, tx, PNG)

    assert logo == BusinessLogo("image/png", PNG)
    assert logos.get() == logo
    assert (tx.commits, tx.rollbacks) == (1, 0)


def test_a_second_upload_replaces_the_first() -> None:
    logos = InMemoryBusinessLogoRepository()
    tx = RecordingTransaction()
    upload_logo(logos, tx, PNG)

    upload_logo(logos, tx, JPEG)

    assert logos.get() == BusinessLogo("image/jpeg", JPEG)
    assert (tx.commits, tx.rollbacks) == (2, 0)


def test_read_returns_the_stored_logo_without_committing() -> None:
    stored = BusinessLogo("image/png", PNG)

    assert read_logo(InMemoryBusinessLogoRepository(stored)) == stored


def test_read_with_no_logo_is_not_found() -> None:
    with pytest.raises(LogoNotFound) as refusal:
        read_logo(InMemoryBusinessLogoRepository())

    assert str(refusal.value) == "the business has no logo"


def test_remove_deletes_the_logo_and_commits_once() -> None:
    logos = InMemoryBusinessLogoRepository(BusinessLogo("image/png", PNG))
    tx = RecordingTransaction()

    remove_logo(logos, tx)

    assert logos.get() is None
    assert (tx.commits, tx.rollbacks) == (1, 0)


def test_remove_with_no_logo_is_not_found_and_does_not_commit() -> None:
    tx = RecordingTransaction()

    with pytest.raises(LogoNotFound):
        remove_logo(InMemoryBusinessLogoRepository(), tx)

    assert (tx.commits, tx.rollbacks) == (0, 0)


def test_html_bytes_are_refused_and_keep_the_previous_logo() -> None:
    previous = BusinessLogo("image/png", PNG)
    logos = InMemoryBusinessLogoRepository(previous)
    tx = RecordingTransaction()

    with pytest.raises(WrongLogoType):
        upload_logo(logos, tx, b"<html>not an image</html>")

    assert logos.get() == previous
    assert (tx.commits, tx.rollbacks) == (0, 0)


def test_one_byte_over_the_cap_is_refused_and_keeps_the_previous_logo() -> None:
    previous = BusinessLogo("image/jpeg", JPEG)
    logos = InMemoryBusinessLogoRepository(previous)
    tx = RecordingTransaction()
    header = b"\x89PNG\r\n\x1a\n"

    with pytest.raises(LogoTooBig):
        upload_logo(logos, tx, header + b"x" * (MAX_LOGO_BYTES + 1 - len(header)))

    assert logos.get() == previous
    assert (tx.commits, tx.rollbacks) == (0, 0)
