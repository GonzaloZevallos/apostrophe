"""The Business logo value object: one rule, in `__post_init__`."""

from typing import Any

import pytest

from app.business_logo.domain.business_logo import (
    MAX_LOGO_BYTES,
    BusinessLogo,
    LogoNotFound,
    LogoTooBig,
    WrongLogoType,
)

PNG_HEADER = b"\x89PNG\r\n\x1a\n"
JPEG_HEADER = b"\xff\xd8\xff"


def test_max_logo_bytes_is_one_mebibyte() -> None:
    assert MAX_LOGO_BYTES == 1_048_576


def test_from_bytes_reads_a_jpeg_header() -> None:
    logo = BusinessLogo.from_bytes(JPEG_HEADER + b"\xe0rest")

    assert logo.content_type == "image/jpeg"
    assert logo.data == JPEG_HEADER + b"\xe0rest"


def test_from_bytes_reads_a_png_header() -> None:
    logo = BusinessLogo.from_bytes(PNG_HEADER + b"rest")

    assert logo.content_type == "image/png"


def test_from_bytes_refuses_html_text() -> None:
    with pytest.raises(WrongLogoType) as refusal:
        BusinessLogo.from_bytes(b"<html><body>not an image</body></html>")

    assert str(refusal.value) == "a business logo must be a PNG or JPEG image"


def test_from_bytes_refuses_an_empty_body() -> None:
    with pytest.raises(WrongLogoType):
        BusinessLogo.from_bytes(b"")


def test_a_body_of_exactly_the_cap_is_accepted() -> None:
    data = PNG_HEADER + b"x" * (MAX_LOGO_BYTES - len(PNG_HEADER))
    assert len(data) == MAX_LOGO_BYTES

    assert BusinessLogo.from_bytes(data).data == data


def test_a_body_one_byte_over_the_cap_is_too_big() -> None:
    data = PNG_HEADER + b"x" * (MAX_LOGO_BYTES + 1 - len(PNG_HEADER))

    with pytest.raises(LogoTooBig) as refusal:
        BusinessLogo.from_bytes(data)

    assert str(refusal.value) == "a business logo is bigger than the allowed size"


def test_a_png_label_over_jpeg_bytes_is_refused() -> None:
    with pytest.raises(WrongLogoType):
        BusinessLogo("image/png", JPEG_HEADER + b"rest")


def test_an_unknown_content_type_is_refused() -> None:
    with pytest.raises(WrongLogoType):
        BusinessLogo("image/gif", b"GIF89a")


def test_a_bytearray_body_is_refused() -> None:
    body: Any = bytearray(PNG_HEADER + b"rest")

    with pytest.raises(WrongLogoType):
        BusinessLogo("image/png", body)


def test_a_body_breaking_two_rules_answers_the_type_rule() -> None:
    with pytest.raises(WrongLogoType):
        BusinessLogo("image/png", b"<html>" + b"x" * MAX_LOGO_BYTES)


def test_a_body_that_is_only_a_signature_is_accepted() -> None:
    """Known limit: nothing decodes the image, so a bare signature is a logo."""
    assert BusinessLogo.from_bytes(JPEG_HEADER).content_type == "image/jpeg"
    assert BusinessLogo.from_bytes(PNG_HEADER).content_type == "image/png"


def test_each_error_carries_its_code() -> None:
    assert WrongLogoType.code == "business_logo.wrong_type"
    assert LogoTooBig.code == "business_logo.too_big"
    assert LogoNotFound.code == "business_logo.not_found"
    assert str(LogoNotFound()) == "the business has no logo"
