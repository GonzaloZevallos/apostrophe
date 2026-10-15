"""The negative control for the clock-read guard: every way a module can read the
system date. One read per function, in this order."""

import datetime as datetime_module
from datetime import UTC, datetime
from datetime import datetime as dt

from app import clock as app_clock
from app.clock import system_clock
from app.clock import system_clock as real_clock


def plain() -> datetime:
    return datetime.now(UTC)


def aliased_class() -> datetime:
    return dt.now(UTC)


def through_the_module() -> datetime:
    return datetime_module.datetime.now(UTC)


def uses_system_clock() -> datetime:
    return system_clock()


def uses_aliased_system_clock() -> datetime:
    return real_clock()


def uses_system_clock_by_attribute() -> datetime:
    return app_clock.system_clock()
