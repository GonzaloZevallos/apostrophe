"""Each action's own fold of a `SendRefusal` (the cause the Telegram adapter reports)
into the error that action answers. Every fold is a `match` with one case per member and
`assert_never` at the end, with no default branch: a new cause fails `mypy --strict`
until each fold says what it means there.
"""

from __future__ import annotations

from typing import assert_never

from app.pinned_catalog.domain.errors import BotCannotPost, SendRefusal


def for_channel(cause: SendRefusal) -> BotCannotPost:
    """Publicar and upkeep: whatever the cause, the bot cannot post in the channel."""
    match cause:
        case SendRefusal.TOKEN_INVALID:
            return BotCannotPost()
        case SendRefusal.CHAT_NOT_STARTED:
            return BotCannotPost()
        case SendRefusal.CHAT_NOT_FOUND:
            return BotCannotPost()
        case SendRefusal.NO_RIGHTS:
            return BotCannotPost()
        case SendRefusal.OTHER:
            return BotCannotPost()
    assert_never(cause)
