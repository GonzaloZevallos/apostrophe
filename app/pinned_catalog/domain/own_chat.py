"""Which chat is the seller's own, from the private chats that wrote to the bot."""

from __future__ import annotations

from app.pinned_catalog.domain.errors import NoMessages, SeveralChats


def own_chat_from(chats: frozenset[str]) -> str:
    """The one private chat, or `NoMessages` for none and `SeveralChats` for more than
    one: only a single person can be taken to be the seller."""
    if not chats:
        raise NoMessages()
    if len(chats) > 1:
        raise SeveralChats()
    (chat,) = chats
    return chat
