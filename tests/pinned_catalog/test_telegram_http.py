"""`classify` and `HttpTelegram` with an injected opener (the plan's declared seam):
every row of ADR-0023's table, and the invariant that no token or URL ever reaches an
exception's text."""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from email.message import Message

import pytest

from app.pinned_catalog.adapters.telegram_http import HttpTelegram, classify
from app.pinned_catalog.domain.errors import (
    BotCannotPost,
    MessageGone,
    TelegramUnreachable,
    TooLong,
)

SECRET_TOKEN = "123456789:AAour-secret-token-value"


@pytest.mark.parametrize(
    ("description", "error_code", "expected"),
    [
        ("Bad Request: message is not modified", 400, "unchanged"),
        ("Bad Request: message to edit not found", 400, "message_gone"),
        ("Bad Request: message to pin not found", 400, "message_gone"),
        ("Bad Request: message is too long", 400, "too_long"),
        ("Bad Request: chat not found", 400, "bot_cannot_post"),
        ("Forbidden: bot was kicked from the channel", 403, "bot_cannot_post"),
        ("Forbidden: bot is not a member of the channel", 403, "bot_cannot_post"),
        ("Bad Request: not enough rights to send text messages", 400, "bot_cannot_post"),
        ("Unauthorized", 401, "bot_cannot_post"),
        ("Too Many Requests: retry later", 429, "telegram_unreachable"),
        ("Internal Server Error", 500, "telegram_unreachable"),
        ("Bad Gateway", 502, "telegram_unreachable"),
        ("some other refusal", 404, "bot_cannot_post"),
        ("", None, "telegram_unreachable"),
    ],
)
def test_classify_matches_the_plan_s_fixed_table(
    description: str, error_code: int | None, expected: str
) -> None:
    assert classify("editMessageText", error_code, description) == expected


class _FakeResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None


def _ok(result: object) -> _FakeResponse:
    return _FakeResponse(json.dumps({"ok": True, "result": result}).encode("utf-8"))


def _http_error(status: int, error_code: int, description: str) -> urllib.error.HTTPError:
    body = json.dumps({"ok": False, "error_code": error_code, "description": description}).encode(
        "utf-8"
    )
    return urllib.error.HTTPError(
        "https://api.telegram.org/bot<redacted>/sendMessage",
        status,
        description,
        Message(),
        io.BytesIO(body),
    )


def test_send_answers_the_new_message_id() -> None:
    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        return _ok({"message_id": 42})

    telegram = HttpTelegram(opener=opener)

    message_id = telegram.send(SECRET_TOKEN, "@channel", "hola", [])

    assert message_id == 42


def test_edit_answers_unchanged_without_raising() -> None:
    error = _http_error(400, 400, "Bad Request: message is not modified")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    outcome = telegram.edit(SECRET_TOKEN, "@channel", 42, "hola", [])

    assert outcome == "unchanged"


def test_edit_answers_edited_on_a_real_change() -> None:
    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        return _ok({"message_id": 42})

    telegram = HttpTelegram(opener=opener)

    outcome = telegram.edit(SECRET_TOKEN, "@channel", 42, "hola", [])

    assert outcome == "edited"


def test_edit_raises_message_gone() -> None:
    error = _http_error(400, 400, "Bad Request: message to edit not found")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(MessageGone):
        telegram.edit(SECRET_TOKEN, "@channel", 42, "hola", [])


def test_send_raises_bot_cannot_post_on_chat_not_found() -> None:
    error = _http_error(400, 400, "Bad Request: chat not found")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(BotCannotPost):
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])


def test_send_raises_telegram_unreachable_on_a_server_error() -> None:
    error = _http_error(500, 500, "Internal Server Error")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(TelegramUnreachable):
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])


def test_send_raises_too_long_as_a_backstop() -> None:
    error = _http_error(400, 400, "Bad Request: message is too long")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(TooLong):
        telegram.send(SECRET_TOKEN, "@channel", "x" * 5000, [])


def test_a_connection_error_raises_telegram_unreachable() -> None:
    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise urllib.error.URLError("no connection")

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(TelegramUnreachable):
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])


def test_no_exception_text_ever_carries_the_token_or_the_url() -> None:
    """The enforcement artefact (CODING_STANDARDS §9: no token, chat or Telegram
    wording in any exception message) exercised on the one path that handles
    Telegram's own answer, not only on the fixed messages' own literals."""
    error = _http_error(403, 403, f"Forbidden: bot was kicked, token was bot{SECRET_TOKEN}")

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise error

    telegram = HttpTelegram(opener=opener)

    with pytest.raises(BotCannotPost) as excinfo:
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])

    assert SECRET_TOKEN not in str(excinfo.value)
    assert "kicked" not in str(excinfo.value)


def test_entities_are_sent_as_bold_with_no_parse_mode() -> None:
    sent_payloads: list[dict[str, object]] = []

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        data = request.data
        assert isinstance(data, bytes)
        sent_payloads.append(json.loads(data.decode("utf-8")))
        return _ok({"message_id": 1})

    telegram = HttpTelegram(opener=opener)

    telegram.send(SECRET_TOKEN, "@channel", "hola mundo", [(0, 4)])

    assert sent_payloads == [
        {
            "chat_id": "@channel",
            "text": "hola mundo",
            "entities": [{"type": "bold", "offset": 0, "length": 4}],
        }
    ]
    assert "parse_mode" not in sent_payloads[0]
