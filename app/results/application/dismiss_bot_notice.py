"""Inicio's one write besides Cobrar: the bot notice's dismissal (CONTEXT.md: Bot
notice). One decision for the whole business, permanent; a second dismissal changes
nothing, the store keeping the first instant. Commits once, at its end."""

from __future__ import annotations

from datetime import datetime

from app.results.application.ports import SetupStateStore
from app.shared.transaction import Transaction


def dismiss_bot_notice(store: SetupStateStore, transaction: Transaction, now: datetime) -> None:
    store.dismiss_bot_notice(now)
    transaction.commit()
