"""`FakeTelegram` (the plan's own fixture): the only `TelegramApi` the test app ever
wires in (`tests/conftest.py`'s `app` fixture), so no test but
`tests/pinned_catalog/test_telegram_http.py` ever constructs the real adapter."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field

from app.pinned_catalog.application.ports import EditOutcome
from app.pinned_catalog.domain.errors import MessageGone


@dataclass
class _Message:
    plain: str


@dataclass
class FakeTelegram:
    calls: list[tuple[str, ...]] = field(default_factory=list)
    _messages: dict[tuple[str, str], dict[int, _Message]] = field(default_factory=dict)
    _next_id: int = 1
    _failure: BaseException | None = None
    _failure_method: str | None = None

    def fail_next(self, exc: BaseException, method: str | None = None) -> None:
        """The next call raises `exc` instead of acting: the next call of any method,
        or, given `method` ("send", "edit" or "pin"), the next call of that one."""
        self._failure = exc
        self._failure_method = method

    def delete(self, token: str, chat: str, message_id: int) -> None:
        """Simulates the pinned message being deleted by hand in Telegram: the next
        `edit` or `pin` against it answers as Telegram would — "message to edit/pin
        not found"."""
        self._messages.get((token, chat), {}).pop(message_id, None)

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        self._maybe_raise("send")
        message_id = self._next_id
        self._next_id += 1
        self._messages.setdefault((token, chat), {})[message_id] = _Message(plain)
        self.calls.append(("send", token, chat, plain))
        return message_id

    def edit(
        self,
        token: str,
        chat: str,
        message_id: int,
        plain: str,
        spans: Sequence[tuple[int, int]],
    ) -> EditOutcome:
        self._maybe_raise("edit")
        messages = self._messages.get((token, chat), {})
        message = messages.get(message_id)
        if message is None:
            raise MessageGone()
        self.calls.append(("edit", token, chat, plain))
        if message.plain == plain:
            return "unchanged"
        message.plain = plain
        return "edited"

    def pin(self, token: str, chat: str, message_id: int) -> None:
        self._maybe_raise("pin")
        self.calls.append(("pin", token, chat, str(message_id)))

    def text_of(self, token: str, chat: str, message_id: int) -> str | None:
        message = self._messages.get((token, chat), {}).get(message_id)
        return None if message is None else message.plain

    def stored_message_id(self, token: str, chat: str) -> int | None:
        """The one message id posted to `chat` with `token`, if any — a public seam for
        a test that needs it (`delete` already needed one), so no test reaches
        `_messages` itself."""
        messages = self._messages.get((token, chat), {})
        return next(iter(messages), None)

    def _maybe_raise(self, method: str) -> None:
        if self._failure is not None and self._failure_method in (None, method):
            exc, self._failure = self._failure, None
            raise exc
