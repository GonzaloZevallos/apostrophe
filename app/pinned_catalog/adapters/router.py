"""The pinned-catalog routes (plan, "API"): every one gated by `require_session`
(`app.main`) and taking its business only from the session (CODING_STANDARDS §9)."""

from __future__ import annotations

from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.http_errors import TranslateErrors
from app.pinned_catalog.adapters.schemas import (
    OwnChatLookupIn,
    OwnChatLookupOut,
    PinnedCatalogOut,
    PinnedCatalogStatusOut,
    PinnedCatalogTestIn,
    PinnedCatalogTestOut,
    PinStatusOut,
)
from app.pinned_catalog.adapters.sql_recorder import SqlPinRecorder
from app.pinned_catalog.adapters.sql_settings import SqlSettingsWriter
from app.pinned_catalog.adapters.sql_snapshot import SqlPinSnapshots
from app.pinned_catalog.adapters.telegram_holder import PinnedCatalogTelegram
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.application.channel_telegram import ChannelTelegram
from app.pinned_catalog.application.own_chat_lookup import look_up_own_chat
from app.pinned_catalog.application.ports import PrivateChats, TelegramApi
from app.pinned_catalog.application.push import BusinessLocks, push, status_of, test_send
from app.pinned_catalog.domain.errors import (
    BotCannotPost,
    NoMessages,
    NotReady,
    OwnChatNotFound,
    OwnChatNotStarted,
    OwnChatRequired,
    SeveralChats,
    TelegramUnreachable,
    TestSendFailed,
    TokenInvalid,
    TokenRequired,
    TooLong,
    UpdatesUnreadable,
)

router = APIRouter(prefix="/pinned-catalog", tags=["pinned_catalog"])

TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_engine(request: Request) -> Engine:
    # Starlette's `State` is untyped; `create_app` always assigns an `Engine`.
    return cast(Engine, request.app.state.engine)


def get_channel_telegram(request: Request) -> ChannelTelegram:
    holder = cast(PinnedCatalogTelegram, request.app.state.pinned_catalog_telegram)
    return holder.channel


def get_telegram_api(request: Request) -> TelegramApi:
    holder = cast(PinnedCatalogTelegram, request.app.state.pinned_catalog_telegram)
    return holder.api


def get_private_chats(request: Request) -> PrivateChats:
    holder = cast(PinnedCatalogTelegram, request.app.state.pinned_catalog_telegram)
    return holder.updates


def get_locks(request: Request) -> BusinessLocks:
    return cast(BusinessLocks, request.app.state.pinned_catalog_locks)


def get_cipher(request: Request) -> TokenCipher:
    return cast(TokenCipher, request.app.state.pinned_catalog_cipher)


EngineDep = Annotated[Engine, Depends(get_engine)]
ChannelTelegramDep = Annotated[ChannelTelegram, Depends(get_channel_telegram)]
TelegramApiDep = Annotated[TelegramApi, Depends(get_telegram_api)]
PrivateChatsDep = Annotated[PrivateChats, Depends(get_private_chats)]
LocksDep = Annotated[BusinessLocks, Depends(get_locks)]
CipherDep = Annotated[TokenCipher, Depends(get_cipher)]


def get_snapshots(engine: EngineDep, cipher: CipherDep) -> SqlPinSnapshots:
    return SqlPinSnapshots(engine, cipher)


def get_recorder(engine: EngineDep) -> SqlPinRecorder:
    return SqlPinRecorder(engine)


def get_settings_writer(engine: EngineDep, cipher: CipherDep) -> SqlSettingsWriter:
    return SqlSettingsWriter(engine, cipher)


SnapshotsDep = Annotated[SqlPinSnapshots, Depends(get_snapshots)]
RecorderDep = Annotated[SqlPinRecorder, Depends(get_recorder)]
SettingsWriterDep = Annotated[SqlSettingsWriter, Depends(get_settings_writer)]

as_http = TranslateErrors(
    [
        (
            422,
            (
                TokenRequired,
                OwnChatRequired,
                NotReady,
                TooLong,
                TelegramUnreachable,
                BotCannotPost,
                TokenInvalid,
                OwnChatNotStarted,
                OwnChatNotFound,
                TestSendFailed,
                NoMessages,
                SeveralChats,
                UpdatesUnreadable,
            ),
        ),
    ]
)


@router.get("")
def get_pinned_catalog(
    business_id: CurrentBusinessId, snapshots: SnapshotsDep, today: TodayDep
) -> PinnedCatalogOut:
    snap = snapshots.snapshot(business_id, today)
    status = status_of(snap.settings, snap.pin)
    return PinnedCatalogOut.of(snap.settings, status)


@router.get("/status")
def get_pinned_catalog_status(
    business_id: CurrentBusinessId, snapshots: SnapshotsDep, today: TodayDep
) -> PinnedCatalogStatusOut:
    snap = snapshots.snapshot(business_id, today)
    status = status_of(snap.settings, snap.pin)
    return PinnedCatalogStatusOut(status=None if status is None else PinStatusOut.of(status))


@router.post("/test")
def post_pinned_catalog_test(
    body: PinnedCatalogTestIn,
    business_id: CurrentBusinessId,
    telegram: TelegramApiDep,
    snapshots: SnapshotsDep,
    settings_writer: SettingsWriterDep,
    locks: LocksDep,
    today: TodayDep,
) -> PinnedCatalogTestOut:
    with as_http:
        result = test_send(
            telegram,
            snapshots,
            settings_writer,
            locks,
            business_id,
            body.token,
            body.own_chat,
            body.channel_chat,
            today,
        )
        snap_after = snapshots.snapshot(business_id, today)
        status = status_of(result.settings, snap_after.pin)
        return PinnedCatalogTestOut.of_result(result, status)


@router.post("/publish")
def post_pinned_catalog_publish(
    business_id: CurrentBusinessId,
    telegram: ChannelTelegramDep,
    snapshots: SnapshotsDep,
    recorder: RecorderDep,
    locks: LocksDep,
    today: TodayDep,
    clock: ClockDep,
) -> PinnedCatalogOut:
    with as_http:
        push(telegram, snapshots, recorder, locks, business_id, "publish", today, clock())
        snap = snapshots.snapshot(business_id, today)
        status = status_of(snap.settings, snap.pin)
        return PinnedCatalogOut.of(snap.settings, status)


@router.post("/own-chat-lookup")
def post_pinned_catalog_own_chat_lookup(
    body: OwnChatLookupIn,
    business_id: CurrentBusinessId,
    updates: PrivateChatsDep,
    snapshots: SnapshotsDep,
    today: TodayDep,
) -> OwnChatLookupOut:
    with as_http:
        own_chat = look_up_own_chat(updates, snapshots, business_id, body.token, today)
        return OwnChatLookupOut(own_chat=own_chat)
