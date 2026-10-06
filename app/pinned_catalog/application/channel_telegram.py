"""`ChannelTelegram`: the only way Publicar and upkeep reach Telegram. It wraps the raw
`TelegramApi` and folds every `TelegramRefused` to `BotCannotPost`, so no `push` call
site needs a catch of its own for a refusal cause, and `push` taking this type (never
the port) makes passing the raw adapter a type error. Only `app/main.py` builds it.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import final

from app.pinned_catalog.application.ports import EditOutcome, TelegramApi
from app.pinned_catalog.domain.errors import TelegramRefused
from app.pinned_catalog.domain.refusal_causes import for_channel


@final
class ChannelTelegram:
    def __init__(self, inner: TelegramApi) -> None:
        self._inner = inner

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        try:
            return self._inner.send(token, chat, plain, spans)
        except TelegramRefused as exc:
            raise for_channel(exc.cause) from None

    def edit(
        self,
        token: str,
        chat: str,
        message_id: int,
        plain: str,
        spans: Sequence[tuple[int, int]],
    ) -> EditOutcome:
        try:
            return self._inner.edit(token, chat, message_id, plain, spans)
        except TelegramRefused as exc:
            raise for_channel(exc.cause) from None

    def pin(self, token: str, chat: str, message_id: int) -> None:
        try:
            self._inner.pin(token, chat, message_id)
        except TelegramRefused as exc:
            raise for_channel(exc.cause) from None
