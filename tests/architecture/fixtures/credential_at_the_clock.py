"""The positive control for `credentials_issued_at_a_fixed_instant`: nothing here is
flagged. Each credential is minted at an instant that comes from the app's clock, or the
call is not a credential issuer at all."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.engine import Engine

from app.accounts.application.invitations import invite_new_business
from app.accounts.application.ports import Accounts
from app.accounts.domain.session_token import SessionSigner
from app.shared.transaction import Transaction
from tests.conftest import NOW, MovableClock, invite

SOMEWHERE = datetime(2026, 10, 2, tzinfo=UTC)


def at_the_clock(engine: Engine, clock: MovableClock) -> None:
    invite(engine, clock())
    invite(engine, now=clock())


def at_a_name_bound_once_to_the_clock(engine: Engine, clock: MovableClock) -> None:
    today = clock()
    invite(engine, today)
    invite(engine, today - timedelta(days=30))


def at_a_parameter(engine: Engine, now: datetime) -> None:
    invite(engine, now)


def at_a_name_assigned_twice(engine: Engine, clock: MovableClock) -> None:
    when = NOW
    when = clock()
    invite(engine, when)


def at_a_loop_target(engine: Engine, instants: list[datetime]) -> None:
    for instant in instants:
        invite(engine, instant)


def at_an_attribute_of_the_clock(engine: Engine, clock: MovableClock) -> None:
    invite(engine, clock.now)


def at_a_call_named_like_a_constant(engine: Engine, NOW_CLOCK: Callable[[], datetime]) -> None:
    invite(engine, NOW_CLOCK())


def through_the_port_at_the_clock(accounts: Accounts, clock: MovableClock) -> None:
    accounts.issue_reset_link(1, "a" * 64, clock())


def through_the_use_case_at_the_clock(
    accounts: Accounts, transaction: Transaction, clock: MovableClock
) -> None:
    invite_new_business(accounts, transaction, clock())


def not_an_issuer(token_signer: object, signer: object) -> None:
    SessionSigner.issue(1, "h", NOW)
    signer.issue(1, "h", NOW)
    token_signer.issue(1, "h", SOMEWHERE)
