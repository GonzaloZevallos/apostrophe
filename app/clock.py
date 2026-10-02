"""The one place the app asks what time it is.

The clock answers in UTC; "today" is always the business day in Argentina time
(docs/adr/0001). Tests replace `app.state.clock` with a fixed one.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import cast
from zoneinfo import ZoneInfo

from fastapi import Request

BUSINESS_TIMEZONE = ZoneInfo("America/Argentina/Buenos_Aires")

Clock = Callable[[], datetime]


def system_clock() -> datetime:
    return datetime.now(UTC)


def business_day(instant: datetime) -> date:
    return instant.astimezone(BUSINESS_TIMEZONE).date()


def get_clock(request: Request) -> Clock:
    # Starlette's `State` is untyped; `create_app` always assigns a `Clock`.
    return cast(Clock, request.app.state.clock)


def get_today(request: Request) -> date:
    return business_day(get_clock(request)())
