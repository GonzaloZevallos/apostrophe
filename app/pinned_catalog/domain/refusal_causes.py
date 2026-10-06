"""Each action's own fold of a `SendRefusal` (the cause the Telegram adapter reports)
into the error that action answers. Every fold is a `match` with one case per member and
`assert_never` at the end, with no default branch: a new cause fails `mypy --strict`
until each fold says what it means there.
"""

from __future__ import annotations

from typing import assert_never

from app.pinned_catalog.domain.errors import (
    BotCannotPost,
    OwnChatNotFound,
    OwnChatNotStarted,
    SendRefusal,
    TestSendFailed,
    TokenInvalid,
    UpdatesRefusal,
    UpdatesUnreadable,
)


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


def for_test_send(
    cause: SendRefusal,
) -> TokenInvalid | OwnChatNotStarted | OwnChatNotFound | TestSendFailed:
    """Probarlo: the reason it answers for each cause, never the channel's. A cause it
    has no specific word for (no rights, any other refusal) is `TestSendFailed`."""
    match cause:
        case SendRefusal.TOKEN_INVALID:
            return TokenInvalid()
        case SendRefusal.CHAT_NOT_STARTED:
            return OwnChatNotStarted()
        case SendRefusal.CHAT_NOT_FOUND:
            return OwnChatNotFound()
        case SendRefusal.NO_RIGHTS:
            return TestSendFailed()
        case SendRefusal.OTHER:
            return TestSendFailed()
    assert_never(cause)


def for_lookup(cause: UpdatesRefusal) -> TokenInvalid | UpdatesUnreadable:
    """Buscar mi chat: a token Telegram does not know is the token's own reason; any
    other refusal to hand over the messages is the unreadable one."""
    match cause:
        case UpdatesRefusal.TOKEN_INVALID:
            return TokenInvalid()
        case UpdatesRefusal.UNREADABLE:
            return UpdatesUnreadable()
    assert_never(cause)
