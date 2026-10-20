"""A control for `credentials_issued_at_a_fixed_instant`: this module defines its own
`issue` and imports no credential helper, so `issue(engine, NOW)` is not
`tests.accounts.test_reset_password.issue` and is not flagged."""

from datetime import UTC, datetime

NOW = datetime(2026, 10, 2, tzinfo=UTC)


def issue(engine: object, now: datetime) -> str:
    return f"{engine}{now}"


issue(object(), NOW)
