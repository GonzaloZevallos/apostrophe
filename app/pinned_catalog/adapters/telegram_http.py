"""The one adapter that reaches Telegram's HTTP API (ADR-0023): plain text plus UTF-16
`entities` of type `bold`, no `parse_mode`; `urllib` with a 10 s timeout and an
injectable opener, so no test needs the network or a real token (the plan's
invariant). `classify` matches Telegram's answer over a fixed table of lowercase
substrings and keeps no part of the description (CODING_STANDARDS §9); every failure
this module raises carries a fixed message and is raised `from None`, so Telegram's own
wording — which could carry a chat id or a hint about the token — never reaches a log
or a response.

This is the only module that reads Telegram's `error_code` or description. It reports
a *cause* (`SendRefusal`) and never decides which action's error that becomes: it never
raises `BotCannotPost`, which only `ChannelTelegram` produces.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from typing import Literal, NoReturn, Protocol

from app.pinned_catalog.application.ports import EditOutcome
from app.pinned_catalog.domain.errors import (
    MessageGone,
    SendRefusal,
    TelegramRefused,
    TelegramUnreachable,
    TooLong,
)

API_BASE = "https://api.telegram.org/bot"
TIMEOUT_SECONDS = 10.0

Outcome = SendRefusal | Literal["unchanged", "message_gone", "too_long", "telegram_unreachable"]
Classifier = Callable[[int | None, str], Outcome]

UNCHANGED = "message is not modified"
MESSAGE_GONE_MARKERS = ("message to edit not found", "message to pin not found")
TOO_LONG_MARKER = "message is too long"
CHAT_NOT_STARTED_MARKERS = ("bot can't initiate conversation", "bot was blocked by the user")
CHAT_NOT_FOUND_MARKER = "chat not found"
NO_RIGHTS_MARKERS = ("not enough rights", "bot was kicked", "bot is not a member")


def classify(error_code: int | None, description: str) -> Outcome:
    """The plan's own table for send, edit and pin, checked in order. The markers are
    community reports of Telegram's wording, not captured responses (ADR-0023): a wrong
    row degrades to a less specific cause, never to the channel's reason."""
    lowered = description.lower()
    if UNCHANGED in lowered:
        return "unchanged"
    if any(marker in lowered for marker in MESSAGE_GONE_MARKERS):
        return "message_gone"
    if TOO_LONG_MARKER in lowered:
        return "too_long"
    if error_code in (401, 404):
        return SendRefusal.TOKEN_INVALID
    if any(marker in lowered for marker in CHAT_NOT_STARTED_MARKERS):
        return SendRefusal.CHAT_NOT_STARTED
    if CHAT_NOT_FOUND_MARKER in lowered:
        return SendRefusal.CHAT_NOT_FOUND
    if any(marker in lowered for marker in NO_RIGHTS_MARKERS):
        return SendRefusal.NO_RIGHTS
    if error_code == 429 or (error_code is not None and error_code >= 500):
        return "telegram_unreachable"
    if error_code is not None and 400 <= error_code < 500:
        return SendRefusal.OTHER
    return "telegram_unreachable"  # a timeout or no connection: no `error_code` at all


def _raise(outcome: Outcome) -> NoReturn:
    if isinstance(outcome, SendRefusal):
        raise TelegramRefused(outcome) from None
    if outcome == "message_gone":
        raise MessageGone() from None
    if outcome == "too_long":
        raise TooLong() from None
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
    """The real `TelegramApi` adapter; `app.main` builds exactly one, used from no test
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
        despite Telegram's own `ok: false` ("message is not modified")."""
        body = self._post(method, token, payload, classify)
        if body is None:
            return None
        result = _parse_body(body).get("result")
        if not isinstance(result, dict):
            raise TelegramUnreachable() from None
        return result

    def _post(
        self, method: str, token: str, payload: dict[str, object], classifier: Classifier
    ) -> bytes | None:
        """The transport alone: answers the response body, or `None` when `classifier`
        says "unchanged". Every other failure is classified and raised; the original
        exception, and whatever it carries, is never kept (`raise ... from None`)."""
        url = f"{API_BASE}{token}/{method}"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with self._opener(request, TIMEOUT_SECONDS) as response:
                body: bytes = response.read()
        except urllib.error.HTTPError as exc:
            error_code, description = _parse_error(exc.read())
            outcome = classifier(error_code, description)
            if outcome == "unchanged":
                return None
            _raise(outcome)
        except (urllib.error.URLError, TimeoutError, OSError):
            raise TelegramUnreachable() from None
        return body


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
