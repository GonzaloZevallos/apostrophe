"""The negative control for `FORBIDDEN_IN_TESTS`: the ports that take a whole invitation
are never called from a test, whatever instant the invitation carries."""

from app.accounts.application.ports import Accounts
from app.accounts.domain.invitation import Invitation


def writes_an_invitation_by_hand(accounts: Accounts, invitation: Invitation) -> None:
    accounts.add_invitation(invitation)  # flagged
    accounts.save_invitation(invitation)  # flagged
    accounts.add_business(invitation)  # not forbidden
