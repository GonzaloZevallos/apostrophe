"""The zone names a business may choose (docs/adr/0057).

`accepted_time_zones()` is the one list a new name is checked against and the one the
picker shows. It is the region names of the installed IANA data only: `Etc/*`, the `US/*`
style aliases and bare names (`UTC`, `GMT`, `EST`) are left out, since none says a place.
A name already stored is loaded by membership in `available_timezones()` instead
(`app.shared.calendar.load_zone`), so a stored name off this list keeps working.
"""

from datetime import datetime
from functools import cache
from zoneinfo import available_timezones

from app.shared.calendar import load_zone, utc_offset_minutes

REGIONS = (
    "Africa/",
    "America/",
    "Antarctica/",
    "Asia/",
    "Atlantic/",
    "Australia/",
    "Europe/",
    "Indian/",
    "Pacific/",
)


@cache
def accepted_time_zones() -> tuple[str, ...]:
    return tuple(sorted(name for name in available_timezones() if name.startswith(REGIONS)))


def time_zones_to_show(stored: str) -> tuple[str, ...]:
    """The picker's list: the accepted names, plus the stored one when it is not among them
    (a business keeps a zone the list no longer offers, and the screen must still show it)."""
    accepted = accepted_time_zones()
    return accepted if stored in accepted else (*accepted, stored)


def utc_offsets_minutes(names: tuple[str, ...], instant: datetime) -> list[int | None]:
    """Each name's offset from UTC at `instant`, in minutes, in the order of `names`. A name
    that cannot be loaded answers `None`, so one bad stored name never fails the others."""
    offsets: list[int | None] = []
    for name in names:
        zone = load_zone(name)
        offsets.append(None if zone is None else utc_offset_minutes(instant, zone))
    return offsets
