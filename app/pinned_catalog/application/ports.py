"""Ports the pinned catalog declares over Telegram and its own storage (docs/adr/0006).
No implementation lives here; `app/pinned_catalog/adapters/` implements each one.

This subtask (pin-core) declares every port the plan's "Shape" section lists, so the
`upkeep` subtask that follows needs no new one: `DueBusinesses` is used only by its
day-change ticker and `sync_all.py`, neither built here.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Protocol

from app.pinned_catalog.domain.status import PinFailure

EditOutcome = Literal["edited", "unchanged"]


class TelegramApi(Protocol):
    """The raw Telegram port. Raises the domain's own `TelegramRefused` (carrying why),
    `TelegramUnreachable`, `MessageGone` (edit and pin only) or `TooLong` (a backstop:
    callers already check `fits_in_one_message` first) — never `BotCannotPost`, which
    only `ChannelTelegram` produces, and never Telegram's own description, URL or token
    (CODING_STANDARDS §9)."""

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        """Posts `plain` with `spans` as bold entities; answers the new message id."""
        ...

    def edit(
        self,
        token: str,
        chat: str,
        message_id: int,
        plain: str,
        spans: Sequence[tuple[int, int]],
    ) -> EditOutcome: ...

    def pin(self, token: str, chat: str, message_id: int) -> None: ...


class PrivateChats(Protocol):
    """The own-chat lookup's port over Telegram's getUpdates."""

    def private_chats(self, token: str) -> frozenset[str]:
        """The distinct ids of the private chats that wrote to the bot, from its
        pending messages: it never consumes them and never changes the bot's setup.
        Raises `UpdatesRefused` (carrying why) or `TelegramUnreachable`, never
        Telegram's own description, URL or token (CODING_STANDARDS §9)."""
        ...


@dataclass(frozen=True)
class SettingsSnapshot:
    """The part of a business's bot settings a snapshot answers. `token` is the
    decrypted token for internal use (a Telegram call); no schema in `adapters/` ever
    serializes it (CODING_STANDARDS §9) — only `token_saved_on` reaches a route."""

    token: str | None
    token_fingerprint: str | None
    token_saved_on: date | None
    own_chat: str | None
    channel_chat: str | None


@dataclass(frozen=True)
class PinFacts:
    message_id: int | None
    message_chat: str | None
    message_token_fingerprint: str | None
    last_published_text: str | None
    last_published_at: datetime | None
    last_failure: PinFailure | None
    last_checked_on: date | None


@dataclass(frozen=True)
class PinSnapshot:
    settings: SettingsSnapshot
    pin: PinFacts
    text: str


class PinSnapshots(Protocol):
    def snapshot(self, business_id: int, today: date) -> PinSnapshot:
        """Reads the settings (decrypted token included), the pin facts and the
        publishable catalog text, all in one closed `Session` (the plan's "How a sync
        runs": no database session stays open while Telegram is called)."""
        ...


class PinRecorder(Protocol):
    def record(
        self,
        business_id: int,
        expected_token_fingerprint: str | None,
        expected_channel_chat: str | None,
        *,
        message_id: int | None,
        message_chat: str | None,
        message_token_fingerprint: str | None,
        last_published_text: str | None,
        last_published_at: datetime | None,
        last_failure: PinFailure | None,
        last_checked_on: date | None,
    ) -> None:
        """Writes the pin facts in one short transaction, but only if the row's current
        token fingerprint and channel chat still equal what was read at snapshot time
        (the plan's guard against a settings change racing a send in flight)."""
        ...


class SettingsWriter(Protocol):
    def save(
        self,
        business_id: int,
        token: str | None,
        own_chat: str,
        channel_chat: str | None,
        saved_on: date,
    ) -> SettingsSnapshot:
        """`token=None` keeps the token already saved. Called only by `test_send` after
        a successful test (the plan's invariant)."""
        ...


class DueBusinesses(Protocol):
    def due(self, today: date) -> list[int]:
        """Every business with a pin published and not yet checked today — the
        day-change ticker's own query (`upkeep` subtask)."""
        ...
