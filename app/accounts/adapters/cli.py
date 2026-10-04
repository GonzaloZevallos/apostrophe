"""The one thing no user can do from the app: invite a new business (docs/adr/0002).

    scripts/invite-business.sh

prints a link that opens one new business, once, within seven days.
"""

import argparse
import sys

from sqlalchemy.orm import Session

from app.accounts.adapters.router import invitation_url
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.invitations import invite_new_business
from app.clock import system_clock
from app.db import make_engine
from app.migrations.runner import upgrade_to_head
from app.settings import Settings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="apostrophe")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("invite-business", help="print a link that opens one new business")
    parser.parse_args(argv)

    settings = Settings.from_env()
    engine = make_engine(settings.database_url, auth_token=settings.database_auth_token)
    upgrade_to_head(engine)
    with Session(engine) as session:
        issued = invite_new_business(SqlAccounts(session), session, system_clock())
    sys.stdout.write(f"{invitation_url(settings.public_url, issued.token)}\n")
    sys.stdout.write(f"Valid once, until {issued.expires_at:%Y-%m-%d %H:%M} UTC.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
