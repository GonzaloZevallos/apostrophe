"""No Turso token, `age` identity, R2/Cloudflare key or Render key ever reaches a
tracked file (the plan's invariant). Only the `age1…` recipient, public by design, may
be committed (`deploy/age-recipient.txt`).

Proven negative first (`tests/architecture/test_architecture.py`'s own pattern): the
scanner must be seen to flag each deliberately bad shape before it is trusted to pass
over every file this repository tracks.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_PATTERNS = {
    "age identity": re.compile(r"AGE-SECRET-KEY-1[A-Z0-9]{20,}"),
    "jwt-shaped token": re.compile(
        r"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}"
    ),
    "render api key": re.compile(r"\brnd_[A-Za-z0-9]{20,}\b"),
    "cloudflare or r2 key": re.compile(
        r"(?i)\b(CLOUDFLARE|R2)_[A-Z0-9_]*(KEY|TOKEN|SECRET)\s*[=:]\s*['\"]?[A-Za-z0-9/+_.-]{20,}"
    ),
    # A generic env-style assignment with a real-looking value.
    "generic token or secret assignment": re.compile(
        r"(?i)\b[A-Z0-9_]*_(TOKEN|SECRET)\s*=\s*\S{6,}"
    ),
}

# Python source is different: a Python string literal is always quoted, so a bare,
# unquoted right-hand side there (`auth_token=settings.database_auth_token`) is a
# reference or an expression, never a secret's own value -- exactly the shape the
# generic pattern above would false-positive on for every future caller of a
# `connect_args={"auth_token": ...}` port (the plan's invariant for that value). A
# *quoted* literal such as `TURSO_AUTH_TOKEN = "<a real token>"` is still a secret in
# Python source too, so `.py` files get this narrower pattern instead of a blanket
# exemption. The value itself is restricted to token-shaped characters (no spaces or
# hyphens): a hyphenated, readable placeholder such as `"not-a-real-token"` (a test
# fixture, `tests/test_libsql_driver.py`) is exactly what a real token never looks
# like, and must read as fine, not as a finding.
_PYTHON_TOKEN_PATTERN = re.compile(
    r"(?i)\b[A-Z0-9_]*_(TOKEN|SECRET)\s*=\s*[\"'][A-Za-z0-9+/=_.]{6,}[\"']"
)


def find_secrets(text: str, *, filename: str = "") -> list[str]:
    """Names each secret-shaped pattern found in `text`. For `.py` files, `generic
    token or secret assignment` is checked with the narrower, quote-requiring pattern
    (see the comment above) instead of the generic one."""
    found = []
    for name, pattern in _PATTERNS.items():
        if name == "generic token or secret assignment" and filename.endswith(".py"):
            pattern = _PYTHON_TOKEN_PATTERN
        if pattern.search(text):
            found.append(name)
    return found


def _tracked_files() -> list[Path]:
    output = subprocess.run(
        ["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, check=True, text=True
    ).stdout
    return [REPO_ROOT / line for line in output.splitlines() if line]


def test_the_scanner_flags_an_age_identity() -> None:
    # Split so this deliberately bad example never reads, in the tracked file itself,
    # as the very shape it exists to catch (see test_no_tracked_file_contains_a_secret).
    bad = "AGE-SECRET-KEY-1" "QGFVZLHMFCSK6K3WX2FJ9VPXZQJ3P5K8VY6WY8WFVZ8L0X3MQZQS8RJ9NF"

    assert "age identity" in find_secrets(bad)


def test_the_scanner_flags_a_jwt_shaped_token() -> None:
    bad = (
        "eyJhbGciOiJFZERTQSJ9.eyJhIjoicnciLCJpYXQiOjE3Mjk0NTYwMDB9."
        "k3QwQnRmZk1zX3Vua25vd25zaWduYXR1cmV2YWx1ZQ"
    )

    assert "jwt-shaped token" in find_secrets(bad)


def test_the_scanner_flags_a_render_api_key() -> None:
    # Split for the same reason as the age identity example above.
    bad = "RENDER_API_KEY=rnd_" "abcdefghijklmnopqrstuvwxyz0123456789"

    assert "render api key" in find_secrets(bad)


def test_the_scanner_flags_a_cloudflare_or_r2_key() -> None:
    # Split for the same reason as the age identity example above.
    bad = "R2_SECRET_ACCESS_KEY=" "0123456789abcdef0123456789abcdef0123456789abcdef"

    assert "cloudflare or r2 key" in find_secrets(bad)


def test_the_scanner_flags_a_generic_token_assignment_outside_python() -> None:
    bad = "SOME_OTHER_TOKEN=abcdefghijklmnopqrstuvwxyz"

    assert "generic token or secret assignment" in find_secrets(bad, filename="deploy.sh")


def test_the_scanner_lets_a_python_reference_through() -> None:
    # `auth_token=` here names a connect argument, not a literal secret (the plan's
    # invariant: the auth token is a connect arg, read from settings at call time).
    fine = 'create_engine(url, connect_args={"auth_token": settings.database_auth_token})'

    assert find_secrets(fine, filename="app/db.py") == []


def test_the_scanner_lets_a_hyphenated_placeholder_token_through() -> None:
    # A fixture value that reads like words joined by hyphens, not like a real
    # token's own alphabet, must stay fine -- `tests/test_libsql_driver.py` passes
    # exactly this kind of value as `auth_token="not-a-real-token"`.
    fine = 'make_engine(url, auth_token="not-a-real-token")'

    assert find_secrets(fine, filename="tests/test_libsql_driver.py") == []


def test_the_scanner_still_flags_a_quoted_literal_secret_in_python() -> None:
    # The gap a previous review found: exempting every `.py` file outright from the
    # generic pattern let an actual, quoted literal token through too. A real secret
    # in Python source is always quoted (a bare right-hand side is a reference, never
    # a string value), so this shape must still be caught.
    # Split for the same reason as the age identity example above.
    bad = "TURSO_AUTH_TOKEN = " '"' "abcdefghijklmnopqrstuvwxyz" '"'

    assert "generic token or secret assignment" in find_secrets(bad, filename="scripts/x.py")


def test_the_age_recipient_is_allowed() -> None:
    recipient = Path(REPO_ROOT / "deploy" / "age-recipient.txt").read_text().strip()

    assert find_secrets(recipient) == []


def test_no_tracked_file_contains_a_secret() -> None:
    violations: list[tuple[str, str]] = []
    for path in _tracked_files():
        if not path.is_file():
            continue
        try:
            text = path.read_text()
        except (UnicodeDecodeError, OSError):
            continue
        relative = str(path.relative_to(REPO_ROOT))
        violations.extend((relative, kind) for kind in find_secrets(text, filename=relative))

    assert violations == []
