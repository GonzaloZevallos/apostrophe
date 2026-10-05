"""The one adapter that reaches Telegram's HTTP API (ADR-0022): plain text plus UTF-16
`entities` of type `bold`, no `parse_mode`; `urllib` with a 10 s timeout and an
injectable opener, so no test needs the network or a real token (the plan's
invariant). `classify` matches Telegram's answer over a fixed table of lowercase
substrings and keeps no part of the description (CODING_STANDARDS §9); every failure
this module raises carries a fixed message and is raised `from None`, so Telegram's own
wording — which could carry a chat id or a hint about the token — never reaches a log
or a response.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from typing import NoReturn, Protocol

from app.pinned_catalog.application.ports import EditOutcome
from app.pinned_catalog.domain.errors import (
    BotCannotPost,
    MessageGone,
    TelegramUnreachable,
    TooLong,
)

API_BASE = "https://api.telegram.org/bot"
TIMEOUT_SECONDS = 10.0

#: "unchanged" | "message_gone" | "too_long" | "bot_cannot_post" | "telegram_unreachable"
Outcome = str

UNCHANGED = "message is not modified"
MESSAGE_GONE_MARKERS = ("message to edit not found", "message to pin not found")
TOO_LONG_MARKER = "message is too long"
BOT_CANNOT_POST_MARKERS = (
    "chat not found",
    "not enough rights",
    "bot was kicked",
    "bot is not a member",
)


def classify(method: str, error_code: int | None, description: str) -> Outcome:
    """The plan's own table, checked in order: a description match first, then
    `error_code`. `method` is accepted but never inspected — every marker below already
    names the one call it can come from."""
    del method
    lowered = description.lower()
    if UNCHANGED in lowered:
        return "unchanged"
    if any(marker in lowered for marker in MESSAGE_GONE_MARKERS):
        return "message_gone"
    if TOO_LONG_MARKER in lowered:
        return "too_long"
    if error_code == 401 or any(marker in lowered for marker in BOT_CANNOT_POST_MARKERS):
        return "bot_cannot_post"
    if error_code == 429 or (error_code is not None and error_code >= 500):
        return "telegram_unreachable"
    if error_code is not None and 400 <= error_code < 500:
        return "bot_cannot_post"
    return "telegram_unreachable"  # a timeout or no connection: no `error_code` at all


def _raise(outcome: Outcome) -> NoReturn:
    if outcome == "message_gone":
        raise MessageGone() from None
    if outcome == "too_long":
        raise TooLong() from None
    if outcome == "bot_cannot_post":
        raise BotCannotPost() from None
    raise TelegramUnreachable() from None


class _Response(Protocol):
    def read(self) -> bytes: ...
    def __enter__(self) -> _Response: ...
    def __exit__(self, *args: object) -> None: ...


Opener = Callable[[urllib.request.Request, float], _Response]


def _default_opener(request: urllib.request.Request, timeout: float) -> _Response:
    response: _Response = urllib.request.urlopen(request, timeout=timeout)
    return response


def _entities(spans: Sequence[tuple[int, int]]) -> list[dict[str, object]]:
    return [{"type": "bold", "offset": offset, "length": length} for offset, length in spans]


class HttpTelegram:
    """The real `Telegram` adapter; `app.main` builds exactly one, used from no test
    but its own (the plan's invariant)."""

    def __init__(self, opener: Opener = _default_opener) -> None:
        self._opener = opener

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        result = self._call(
            "sendMessage", token, {"chat_id": chat, "text": plain, "entities": _entities(spans)}
        )
        assert result is not None, "sendMessage never answers 'message is not modified'"
        message_id = result["message_id"]
        assert isinstance(message_id, int)
        return message_id

    def edit(
        self,
        token: str,
        chat: str,
        message_id: int,
        plain: str,
        spans: Sequence[tuple[int, int]],
    ) -> EditOutcome:
        payload: dict[str, object] = {
            "chat_id": chat,
            "message_id": message_id,
            "text": plain,
            "entities": _entities(spans),
        }
        result = self._call("editMessageText", token, payload)
        return "unchanged" if result is None else "edited"

    def pin(self, token: str, chat: str, message_id: int) -> None:
        self._call(
            "pinChatMessage",
            token,
            {"chat_id": chat, "message_id": message_id, "disable_notification": True},
        )

    def _call(
        self, method: str, token: str, payload: dict[str, object]
    ) -> dict[str, object] | None:
        """Answers the parsed `result`, or `None` for the one case that is a success
        despite Telegram's own `ok: false` ("message is not modified"). Every other
        failure is classified and raised; the original exception, and whatever it
        carries, is never kept (`raise ... from None`)."""
        url = f"{API_BASE}{token}/{method}"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with self._opener(request, TIMEOUT_SECONDS) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            error_body = exc.read()
            error_code, description = _parse_error(error_body)
            outcome = classify(method, error_code, description)
            if outcome == "unchanged":
                return None
            _raise(outcome)
        except (urllib.error.URLError, TimeoutError, OSError):
            raise TelegramUnreachable() from None

        parsed = _parse_body(body)
        result = parsed.get("result")
        if not isinstance(result, dict):
            raise TelegramUnreachable() from None
        return result


def _parse_body(body: bytes) -> dict[str, object]:
    try:
        parsed = json.loads(body)
    except ValueError:
        raise TelegramUnreachable() from None
    if not isinstance(parsed, dict):
        raise TelegramUnreachable() from None
    return parsed


def _parse_error(body: bytes) -> tuple[int | None, str]:
    try:
        parsed = json.loads(body)
    except ValueError:
        return None, ""
    if not isinstance(parsed, dict):
        return None, ""
    error_code = parsed.get("error_code")
    description = parsed.get("description")
    return (
        error_code if isinstance(error_code, int) else None,
        description if isinstance(description, str) else "",
    )
