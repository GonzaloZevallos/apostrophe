"""Probarlo and Publicar/upkeep (plan, "How a sync runs"): read in a closed session,
call Telegram with no session open, then record in a new short transaction that writes
only if the saved token fingerprint and channel chat are unchanged. This module is the
only owner of the per-business lock (the plan's invariant), and `PinRecorder.record`'s
only caller; `SettingsWriter.save` is called only from here, by `test_send`, and only
after a successful send.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from app.clock import business_day
from app.pinned_catalog.application.ports import (
    PinFacts,
    PinRecorder,
    PinSnapshots,
    SettingsSnapshot,
    SettingsWriter,
    Telegram,
)
from app.pinned_catalog.domain.bold import fits_in_one_message, telegram_bold
from app.pinned_catalog.domain.errors import (
    BotCannotPost,
    MessageGone,
    NotReady,
    OwnChatRequired,
    TelegramUnreachable,
    TokenRequired,
    TooLong,
)
from app.pinned_catalog.domain.status import Pin, PinFailure, PinSettings, PinStatus, pin_status
from app.pinned_catalog.domain.status import needs_send as domain_needs_send


class BusinessLocks:
    """One `threading.Lock` per business, created on first use: `push` and `test_send`
    are the only code that takes it, so no two attempts for the same business ever
    read, call Telegram and record at once (the plan's invariant). Correct only
    in-process — `scripts/serve.sh` runs one uvicorn worker (the plan's own note)."""

    def __init__(self) -> None:
        self._locks: dict[int, threading.Lock] = {}
        self._guard = threading.Lock()

    def for_business(self, business_id: int) -> threading.Lock:
        with self._guard:
            lock = self._locks.get(business_id)
            if lock is None:
                lock = threading.Lock()
                self._locks[business_id] = lock
            return lock


def _published_on(facts: PinFacts) -> date | None:
    return business_day(facts.last_published_at) if facts.last_published_at is not None else None


def status_of(settings: SettingsSnapshot, facts: PinFacts) -> PinStatus | None:
    """The one seam both `push` and the router ask what the status is, wrapping
    `pin_status` (the plan's invariant: only `pin_status` derives it) with the
    Argentina-date conversion the domain itself never does."""
    return pin_status(
        PinSettings(
            token_fingerprint=settings.token_fingerprint, channel_chat=settings.channel_chat
        ),
        Pin(
            message_token_fingerprint=facts.message_token_fingerprint,
            message_chat=facts.message_chat,
            last_published_text=facts.last_published_text,
            last_published_on=_published_on(facts),
            last_failure=facts.last_failure,
        ),
    )


@dataclass(frozen=True)
class TestSendResult:
    settings: SettingsSnapshot
    previous_pin_left: bool


def test_send(
    telegram: Telegram,
    snapshots: PinSnapshots,
    settings_writer: SettingsWriter,
    locks: BusinessLocks,
    business_id: int,
    token: str | None,
    own_chat: str,
    channel_chat: str | None,
    today: date,
) -> TestSendResult:
    """Probarlo (CONTEXT.md: Test send): tests the typed values, not the saved ones,
    and only on success saves them — never a read followed by an unconditional write."""
    with locks.for_business(business_id):
        current = snapshots.snapshot(business_id, today)
        effective_token = token if token is not None else current.settings.token
        if effective_token is None:
            raise TokenRequired()
        if own_chat == "":
            raise OwnChatRequired()
        plain, spans = telegram_bold(current.text)
        if not fits_in_one_message(plain):
            raise TooLong()

        telegram.send(effective_token, own_chat, plain, spans)

        token_changed = token is not None and token != current.settings.token
        channel_changed = channel_chat != current.settings.channel_chat
        previous_pin_left = current.pin.message_id is not None and (
            token_changed or channel_changed
        )

        saved = settings_writer.save(business_id, token, own_chat, channel_chat, today)
        return TestSendResult(settings=saved, previous_pin_left=previous_pin_left)


def push(
    telegram: Telegram,
    snapshots: PinSnapshots,
    recorder: PinRecorder,
    locks: BusinessLocks,
    business_id: int,
    mode: Literal["publish", "upkeep"],
    today: date,
    now: datetime,
) -> None:
    """Publicar and upkeep (plan, "How a sync runs" and "Calls per action"): both reach
    this, so they can never post, edit or pin differently for the same facts."""
    with locks.for_business(business_id):
        snap = snapshots.snapshot(business_id, today)
        settings = snap.settings
        facts = snap.pin
        text = snap.text
        status = status_of(settings, facts)
        missing_publish = status is not None and status.reason == "missing_publish"

        if mode == "upkeep":
            _push_upkeep(
                telegram, recorder, business_id, settings, facts, text, today, now, missing_publish
            )
            return

        if settings.token is None or settings.channel_chat is None:
            raise NotReady()
        _push_publish(telegram, recorder, business_id, settings, facts, text, today, now)


def _push_upkeep(
    telegram: Telegram,
    recorder: PinRecorder,
    business_id: int,
    settings: SettingsSnapshot,
    facts: PinFacts,
    text: str,
    today: date,
    now: datetime,
    missing_publish: bool,
) -> None:
    if facts.last_published_at is None or missing_publish:
        # Never published, or the settings changed since: upkeep attempts nothing in a
        # chat it has not published to (the plan's invariant); it only advances the
        # checked date.
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=facts.last_failure,
            last_checked_on=today,
        )
        return

    pin_for_needs_send = Pin(
        message_token_fingerprint=facts.message_token_fingerprint,
        message_chat=facts.message_chat,
        last_published_text=facts.last_published_text,
        last_published_on=_published_on(facts),
        last_failure=facts.last_failure,
    )
    if not domain_needs_send(text, pin_for_needs_send):
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=None,
            last_checked_on=today,
        )
        return

    plain, spans = telegram_bold(text)
    if not fits_in_one_message(plain):
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=PinFailure.TOO_LONG,
            last_checked_on=today,
        )
        return

    assert settings.token is not None
    assert settings.channel_chat is not None
    assert facts.message_id is not None
    try:
        telegram.edit(settings.token, settings.channel_chat, facts.message_id, plain, spans)
    except TelegramUnreachable:
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=PinFailure.TELEGRAM_UNREACHABLE,
            last_checked_on=facts.last_checked_on,
        )
        return
    except BotCannotPost:
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=PinFailure.BOT_CANNOT_POST,
            last_checked_on=today,
        )
        return
    except MessageGone:
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=PinFailure.MESSAGE_GONE,
            last_checked_on=today,
        )
        return

    recorder.record(
        business_id,
        settings.token_fingerprint,
        settings.channel_chat,
        message_id=facts.message_id,
        message_chat=settings.channel_chat,
        message_token_fingerprint=settings.token_fingerprint,
        last_published_text=text,
        last_published_at=now,
        last_failure=None,
        last_checked_on=today,
    )


