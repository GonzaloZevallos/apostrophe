"""What the app reads from its environment (app/settings.py), with no HTTP and no
database: the `Secure`-cookie decision, the trusted-proxy list and the two ways
`Settings` refuses to be built.
"""

import pytest

from app.settings import InvalidSetting, MissingSetting, Settings


def test_https_with_no_trusted_proxies_is_refused() -> None:
    with pytest.raises(MissingSetting) as excinfo:
        Settings(secret_key="k", public_url="https://example.com")

    assert "APOSTROPHE_TRUSTED_PROXIES" in str(excinfo.value)


def test_http_with_no_trusted_proxies_is_accepted() -> None:
    settings = Settings(secret_key="k", public_url="http://example.com")

    assert settings.trusted_proxies == ()


def test_https_with_trusted_proxies_is_accepted() -> None:
    settings = Settings(
        secret_key="k", public_url="https://example.com", trusted_proxies=("10.0.0.0/8",)
    )

    assert settings.secure_cookie is True


def test_an_unparsable_cidr_is_refused_and_the_message_names_the_setting_not_the_value() -> None:
    with pytest.raises(InvalidSetting) as excinfo:
        Settings(secret_key="k", trusted_proxies=("not-a-cidr",))

    message = str(excinfo.value)
    assert "APOSTROPHE_TRUSTED_PROXIES" in message
    assert "not-a-cidr" not in message


def test_secure_cookie_is_true_only_under_https() -> None:
    assert Settings(secret_key="k", public_url="http://example.com").secure_cookie is False
    assert (
        Settings(
            secret_key="k", public_url="https://example.com", trusted_proxies=("10.0.0.0/8",)
        ).secure_cookie
        is True
    )
