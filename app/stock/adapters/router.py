from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.products.application.errors import ProductArchived, ProductNotFound
from app.shared.quantity import InvalidQuantity, Quantity
from app.stock.adapters.schemas import (
    EntryIn,
    EntryOut,
    MovementOut,
    ProductStockOut,
    StockOut,
    ThresholdIn,
    WithdrawalIn,
    WithdrawalOut,
    movement_out,
)
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.adapters.sql_thresholds import SqlThresholds
from app.stock.adapters.variety_catalog import SqlVarietyCatalog
from app.stock.application import manage_entries, manage_withdrawals
from app.stock.application import read_stock as read_stock_uc
from app.stock.application import set_threshold as set_threshold_uc
from app.stock.application.errors import VarietyArchived as _ArchivedVariety
from app.stock.application.errors import VarietyNotFound as _UnknownVariety
from app.stock.domain.errors import (
    EntryCostInvalid,
    EntryCostOnNegativeAdjustment,
    EntryCostRequired,
    EntryDateInFuture,
    EntryNoteTooLong,
    EntryNotFound,
    EntryQuantityInvalid,
    WithdrawalDateInFuture,
    WithdrawalNoLines,
    WithdrawalNoteTooLong,
    WithdrawalNotFound,
    WithdrawalQuantityNotPositive,
    WithdrawalQuantityTooPrecise,
    WithdrawalReasonRequired,
    WithdrawalVarietyNotFound,
)
from app.stock.domain.threshold import ThresholdInvalid

router = APIRouter(prefix="/stock", tags=["stock"])
entries_router = APIRouter(prefix="/entries")
withdrawals_router = APIRouter(prefix="/withdrawals")
products_router = APIRouter(prefix="/products")

SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
ClockDep = Annotated[Clock, Depends(get_clock)]


def get_entries(session: SessionDep, business_id: CurrentBusinessId) -> SqlStockEntries:
    return SqlStockEntries(session, business_id)


def get_catalog(session: SessionDep, business_id: CurrentBusinessId) -> SqlVarietyCatalog:
    return SqlVarietyCatalog(session, business_id)


def get_draws(session: SessionDep, business_id: CurrentBusinessId) -> SqlDraws:
    return SqlDraws(session, business_id)


def get_withdrawals(session: SessionDep, business_id: CurrentBusinessId) -> SqlStockWithdrawals:
    return SqlStockWithdrawals(session, business_id)


def get_thresholds(session: SessionDep, business_id: CurrentBusinessId) -> SqlThresholds:
    return SqlThresholds(session, business_id)


EntriesDep = Annotated[SqlStockEntries, Depends(get_entries)]
CatalogDep = Annotated[SqlVarietyCatalog, Depends(get_catalog)]
DrawsDep = Annotated[SqlDraws, Depends(get_draws)]
WithdrawalsDep = Annotated[SqlStockWithdrawals, Depends(get_withdrawals)]
ThresholdsDep = Annotated[SqlThresholds, Depends(get_thresholds)]

as_http = TranslateErrors(
    [
        (
            404,
            (
                EntryNotFound,
                ProductNotFound,
                ProductArchived,
                WithdrawalNotFound,
                WithdrawalVarietyNotFound,
            ),
        ),
        (
            422,
            (
                EntryQuantityInvalid,
                EntryCostRequired,
                EntryCostInvalid,
                EntryCostOnNegativeAdjustment,
                EntryDateInFuture,
                EntryNoteTooLong,
                InvalidQuantity,
                ThresholdInvalid,
                WithdrawalReasonRequired,
                WithdrawalDateInFuture,
                WithdrawalNoLines,
                WithdrawalQuantityNotPositive,
                WithdrawalQuantityTooPrecise,
                WithdrawalNoteTooLong,
            ),
        ),
    ]
)


def _or_variety_not_found(
    exc: _UnknownVariety | _ArchivedVariety, variety_id: int
) -> ProductNotFound | ProductArchived:
    """`manage_entries` raises stock's own internal signal (its application layer
    cannot import `app.products`); the router, an adapter, translates it into the
    varieties hexagon's own class — the one class `variety.not_found` belongs to
    system-wide (`tests/test_refusal_codes.py`), so a foreign or missing variety_id
    answers the exact same 404 code whichever hexagon's use case found it."""
    if isinstance(exc, _ArchivedVariety):
        return ProductArchived(variety_id)
    return ProductNotFound(variety_id)