def _push_publish(
    telegram: Telegram,
    recorder: PinRecorder,
    business_id: int,
    settings: SettingsSnapshot,
    facts: PinFacts,
    text: str,
    today: date,
    now: datetime,
) -> None:
    assert settings.token is not None
    assert settings.channel_chat is not None
    plain, spans = telegram_bold(text)
    if not fits_in_one_message(plain):
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=PinFailure.TOO_LONG,
            last_checked_on=today,
        )
        raise TooLong()

    has_message_here = (
        facts.message_id is not None
        and facts.message_chat == settings.channel_chat
        and facts.message_token_fingerprint == settings.token_fingerprint
    )

    try:
        if has_message_here:
            assert facts.message_id is not None
            try:
                telegram.edit(settings.token, settings.channel_chat, facts.message_id, plain, spans)
                message_id = facts.message_id
            except MessageGone:
                message_id = telegram.send(settings.token, settings.channel_chat, plain, spans)
        else:
            message_id = telegram.send(settings.token, settings.channel_chat, plain, spans)
    except (TelegramUnreachable, BotCannotPost) as exc:
        failure = (
            PinFailure.TELEGRAM_UNREACHABLE
            if isinstance(exc, TelegramUnreachable)
            else PinFailure.BOT_CANNOT_POST
        )
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=facts.message_id,
            message_chat=facts.message_chat,
            message_token_fingerprint=facts.message_token_fingerprint,
            last_published_text=facts.last_published_text,
            last_published_at=facts.last_published_at,
            last_failure=failure,
            last_checked_on=today,
        )
        raise

    try:
        telegram.pin(settings.token, settings.channel_chat, message_id)
    except (TelegramUnreachable, BotCannotPost) as exc:
        failure = (
            PinFailure.TELEGRAM_UNREACHABLE
            if isinstance(exc, TelegramUnreachable)
            else PinFailure.BOT_CANNOT_POST
        )
        # The new message id is still recorded even though the pin failed (the plan's
        # invariant), so the next attempt edits it rather than posting again.
        recorder.record(
            business_id,
            settings.token_fingerprint,
            settings.channel_chat,
            message_id=message_id,
            message_chat=settings.channel_chat,
            message_token_fingerprint=settings.token_fingerprint,
            last_published_text=text,
            last_published_at=now,
            last_failure=failure,
            last_checked_on=today,
        )
        raise

    recorder.record(
        business_id,
        settings.token_fingerprint,
        settings.channel_chat,
        message_id=message_id,
        message_chat=settings.channel_chat,
        message_token_fingerprint=settings.token_fingerprint,
        last_published_text=text,
        last_published_at=now,
        last_failure=None,
        last_checked_on=today,
    )
