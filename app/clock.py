"""The one place the app asks what time it is.

The clock answers in UTC; "today" is always the business day in Argentina time
(docs/adr/0001). Tests replace `app.state.clock` with a fixed one.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import cast
from zoneinfo import ZoneInfo

from fastapi import Request

# Piece 1b of GH-318 part 6 deletes `BUSINESS_TIMEZONE` and the one-argument
# `business_day` below: they stay only for the callers outside a request (the upkeep, the
# push, the spreadsheet import) until those read their own business's zone. A request
# learns its day from `get_today` in `app.accounts.adapters.deps`.
BUSINESS_TIMEZONE = ZoneInfo("America/Argentina/Buenos_Aires")

Clock = Callable[[], datetime]


def system_clock() -> datetime:
    return datetime.now(UTC)


def business_day(instant: datetime) -> date:
    return instant.astimezone(BUSINESS_TIMEZONE).date()


def get_clock(request: Request) -> Clock:
    # Starlette's `State` is untyped; `create_app` always assigns a `Clock`.
    return cast(Clock, request.app.state.clock)
