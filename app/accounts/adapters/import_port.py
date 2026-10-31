"""Accounts' side of the spreadsheet import's `BusinessDirectory` port
(`app/spreadsheet_import/application/ports.py`): the one way the command names its
target, since no route ever carries a business (ADR-0004).
"""

from __future__ import annotations

from app.accounts.adapters.sql_accounts import SqlAccounts


class BusinessDirectory:
    def __init__(self, accounts: SqlAccounts) -> None:
        self._accounts = accounts

    def name_of(self, business_id: int) -> str | None:
        """`None` when there is no such business; the import refuses the run before
        any sheet is read."""
        business = self._accounts.business(business_id)
        return None if business is None else business.name.value


class TargetZone:
    """Accounts' side of the import's `TargetZone` port: the stored zone name of the
    target business, never loaded or validated here."""

    def __init__(self, accounts: SqlAccounts) -> None:
        self._accounts = accounts

    def zone_name_of(self, business_id: int) -> str | None:
        business = self._accounts.business(business_id)
        return None if business is None else business.time_zone.name
