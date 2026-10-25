"""No Turso token, `age` identity or Render key ever reaches a tracked file (the
plan's invariant). Only the `age1…` recipient, public by design, may be committed
(`deploy/age-recipient.txt`).

A second, separate checker, `find_object_storage_names`, proves that no R2/S3
credential name is left in any file that runs, now that the daily backup is kept as
a GitHub Actions artifact instead of an object-storage bucket (docs/adr/0017's
amendment): the backup destination changed, so every setting and secret name that
destination used must be gone from the files that actually execute, not just from
prose that still explains why it was dropped.

Proven negative first (`tests/architecture/test_architecture.py`'s own pattern): each
scanner must be seen to flag a deliberately bad shape before it is trusted to pass
over every file it covers.
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


# Names, not values: an R2/S3 credential or CLI flag the daily backup no longer
# needs, now that it is a GitHub Actions artifact (docs/adr/0017's amendment). Matched
# case-sensitively, as these always appear: ordinary prose naming "Cloudflare R2" (the
# ADR, the README's pointer to it) never contains any of these literal substrings.
_OBJECT_STORAGE_NAMES = (
    "R2_",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "aws s3",
    "--endpoint-url",
    "S3_",
)

# Only the files that actually run: workflows, the deploy operator's own doc and
# scripts, and Render's own blueprint. Docs and ADRs are not scanned -- the ADR's
# prose explains, on purpose, why R2 was dropped, including its old setting names.
_RUNNING_FILE_ROOTS = (".github/workflows", "deploy", "scripts")
_RUNNING_FILE_EXTRAS = ("render.yaml",)


def find_object_storage_names(text: str) -> list[str]:
    """Each object-storage name found in `text`, literally, not by value."""
    return [name for name in _OBJECT_STORAGE_NAMES if name in text]


def _tracked_files() -> list[Path]:
    output = subprocess.run(
        ["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, check=True, text=True
    ).stdout
    return [REPO_ROOT / line for line in output.splitlines() if line]


def _tracked_running_files() -> list[Path]:
    running = []
    for path in _tracked_files():
        relative = path.relative_to(REPO_ROOT).as_posix()
        if relative in _RUNNING_FILE_EXTRAS or any(
            relative == root or relative.startswith(root + "/") for root in _RUNNING_FILE_ROOTS
        ):
            running.append(path)
    return running


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


def test_the_object_storage_scanner_flags_an_r2_env_var_name() -> None:
    assert find_object_storage_names("R2_ACCESS_KEY_ID") == ["R2_"]


def test_the_object_storage_scanner_flags_an_aws_access_key_id_name() -> None:
    assert "AWS_ACCESS_KEY_ID" in find_object_storage_names("export AWS_ACCESS_KEY_ID=x")


def test_the_object_storage_scanner_flags_an_aws_secret_access_key_name() -> None:
    assert "AWS_SECRET_ACCESS_KEY" in find_object_storage_names(
        "export AWS_SECRET_ACCESS_KEY=x"
    )


def test_the_object_storage_scanner_flags_an_aws_s3_command() -> None:
    assert "aws s3" in find_object_storage_names("aws s3 cp backup.db.age s3://bucket/")


def test_the_object_storage_scanner_flags_an_endpoint_url_flag() -> None:
    assert "--endpoint-url" in find_object_storage_names(
        "aws s3 --endpoint-url https://example.r2.cloudflarestorage.com cp a b"
    )


def test_the_object_storage_scanner_flags_an_s3_env_var_name() -> None:
    assert "S3_" in find_object_storage_names("S3_BUCKET=my-bucket")


def test_the_object_storage_scanner_lets_r2_prose_through() -> None:
    fine = (
        "Cloudflare R2 requires a credit card to enable, even on its free tier; see "
        "docs/adr/0017's amendment."
    )

    assert find_object_storage_names(fine) == []


def test_tracked_running_files_selects_the_backup_workflow_and_excludes_app() -> None:
    # Proof the selection itself is not empty, and not everything: an empty selection
    # would let the scan below pass with nothing actually scanned.
    relative = {str(path.relative_to(REPO_ROOT)) for path in _tracked_running_files()}

    assert ".github/workflows/backup.yml" in relative
    assert "deploy/README.md" in relative
    assert "render.yaml" in relative
    assert not any(path.startswith("app/") for path in relative)


def test_no_tracked_running_file_references_an_object_storage_name() -> None:
    violations: list[tuple[str, str]] = []
    for path in _tracked_running_files():
        if not path.is_file():
            continue
        try:
            text = path.read_text()
        except (UnicodeDecodeError, OSError):
            continue
        relative = str(path.relative_to(REPO_ROOT))
        violations.extend((relative, name) for name in find_object_storage_names(text))

    assert violations == []


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
