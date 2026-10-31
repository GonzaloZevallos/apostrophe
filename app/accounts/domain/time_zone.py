"""The zone names a business may choose (docs/adr/0057).

`accepted_time_zones()` is the one list a new name is checked against and the one the
picker shows. It is the region names of the installed IANA data only: `Etc/*`, the `US/*`
style aliases and bare names (`UTC`, `GMT`, `EST`) are left out, since none says a place.
A name already stored is loaded by membership in `available_timezones()` instead
(`app.shared.calendar.load_zone`), so a stored name off this list keeps working.
"""

from functools import cache
from zoneinfo import available_timezones

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
