"""Session tokens: which user, when the session opened, and a fingerprint of the
password it was opened with, signed (docs/adr/0002).

Stateless: nothing is stored per session. Changing a user's password changes the
fingerprint and closes that user's sessions; changing the secret key closes everyone's.
The fingerprint is keyed with the secret key, so a stolen token gives nothing to
brute-force offline.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime, timedelta

SESSION_LIFETIME = timedelta(days=30)


@dataclass(frozen=True)
class SessionClaims:
    user_id: int
    opened_at: int
    fingerprint: str


@dataclass(frozen=True)
class SessionSigner:
    secret_key: str

    def issue(self, user_id: int, password_hash: str, now: datetime) -> str:
        payload = f"{user_id}.{int(now.timestamp())}.{self._fingerprint(password_hash)}"
        return f"{_encode(payload)}.{self._sign(payload)}"

    def read(self, token: str) -> SessionClaims | None:
        """The claims of a token this signer issued; `None` for anything else."""
        encoded, _, signature = token.rpartition(".")
        payload = _decode(encoded)
        if payload is None or not hmac.compare_digest(signature, self._sign(payload)):
            return None
        user_id, opened_at, fingerprint = (payload.split(".") + ["", ""])[:3]
        if not (user_id.isdigit() and opened_at.isdigit()):
            return None
        return SessionClaims(int(user_id), int(opened_at), fingerprint)

    def is_open(self, claims: SessionClaims, password_hash: str, now: datetime) -> bool:
        if not hmac.compare_digest(claims.fingerprint, self._fingerprint(password_hash)):
            return False
        age = now.timestamp() - claims.opened_at
        return 0 <= age <= SESSION_LIFETIME.total_seconds()

    def _fingerprint(self, password_hash: str) -> str:
        return self._sign(f"password:{password_hash}")[:16]

    def _sign(self, payload: str) -> str:
        return hmac.new(self.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _encode(payload: str) -> str:
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def _decode(encoded: str) -> str | None:
    try:
        return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
    except (binascii.Error, UnicodeDecodeError):
        return None
