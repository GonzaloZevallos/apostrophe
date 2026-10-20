"""The negative control for `credentials_issued_at_a_fixed_instant`: every call on a line
marked `# flagged` mints a time-limited credential at an instant that does not move with
the app's clock. The guard must name exactly those lines."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.engine import Engine

from app.accounts.application.invitations import invite_new_business
from app.accounts.application.ports import Accounts
from app.accounts.application.reset_password import issue_reset_link
from app.shared.transaction import Transaction
from tests import conftest
from tests.conftest import NOW, invite
from tests.conftest import NOW as START

PINNED = datetime(2026, 10, 2, tzinfo=UTC)


def through_the_imported_helper(engine: Engine) -> None:
    invite(engine, NOW)  # flagged


def through_a_datetime_literal(accounts: Accounts, transaction: Transaction) -> None:
    invite_new_business(accounts, transaction, datetime(2026, 10, 2, tzinfo=UTC))  # flagged


def through_a_pinned_keyword(accounts: Accounts, transaction: Transaction) -> None:
    issue_reset_link(accounts, transaction, "uno@example.com", now=PINNED)  # flagged


def through_a_module_attribute(engine: Engine) -> None:
    invite(engine, conftest.NOW)  # flagged
    conftest.invite(engine, NOW)  # flagged


def through_an_imported_alias(engine: Engine) -> None:
    invite(engine, START)  # flagged


def through_an_offset_from_the_fixed_instant(engine: Engine) -> None:
    invite(engine, NOW - timedelta(days=8))  # flagged


def through_a_single_assignment(engine: Engine) -> None:
    now = NOW
    invite(engine, now)  # flagged


def after_a_local_import(accounts: Accounts, transaction: Transaction) -> None:
    from app.accounts.application.reset_password import issue_reset_link as mint

    mint(accounts, transaction, "uno@example.com", NOW)  # flagged
    accounts.issue_reset_link(1, "a" * 64, NOW)  # flagged
    accounts.issue_reset_link(1, "a" * 64, created_at=NOW)  # flagged
