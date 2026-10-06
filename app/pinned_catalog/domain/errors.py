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
