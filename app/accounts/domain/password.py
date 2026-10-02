"""Passwords are kept as scrypt hashes, never as text (docs/adr/0002).

A stored hash carries its own parameters, so raising them later never breaks the
passwords already stored.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass

SALT_BYTES = 16
KEY_BYTES = 32


@dataclass(frozen=True)
class ScryptParams:
    n: int
    r: int
    p: int

    @property
    def memory_bytes(self) -> int:
        return 128 * self.r * self.n * self.p


# OWASP's recommendation for scrypt: 128 MiB and a few hundred milliseconds per hash.
PRODUCTION_SCRYPT = ScryptParams(n=2**17, r=8, p=1)


@dataclass(frozen=True)
class PasswordHasher:
    params: ScryptParams = PRODUCTION_SCRYPT

    def hash(self, password: str) -> str:
        salt = secrets.token_bytes(SALT_BYTES)
        key = _scrypt(password, salt, self.params)
        n, r, p = self.params.n, self.params.r, self.params.p
        return f"scrypt${n}${r}${p}${_b64(salt)}${_b64(key)}"

    def verify(self, password: str, stored: str) -> bool:
        try:
            scheme, n, r, p, salt, key = stored.split("$")
            params = ScryptParams(int(n), int(r), int(p))
        except ValueError:
            return False
        if scheme != "scrypt":
            return False
        return hmac.compare_digest(_scrypt(password, _unb64(salt), params), _unb64(key))

    def burn(self, password: str) -> None:
        """Spend the time of one hash without keeping it, so a login for an unknown email
        takes as long as one for a known email and does not reveal which emails exist."""
        _scrypt(password, bytes(SALT_BYTES), self.params)


def _scrypt(password: str, salt: bytes, params: ScryptParams) -> bytes:
    return hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=params.n,
        r=params.r,
        p=params.p,
        maxmem=2 * params.memory_bytes,
        dklen=KEY_BYTES,
    )


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


def _unb64(text: str) -> bytes:
    return base64.b64decode(text)