@entries_router.post("", status_code=201)
def record_entry(
    body: EntryIn,
    entries: EntriesDep,
    catalog: CatalogDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> EntryOut:
    with as_http:
        try:
            entry = manage_entries.record_entry(
                entries,
                catalog,
                session,
                entry_date=body.date or today,
                variety_id=body.product_id,
                origin=body.origin,
                quantity=Quantity.of(body.quantity),
                total_cost=body.total_cost,
                note=body.note,
                today=today,
                recorded_at=clock(),
            )
        except (_UnknownVariety, _ArchivedVariety) as exc:
            raise _or_variety_not_found(exc, body.product_id) from exc
        return EntryOut.of(entry)


@entries_router.get("/{stock_entry_id}")
def get_entry(stock_entry_id: int, entries: EntriesDep) -> EntryOut:
    with as_http:
        return EntryOut.of(manage_entries.get_entry(entries, stock_entry_id))


@entries_router.put("/{stock_entry_id}")
def edit_entry(
    stock_entry_id: int,
    body: EntryIn,
    entries: EntriesDep,
    catalog: CatalogDep,
    session: SessionDep,
    today: TodayDep,
) -> EntryOut:
    with as_http:
        try:
            entry = manage_entries.edit_entry(
                entries,
                catalog,
                session,
                stock_entry_id,
                entry_date=body.date or today,
                variety_id=body.product_id,
                origin=body.origin,
                quantity=Quantity.of(body.quantity),
                total_cost=body.total_cost,
                note=body.note,
                today=today,
            )
        except (_UnknownVariety, _ArchivedVariety) as exc:
            raise _or_variety_not_found(exc, body.product_id) from exc
        return EntryOut.of(entry)


@entries_router.delete("/{stock_entry_id}", status_code=204)
def delete_entry(stock_entry_id: int, entries: EntriesDep, session: SessionDep) -> None:
    with as_http:
        manage_entries.delete_entry(entries, session, stock_entry_id)


@withdrawals_router.post("", status_code=201)
def record_withdrawal(
    body: WithdrawalIn,
    withdrawals: WithdrawalsDep,
    catalog: CatalogDep,
    session: SessionDep,
    today: TodayDep,
    clock: ClockDep,
) -> WithdrawalOut:
    with as_http:
        try:
            view = manage_withdrawals.record_withdrawal(
                withdrawals,
                catalog,
                session,
                reason=body.reason,
                withdrawn_on=body.date or today,
                note=body.note,
                lines=[(line.product_id, line.quantity) for line in body.lines],
                today=today,
                now=clock(),
            )
        except _ArchivedVariety as exc:
            raise ProductArchived(exc.variety_id) from exc
        return WithdrawalOut.of(view)


@withdrawals_router.get("/{withdrawal_id}")
def get_withdrawal(
    withdrawal_id: int, withdrawals: WithdrawalsDep, catalog: CatalogDep
) -> WithdrawalOut:
    with as_http:
        return WithdrawalOut.of(
            manage_withdrawals.read_withdrawal(withdrawals, catalog, withdrawal_id)
        )


@withdrawals_router.put("/{withdrawal_id}")
def edit_withdrawal(
    withdrawal_id: int,
    body: WithdrawalIn,
    withdrawals: WithdrawalsDep,
    catalog: CatalogDep,
    session: SessionDep,
    today: TodayDep,
) -> WithdrawalOut:
    with as_http:
        try:
            view = manage_withdrawals.edit_withdrawal(
                withdrawals,
                catalog,
                session,
                withdrawal_id,
                reason=body.reason,
                withdrawn_on=body.date or today,
                note=body.note,
                lines=[(line.product_id, line.quantity) for line in body.lines],
                today=today,
            )
        except _ArchivedVariety as exc:
            raise ProductArchived(exc.variety_id) from exc
        return WithdrawalOut.of(view)


@withdrawals_router.delete("/{withdrawal_id}", status_code=204)
def delete_withdrawal(withdrawal_id: int, withdrawals: WithdrawalsDep, session: SessionDep) -> None:
    with as_http:
        manage_withdrawals.delete_withdrawal(withdrawals, session, withdrawal_id)


@router.get("")
def get_stock(
    entries: EntriesDep,
    draws: DrawsDep,
    withdrawals: WithdrawalsDep,
    catalog: CatalogDep,
    thresholds: ThresholdsDep,
    today: TodayDep,
    archived: bool = False,
) -> StockOut:
    """`archived=true` answers the archived products' rows instead of the listed ones;
    the total and the entries are the business's either way."""
    view = read_stock_uc.read_stock(
        entries, draws, withdrawals, catalog, thresholds, today, archived=archived
    )
    return StockOut.of(view)


@products_router.put("/{product_id}/threshold")
def set_threshold(
    product_id: int,
    body: ThresholdIn,
    entries: EntriesDep,
    draws: DrawsDep,
    withdrawals: WithdrawalsDep,
    catalog: CatalogDep,
    thresholds: ThresholdsDep,
    session: SessionDep,
    today: TodayDep,
) -> ProductStockOut:
    with as_http:
        quantity = Quantity.of(body.quantity) if body.quantity is not None else None
        try:
            view = set_threshold_uc.set_threshold(
                entries,
                draws,
                withdrawals,
                thresholds,
                catalog,
                session,
                product_id,
                quantity,
                today,
            )
        except (_UnknownVariety, _ArchivedVariety) as exc:
            raise _or_variety_not_found(exc, product_id) from exc
        return ProductStockOut.of(view)


@products_router.get("/{product_id}/movements")
def get_movements(
    product_id: int,
    entries: EntriesDep,
    withdrawals: WithdrawalsDep,
    catalog: CatalogDep,
) -> list[MovementOut]:
    with as_http:
        try:
            movements = manage_withdrawals.read_movements(entries, withdrawals, catalog, product_id)
        except _UnknownVariety as exc:
            raise _or_variety_not_found(exc, product_id) from exc
        return [movement_out(movement) for movement in movements]


router.include_router(entries_router)
router.include_router(withdrawals_router)
router.include_router(products_router)
