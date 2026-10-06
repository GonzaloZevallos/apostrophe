from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.pinned_catalog.application.ports import SettingsSnapshot
from app.pinned_catalog.application.push import TestSendResult
from app.pinned_catalog.domain.status import PinStatus


class PinStatusOut(BaseModel):
    state: Literal["up_to_date", "out_of_date"]
    reason: (
        Literal[
            "telegram_unreachable",
            "bot_cannot_post",
            "message_gone",
            "missing_publish",
            "too_long",
        ]
        | None
    )
    last_published_on: date | None

    @classmethod
    def of(cls, status: PinStatus) -> PinStatusOut:
        return cls(
            state=status.state, reason=status.reason, last_published_on=status.last_published_on
        )


class PinnedCatalogOut(BaseModel):
    token_saved_on: date | None
    own_chat: str | None
    channel_chat: str | None
    can_publish: bool
    publish_blocked_by: Literal["not_tested", "channel_missing"] | None
    status: PinStatusOut | None

    @classmethod
    def of(cls, settings: SettingsSnapshot, status: PinStatus | None) -> PinnedCatalogOut:
        blocked_by: Literal["not_tested", "channel_missing"] | None = None
        if settings.token is None:
            blocked_by = "not_tested"
        elif settings.channel_chat is None:
            blocked_by = "channel_missing"
        return cls(
            token_saved_on=settings.token_saved_on,
            own_chat=settings.own_chat,
            channel_chat=settings.channel_chat,
            can_publish=blocked_by is None,
            publish_blocked_by=blocked_by,
            status=PinStatusOut.of(status) if status is not None else None,
        )


class PinnedCatalogTestOut(PinnedCatalogOut):
    previous_pin_left: bool

    @classmethod
    def of_result(cls, result: TestSendResult, status: PinStatus | None) -> PinnedCatalogTestOut:
        base = PinnedCatalogOut.of(result.settings, status)
        return cls(previous_pin_left=result.previous_pin_left, **base.model_dump())


class PinnedCatalogStatusOut(BaseModel):
    status: PinStatusOut | None


class PinnedCatalogTestIn(BaseModel):
    token: str | None
    own_chat: str
    channel_chat: str | None


class OwnChatLookupIn(BaseModel):
    token: str | None


class OwnChatLookupOut(BaseModel):
    own_chat: str
