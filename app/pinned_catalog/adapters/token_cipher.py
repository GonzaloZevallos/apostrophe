"""The bot token at rest (CODING_STANDARDS §9: secrets are stored encrypted, keyed from
`APOSTROPHE_SECRET_KEY`). Fernet does the encryption; HKDF-SHA256 derives Fernet's own
key and the fingerprint's HMAC key from the one secret, each under its own label, so
raising a key for one purpose never reuses the other's.

Decryption failure (the secret key changed) is `cryptography.fernet.InvalidToken`,
raised here and never caught: CODING_STANDARDS' own rule ("a stored token that fails to
decrypt is read as no token saved, in the settings repository only") means the catch
lives in `app/pinned_catalog/adapters/sql_settings.py`, not here.
"""

from __future__ import annotations

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

KEY_LABEL = b"apostrophe/bot-token"
FINGERPRINT_LABEL = b"apostrophe/bot-token-fingerprint"
DERIVED_KEY_LENGTH = 32


def _derive(secret_key: str, label: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=DERIVED_KEY_LENGTH, salt=None, info=label).derive(
        secret_key.encode("utf-8")
    )


class TokenCipher:
    def __init__(self, secret_key: str) -> None:
        fernet_key = base64.urlsafe_b64encode(_derive(secret_key, KEY_LABEL))
        self._fernet = Fernet(fernet_key)
        self._fingerprint_key = _derive(secret_key, FINGERPRINT_LABEL)

    def encrypt(self, token: str) -> bytes:
        return self._fernet.encrypt(token.encode("utf-8"))

    def decrypt(self, ciphertext: bytes) -> str:
        """Raises `cryptography.fernet.InvalidToken` if `ciphertext` was encrypted
        under a different secret key. Never caught here (see the module docstring)."""
        return self._fernet.decrypt(ciphertext).decode("utf-8")

    def fingerprint(self, token: str) -> str:
        return hmac.new(self._fingerprint_key, token.encode("utf-8"), hashlib.sha256).hexdigest()
