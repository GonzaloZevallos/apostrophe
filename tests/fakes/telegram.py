"""`FakeTelegram` (the plan's own fixture): the only `Telegram` the test app ever
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

    def fail_next(self, exc: BaseException) -> None:
        """The next call (send, edit or pin) raises `exc` instead of acting."""
        self._failure = exc

    def delete(self, token: str, chat: str, message_id: int) -> None:
        """Simulates the pinned message being deleted by hand in Telegram: the next
        `edit` or `pin` against it answers as Telegram would — "message to edit/pin
        not found"."""
        self._messages.get((token, chat), {}).pop(message_id, None)

    def send(self, token: str, chat: str, plain: str, spans: Sequence[tuple[int, int]]) -> int:
        self._maybe_raise()
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
        self._maybe_raise()
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
        self._maybe_raise()
        self.calls.append(("pin", token, chat, str(message_id)))

    def text_of(self, token: str, chat: str, message_id: int) -> str | None:
        message = self._messages.get((token, chat), {}).get(message_id)
        return None if message is None else message.plain

    def _maybe_raise(self) -> None:
        if self._failure is not None:
            exc, self._failure = self._failure, None
            raise exc
