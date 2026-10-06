"""The one typed holder of everything `app.state.pinned_catalog_telegram` carries.
`app/main.py` builds exactly one; every reader casts `State` to it once and picks a
field, so no reader names a Telegram port of its own (the plan's invariant)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.pinned_catalog.application.channel_telegram import ChannelTelegram
from app.pinned_catalog.application.ports import PrivateChats, TelegramApi


class TelegramBackend(TelegramApi, PrivateChats, Protocol):
    """What `create_app` takes: one object that both sends and reads updates, the real
    `HttpTelegram` or the tests' `FakeTelegram`."""


@dataclass(frozen=True)
class PinnedCatalogTelegram:
    api: TelegramApi
    channel: ChannelTelegram
    updates: PrivateChats
