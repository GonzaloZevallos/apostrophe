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

from sqlalchemy.orm import Session

from app.accounts.adapters.router import invitation_url, reset_url
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_new_business
from app.accounts.application.reset_password import issue_reset_link
from app.clock import system_clock
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.settings import Settings

NO_USER_MESSAGE = "no user for that email"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="apostrophe")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("invite-business", help="print a link that opens one new business")
    reset_parser = commands.add_parser(
        "reset-password", help="print a link that lets one user choose a new password"
    )
    reset_parser.add_argument("email")
    args = parser.parse_args(argv)

    settings = Settings.from_env()
    try:
        engine = make_engine(settings.database_url, auth_token=settings.database_auth_token)
        upgrade_to_head(engine)
        with Session(engine) as session:
            if args.command == "invite-business":
                return _invite_business(session, settings)
            return _reset_password(session, settings, args.email)
    except SystemExit:
        raise
    except BaseException as exc:
        # Never `str(exc)`, never a traceback: a refusal names only its own class.
        sys.stderr.write(f"refused: {type(exc).__name__}\n")
        return 1


def _invite_business(session: Session, settings: Settings) -> int:
    issued = invite_new_business(SqlAccounts(session), session, system_clock())
    sys.stdout.write(f"{invitation_url(settings.public_url, issued.token)}\n")
    sys.stdout.write(f"Valid once, until {issued.expires_at:%Y-%m-%d %H:%M} UTC.\n")
    return 0


def _reset_password(session: Session, settings: Settings, email: str) -> int:
    issued = issue_reset_link(SqlAccounts(session), session, email, system_clock())
    if issued is None:
        session.rollback()
        sys.stderr.write(f"{NO_USER_MESSAGE}\n")
        return 1
    sys.stdout.write(f"{reset_url(settings.public_url, issued.token)}\n")
    sys.stdout.write(f"Valid once, until {issued.expires_at:%Y-%m-%d %H:%M} UTC.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
