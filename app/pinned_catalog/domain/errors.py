"""Pinned catalog's own fixed-message errors (CODING_STANDARDS section 9): each
carries a fixed message built with no argument, so a chat, a token or Telegram's own
wording can never slip into it, and its own `code` (docs/adr/0008), never inherited.
"""

from __future__ import annotations

from enum import StrEnum
from typing import ClassVar


class PinnedCatalogRuleBroken(ValueError):
    """A precondition Probarlo or Publicar checks before ever calling Telegram."""


class TokenRequired(PinnedCatalogRuleBroken):
    code: ClassVar[str] = "pinned_catalog.token_required"

    def __init__(self) -> None:
        super().__init__("a bot token is required")


class OwnChatRequired(PinnedCatalogRuleBroken):
    code: ClassVar[str] = "pinned_catalog.own_chat_required"

    def __init__(self) -> None:
        super().__init__("your own chat is required")


class NotReady(PinnedCatalogRuleBroken):
    code: ClassVar[str] = "pinned_catalog.not_ready"

    def __init__(self) -> None:
        super().__init__("publish needs a saved channel chat and a successful test")


class TooLong(PinnedCatalogRuleBroken):
    code: ClassVar[str] = "pinned_catalog.too_long"

    def __init__(self) -> None:
        super().__init__("the text does not fit in one Telegram message")


class SendRefusal(StrEnum):
    """Why Telegram refused a send, an edit or a pin: the cause `classify` (ADR-0023)
    reports, with no part of Telegram's own description. Each action folds it to its
    own error (`refusal_causes.py`); nothing but the Telegram adapter ever reads
    Telegram's `error_code` or text."""

    TOKEN_INVALID = "token_invalid"
    CHAT_NOT_STARTED = "chat_not_started"
    CHAT_NOT_FOUND = "chat_not_found"
    NO_RIGHTS = "no_rights"
    OTHER = "other"


class TokenInvalid(PinnedCatalogRuleBroken):
    """Probarlo: Telegram does not know the token. Registered in the router, so its
    `code` answers an HTTP refusal; the message names no part of what was typed."""

    code: ClassVar[str] = "pinned_catalog.token_invalid"

    def __init__(self) -> None:
        super().__init__("the bot token is not valid")


class OwnChatNotStarted(PinnedCatalogRuleBroken):
    """Probarlo: the bot may not write first to the seller's own chat."""

    code: ClassVar[str] = "pinned_catalog.own_chat_not_started"

    def __init__(self) -> None:
        super().__init__("the own chat has not started the bot")


class OwnChatNotFound(PinnedCatalogRuleBroken):
    """Probarlo: Telegram does not find the own chat (or it was never started: the
    400 answer cannot tell the two causes apart)."""

    code: ClassVar[str] = "pinned_catalog.own_chat_not_found"

    def __init__(self) -> None:
        super().__init__("the own chat was not found")


class TestSendFailed(PinnedCatalogRuleBroken):
    """Probarlo: any other refusal of the test send."""

    code: ClassVar[str] = "pinned_catalog.test_failed"

    def __init__(self) -> None:
        super().__init__("the test send failed")


class NoMessages(PinnedCatalogRuleBroken):
    """Buscar mi chat: nobody wrote privately to the bot."""

    code: ClassVar[str] = "pinned_catalog.no_messages"

    def __init__(self) -> None:
        super().__init__("no private chat wrote to the bot")


class SeveralChats(PinnedCatalogRuleBroken):
    """Buscar mi chat: more than one private chat wrote to the bot."""

    code: ClassVar[str] = "pinned_catalog.several_chats"

    def __init__(self) -> None:
        super().__init__("more than one private chat wrote to the bot")


class UpdatesUnreadable(PinnedCatalogRuleBroken):
    """Buscar mi chat: Telegram would not hand over the bot's messages."""

    code: ClassVar[str] = "pinned_catalog.updates_unreadable"

    def __init__(self) -> None:
        super().__init__("the bot's messages cannot be read")


class UpdatesRefusal(StrEnum):
    """Why Telegram refused to hand over the bot's pending messages (getUpdates), with
    no part of Telegram's own description. Only `classify_updates` (the Telegram
    adapter) decides it; the own-chat lookup folds it to its own error."""

    TOKEN_INVALID = "token_invalid"
    UNREADABLE = "unreadable"


class TelegramOutcomeFailure(RuntimeError):
    """What `classify` (ADR-0023) turns a Telegram answer into, carrying no part of
    Telegram's own description, URL or token (CODING_STANDARDS section 9)."""


class TelegramUnreachable(TelegramOutcomeFailure):
    code: ClassVar[str] = "pinned_catalog.telegram_unreachable"

    def __init__(self) -> None:
        super().__init__("telegram did not answer")


class TelegramRefused(TelegramOutcomeFailure):
    """Telegram refused a send, an edit or a pin, and `cause` says why. Only the
    adapter raises it; it is never registered in a router's `TranslateErrors`: the
    action that called Telegram folds `cause` to its own error first. It carries its
    own `code` like every error here, for whoever reaches it next."""

    code: ClassVar[str] = "pinned_catalog.telegram_refused"

    def __init__(self, cause: SendRefusal) -> None:
        super().__init__("telegram refused the request")
        self.cause = cause


class UpdatesRefused(TelegramOutcomeFailure):
    """Telegram refused getUpdates, and `cause` says why. Only the adapter raises it;
    it is never registered in a router's `TranslateErrors`: the lookup folds `cause`
    to its own error first. It carries its own `code` like every error here, for
    whoever reaches it next."""

    code: ClassVar[str] = "pinned_catalog.updates_refused"

    def __init__(self, cause: UpdatesRefusal) -> None:
        super().__init__("telegram refused to hand over the updates")
        self.cause = cause


class BotCannotPost(TelegramOutcomeFailure):
    code: ClassVar[str] = "pinned_catalog.bot_cannot_post"

    def __init__(self) -> None:
        super().__init__("the bot cannot post in that chat")


class MessageGone(TelegramOutcomeFailure):
    """Never registered in a router's `TranslateErrors`, so its `code` never answers an
    HTTP refusal: Publicar catches it and posts a new message; upkeep catches it and
    records `PinFailure.MESSAGE_GONE` instead. It still carries its own `code`, like
    every error here, for whoever reaches it next."""

    code: ClassVar[str] = "pinned_catalog.message_gone"

    def __init__(self) -> None:
        super().__init__("the pinned message no longer exists")
