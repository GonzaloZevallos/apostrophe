"""`HttpTelegram` with an injected opener (the plan's declared seam): every row of
ADR-0023's table, and the invariant that no token or URL ever reaches an exception's
text. The error bodies below are community reports of Telegram's wording, **not
captured** responses: a wrong row degrades to a less specific cause (`OTHER`), never to
the channel's reason, and the adapter never raises `BotCannotPost` at all."""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from collections.abc import Callable
from email.message import Message

import pytest

from app.pinned_catalog.adapters.telegram_http import HttpTelegram, Opener
from app.pinned_catalog.domain.errors import (
    MessageGone,
    SendRefusal,
    TelegramRefused,
    TelegramUnreachable,
    TooLong,
)

SECRET_TOKEN = "123456789:AAour-secret-token-value"


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
    return _http_error_with_body(status, body)


def _http_error_with_body(status: int, body: bytes) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        "https://api.telegram.org/bot<redacted>/sendMessage",
        status,
        "error",
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

    with pytest.raises(TelegramRefused) as excinfo:
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])

    assert SECRET_TOKEN not in str(excinfo.value)
    assert "kicked" not in str(excinfo.value)
    assert excinfo.value.__cause__ is None
    assert excinfo.value.__suppress_context__ is True


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


def _raising(make_error: Callable[[], BaseException]) -> Opener:
    """A fresh error per call: an `HTTPError`'s body can be read once."""

    def opener(request: urllib.request.Request, timeout: float) -> _FakeResponse:
        raise make_error()

    return opener


# One full JSON error body per row of the plan's table, in the table's order, each with
# what `send` must raise (a `SendRefusal` cause, or another outcome's own error).
SEND_ROWS: list[tuple[str, int, str, SendRefusal | type[Exception]]] = [
    ("401", 401, "Unauthorized", SendRefusal.TOKEN_INVALID),
    ("404", 404, "Not Found", SendRefusal.TOKEN_INVALID),
    (
        "not started",
        403,
        "Forbidden: bot can't initiate conversation with a user",
        SendRefusal.CHAT_NOT_STARTED,
    ),
    (
        "blocked",
        403,
        "Forbidden: bot was blocked by the user",
        SendRefusal.CHAT_NOT_STARTED,
    ),
    ("chat not found", 400, "Bad Request: chat not found", SendRefusal.CHAT_NOT_FOUND),
    (
        "kicked",
        403,
        "Forbidden: bot was kicked from the channel chat",
        SendRefusal.NO_RIGHTS,
    ),
    (
        "not a member",
        403,
        "Forbidden: bot is not a member of the channel chat",
        SendRefusal.NO_RIGHTS,
    ),
    (
        "no rights",
        400,
        "Bad Request: not enough rights to send text messages to the chat",
        SendRefusal.NO_RIGHTS,
    ),
    ("429", 429, "Too Many Requests: retry after 5", TelegramUnreachable),
    ("500", 500, "Internal Server Error", TelegramUnreachable),
    ("502", 502, "Bad Gateway", TelegramUnreachable),
    ("other 4xx", 400, "Bad Request: something nobody mapped", SendRefusal.OTHER),
    ("too long", 400, "Bad Request: message is too long", TooLong),
]


@pytest.mark.parametrize(
    ("error_code", "description", "expected"),
    [row[1:] for row in SEND_ROWS],
    ids=[row[0] for row in SEND_ROWS],
)
def test_send_reports_the_cause_of_each_row(
    error_code: int, description: str, expected: SendRefusal | type[Exception]
) -> None:
    telegram = HttpTelegram(
        opener=_raising(lambda: _http_error(error_code, error_code, description))
    )

    with pytest.raises(Exception) as excinfo:
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])

    if isinstance(expected, SendRefusal):
        assert isinstance(excinfo.value, TelegramRefused)
        assert excinfo.value.cause is expected
    else:
        assert type(excinfo.value) is expected


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Bad Request: message to edit not found: chat not found", MessageGone),
        ("Bad Request: message to pin not found: chat not found", MessageGone),
    ],
)
def test_a_message_that_is_gone_wins_over_the_chat_markers(
    description: str, expected: type[Exception]
) -> None:
    telegram = HttpTelegram(opener=_raising(lambda: _http_error(400, 400, description)))

    with pytest.raises(expected):
        telegram.edit(SECRET_TOKEN, "@channel", 42, "hola", [])
    with pytest.raises(expected):
        telegram.pin(SECRET_TOKEN, "@channel", 42)


@pytest.mark.parametrize("call", ["send", "edit", "pin"])
def test_every_call_reports_a_refusal_cause(call: str) -> None:
    telegram = HttpTelegram(
        opener=_raising(lambda: _http_error(400, 400, "Bad Request: chat not found"))
    )

    with pytest.raises(TelegramRefused) as excinfo:
        if call == "send":
            telegram.send(SECRET_TOKEN, "@channel", "hola", [])
        elif call == "edit":
            telegram.edit(SECRET_TOKEN, "@channel", 42, "hola", [])
        else:
            telegram.pin(SECRET_TOKEN, "@channel", 42)

    assert excinfo.value.cause is SendRefusal.CHAT_NOT_FOUND


@pytest.mark.parametrize("body", [b"not json", b"[1, 2]", b'{"ok": false}', b""])
def test_an_error_body_with_no_error_code_is_unreachable_as_before(body: bytes) -> None:
    telegram = HttpTelegram(opener=_raising(lambda: _http_error_with_body(400, body)))

    with pytest.raises(TelegramUnreachable):
        telegram.send(SECRET_TOKEN, "@channel", "hola", [])

