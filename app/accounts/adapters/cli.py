"""The operator's own commands, never run from inside the app (docs/adr/0002,
docs/adr/0019):

    scripts/invite-business.sh
    scripts/reset-password.sh <email>

The first prints a link that opens one new business, once, within seven days. The
second prints a link that lets the user of `<email>` choose a new password, once,
within 24 hours -- the operator never sees or chooses it. Neither command ever prints
an email, a token, a digest or a traceback: a refusal before the link is issued prints
only `no user for that email` or `refused: <ExceptionClassName>`.
"""

import argparse
import sys
from datetime import datetime

from sqlalchemy.orm import Session

from app.accounts.adapters.router import invitation_url, reset_url
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_new_business
from app.accounts.application.reset_password import issue_reset_link
from app.clock import Clock, system_clock
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.settings import Settings
from app.shared.copy import OperatorText


def build_parser(text: OperatorText | None) -> argparse.ArgumentParser:
    """The command's arguments. `text` is the operator's translator: `None` leaves the
    `help=` texts out (a refused start still parses its arguments). argparse's own frame --
    `usage:`, `options:`, its error lines -- stays the standard library's English."""

    def helped(key: str) -> str | None:
        return None if text is None else text(key)

    parser = argparse.ArgumentParser(prog="apostrophe")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("invite-business", help=helped("operator.accounts.help_invite_business"))
    reset_parser = commands.add_parser(
        "reset-password", help=helped("operator.accounts.help_reset_password")
    )
    reset_parser.add_argument("email")
    return parser


def main(argv: list[str] | None = None, *, clock: Clock = system_clock) -> int:
    try:
        settings = Settings.from_env()
        text = settings.operator_translator()
        parser = build_parser(text)
    except Exception as exc:
        # Nothing has been installed or written yet; the arguments still get parsed so a
        # usage error is argparse's, whatever state the settings are in.
        build_parser(None).parse_args(argv)
        return _refused(exc, None)
    args = parser.parse_args(argv)

    try:
        engine = make_engine(settings.database_url, auth_token=settings.database_auth_token)
        upgrade_to_head(engine)
        with Session(engine) as session:
            if args.command == "invite-business":
                return _invite_business(session, settings, text, clock)
            return _reset_password(session, settings, text, args.email, clock)
    except SystemExit:
        raise
    except BaseException as exc:
        return _refused(exc, text)


def _refused(exc: BaseException, text: OperatorText | None) -> int:
    """Never `str(exc)`, never a traceback: a refusal names only its own class. With no
    translator, or if even this line cannot be rendered, the fixed English
    `refused: <ClassName>` stands in (docs/adr/0050)."""
    name = type(exc).__name__
    try:
        line = f"refused: {name}" if text is None else text("operator.accounts.refused", name=name)
    except Exception:
        line = f"refused: {name}"
    sys.stderr.write(f"{line}\n")
    return 1


def _expiry_line(text: OperatorText, expires_at: datetime) -> str:
    return text("operator.accounts.valid_once", expires_at=f"{expires_at:%Y-%m-%d %H:%M}")


def _invite_business(session: Session, settings: Settings, text: OperatorText, clock: Clock) -> int:
    issued = invite_new_business(SqlAccounts(session), session, clock())
    expiry = _expiry_line(text, issued.expires_at)
    sys.stdout.write(f"{invitation_url(settings.public_url, issued.token)}\n")
    sys.stdout.write(f"{expiry}\n")
    return 0


def _reset_password(
    session: Session, settings: Settings, text: OperatorText, email: str, clock: Clock
) -> int:
    issued = issue_reset_link(SqlAccounts(session), session, email, clock())
    if issued is None:
        session.rollback()
        sys.stderr.write(f"{text('operator.accounts.no_user')}\n")
        return 1
    expiry = _expiry_line(text, issued.expires_at)
    sys.stdout.write(f"{reset_url(settings.public_url, issued.token)}\n")
    sys.stdout.write(f"{expiry}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
