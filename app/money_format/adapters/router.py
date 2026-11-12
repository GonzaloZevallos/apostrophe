"""`GET`/`PUT /api/money-format`: the business's symbol and decimals (docs/adr/0080).

A body and an answer carry the symbol and the decimals and never the scale it stores
amounts at (docs/adr/0058). The business comes from the session. Only a save that changed
a value schedules the pinned catalog's upkeep, as the pricing settings save does: it is
this route that decides, so the router is gated but not `upkeep_gated`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import CurrentBusinessId
from app.db import get_session
from app.http_errors import TranslateErrors
from app.money_format.adapters.reader import SqlMoneyFormat
from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.application.apply_money_format import ApplyMoneyFormat
from app.money_format.domain.rescale import (
    AmountTooLargeToRescale,
    DecimalsBelowRecordedAmounts,
    RescaleBusy,
    RescaleCheckFailed,
)
from app.pinned_catalog.adapters.upkeep_trigger import schedule_upkeep
from app.shared.money import InvalidMoneyDecimals, InvalidMoneySymbol, MoneyFormat

router = APIRouter(prefix="/api/money-format", tags=["money-format"])

SessionDep = Annotated[Session, Depends(get_session)]

as_http = TranslateErrors(
    [
        (422, (InvalidMoneySymbol, InvalidMoneyDecimals)),
        (409, (DecimalsBelowRecordedAmounts, AmountTooLargeToRescale)),
        (503, (RescaleBusy,)),
        (500, (RescaleCheckFailed,)),
    ]
)


class MoneyFormatBody(BaseModel):
    symbol: str
    decimals: int

    @classmethod
    def of(cls, money_format: MoneyFormat) -> MoneyFormatBody:
        return cls(symbol=money_format.symbol, decimals=money_format.decimals)


@router.get("")
def get_money_format(session: SessionDep, business_id: CurrentBusinessId) -> MoneyFormatBody:
    return MoneyFormatBody.of(SqlMoneyFormat(session, business_id).current())


@router.put("")
def put_money_format(
    body: MoneyFormatBody,
    session: SessionDep,
    request: Request,
    background_tasks: BackgroundTasks,
    business_id: CurrentBusinessId,
) -> MoneyFormatBody:
    with as_http:
        change = ApplyMoneyFormat(SqlMoneyFormatWriter(session), session).execute(
            business_id, body.symbol, body.decimals
        )
    # A symbol or decimals that moved can change the catalog's text (docs/adr/0014): saving
    # the values already stored schedules nothing.
    if change.any:
        schedule_upkeep(request, background_tasks, business_id, session)
    return MoneyFormatBody.of(SqlMoneyFormat(session, business_id).current())
