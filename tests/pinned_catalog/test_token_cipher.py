"""`TokenCipher` (the plan's declared seam): round trip, and a decrypt under the wrong
key raising `InvalidToken` rather than silently returning garbage — the settings
repository, not the cipher, is where that becomes "no token saved" (CODING_STANDARDS
§9)."""

import pytest
from cryptography.fernet import InvalidToken

from app.pinned_catalog.adapters.token_cipher import TokenCipher


def test_a_token_decrypts_back_to_itself() -> None:
    cipher = TokenCipher("one-secret-key")

    ciphertext = cipher.encrypt("123456:abcDEF")

    assert cipher.decrypt(ciphertext) == "123456:abcDEF"


def test_the_ciphertext_never_contains_the_plain_token() -> None:
    cipher = TokenCipher("one-secret-key")

    ciphertext = cipher.encrypt("123456:abcDEF")

    assert b"123456:abcDEF" not in ciphertext


def test_a_different_secret_key_fails_to_decrypt() -> None:
    saved_under = TokenCipher("one-secret-key")
    read_under = TokenCipher("a-different-secret-key")

    ciphertext = saved_under.encrypt("123456:abcDEF")

    with pytest.raises(InvalidToken):
        read_under.decrypt(ciphertext)


def test_the_fingerprint_is_stable_for_the_same_token_and_key() -> None:
    cipher = TokenCipher("one-secret-key")

    assert cipher.fingerprint("123456:abcDEF") == cipher.fingerprint("123456:abcDEF")


def test_the_fingerprint_differs_for_a_different_token() -> None:
    cipher = TokenCipher("one-secret-key")

    assert cipher.fingerprint("123456:abcDEF") != cipher.fingerprint("999999:zzzZZZ")


def test_the_fingerprint_differs_under_a_different_secret_key() -> None:
    one = TokenCipher("one-secret-key")
    other = TokenCipher("a-different-secret-key")

    assert one.fingerprint("123456:abcDEF") != other.fingerprint("123456:abcDEF")
