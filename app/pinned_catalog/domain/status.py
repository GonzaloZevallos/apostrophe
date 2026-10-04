"""The pinned catalog's status (plan's invariant: only `pin_status` derives the status
and its reason; routes answer codes and the front maps them).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Literal


class PinFailure(StrEnum):
    TELEGRAM_UNREACHABLE = "telegram_unreachable"
    BOT_CANNOT_POST = "bot_cannot_post"
    MESSAGE_GONE = "message_gone"
    TOO_LONG = "too_long"


RETRYABLE = frozenset({PinFailure.TELEGRAM_UNREACHABLE})

PinState = Literal["up_to_date", "out_of_date"]
PinReason = Literal[
    "telegram_unreachable", "bot_cannot_post", "message_gone", "missing_publish", "too_long"
]


@dataclass(frozen=True)
class PinSettings:
    """What is currently saved, the part `pin_status` compares against the pin."""

    token_fingerprint: str | None
    channel_chat: str | None


@dataclass(frozen=True)
class Pin:
    """What was last published, and the result of the last attempt. `last_published_on`
    is the Argentina date of `last_published_at` (computed by the caller, never here:
    the domain owns no timezone), already `None` in the "never published" and
    "settings changed since" cases."""

    message_token_fingerprint: str | None
    message_chat: str | None
    last_published_text: str | None
    last_published_on: date | None
    last_failure: PinFailure | None


@dataclass(frozen=True)
class PinStatus:
    state: PinState
    reason: PinReason | None
    last_published_on: date | None


def pin_status(settings: PinSettings, pin: Pin) -> PinStatus | None:
    """Precedence, first match wins (the plan's own order):

    1. never published -> `None`, no status shows;
    2. the saved token or channel no longer matches what was last published ->
       `out_of_date`/`missing_publish`, with no last-published date;
    3. a recorded failure -> `out_of_date` with that reason;
    4. otherwise -> `up_to_date`.
    """
    if pin.last_published_on is None:
        return None
    if (
        settings.token_fingerprint != pin.message_token_fingerprint
        or settings.channel_chat != pin.message_chat
    ):
        return PinStatus("out_of_date", "missing_publish", None)
    if pin.last_failure is not None:
        return PinStatus("out_of_date", pin.last_failure.value, pin.last_published_on)
    return PinStatus("up_to_date", None, pin.last_published_on)


def needs_send(text: str, pin: Pin) -> bool:
    """Upkeep skips the call only when the text is unchanged *and* nothing is wrong
    with the last attempt (the plan's own rule): a failure must be retried even over
    unchanged text."""
    return not (text == pin.last_published_text and pin.last_failure is None)
