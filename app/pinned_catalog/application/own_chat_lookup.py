"""Buscar mi chat: finds the seller's own chat from the bot's pending messages. It
writes nothing and takes no per-business lock: it reads no pin fact it writes back."""

from __future__ import annotations

from datetime import date

from app.pinned_catalog.application.ports import PinSnapshots, PrivateChats
from app.pinned_catalog.domain.errors import TokenRequired, UpdatesRefused
from app.pinned_catalog.domain.own_chat import own_chat_from
from app.pinned_catalog.domain.refusal_causes import for_lookup


def look_up_own_chat(
    updates: PrivateChats,
    snapshots: PinSnapshots,
    business_id: int,
    token: str | None,
    today: date,
) -> str:
    """The typed `token`, or else the saved one (read here, never returned), reads the
    private chats; one of them is the answer. `TelegramUnreachable` passes through."""
    effective_token = (
        token if token is not None else snapshots.snapshot(business_id, today).settings.token
    )
    if effective_token is None:
        raise TokenRequired()
    try:
        chats = updates.private_chats(effective_token)
    except UpdatesRefused as exc:
        raise for_lookup(exc.cause) from None
    return own_chat_from(chats)
