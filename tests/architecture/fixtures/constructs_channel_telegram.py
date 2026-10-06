"""A deliberate violation of the plan's invariant "only `app/main.py` constructs
`ChannelTelegram` or `PinnedCatalogTelegram`": never imported, only parsed by
`tests/architecture/test_architecture.py`'s own checker."""

from app.pinned_catalog.application.channel_telegram import ChannelTelegram
from app.pinned_catalog.application.ports import TelegramApi


def build(api: TelegramApi) -> ChannelTelegram:
    return ChannelTelegram(api)
