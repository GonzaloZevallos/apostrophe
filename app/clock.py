"""The one place the app asks what time it is.

The clock answers in UTC; "today" is the business day in each business's own zone
(docs/adr/0057), worked out only by `business_day` in `app.shared.calendar`. Tests
replace `app.state.clock` with a fixed one.
"""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import cast

from fastapi import Request

Clock = Callable[[], datetime]


def system_clock() -> datetime:
    return datetime.now(UTC)


def get_clock(request: Request) -> Clock:
    # Starlette's `State` is untyped; `create_app` always assigns a `Clock`.
    return cast(Clock, request.app.state.clock)
