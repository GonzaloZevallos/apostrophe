---
status: accepted
date: 2026-10-28
---

# The business time zone replaces Argentina days: today is worked out per business, and upkeep is due when its last check was not on the business's own today

Amends docs/adr/0001-stack-and-shape.md, docs/adr/0014-upkeep-runs-after-the-commit-and-compares-text-before-sending.md, docs/adr/0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md.

Epic GH-318. Today "today" is the business day in Argentina time for every business
(`BUSINESS_TIMEZONE` in `app/clock.py`, ADR-0001). The business-configuration PRD
(`docs/product/business-configuration.md` on the epic's branch, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3; it is not in `docs/product/` at this commit)
gives each business its own time zone. This records how a day is worked out and when upkeep is due.
No code changes here.

## What the PRD says

- "Each business has a time zone. A new business picks it during setup, with the accepting phone's
  time zone suggested."
- "Any business can change it in Settings. A change only moves what "today" is from then on, and
  recorded dates are never rewritten."
- "Confirming the time zone is one tap inside the flow."
- Of an existing business: "Argentina time and today's phone rule". "No stored row is rewritten by
  the migration."
- Of a promotion: "hours, in the business's time zone".
- Metric M2: "on the day they open in their own time zone".

## Decision

- **Each business has a time zone**, an IANA name, owned by the `accounts` hexagon with the business
  record. A migration adds the column and fills it with `America/Argentina/Buenos_Aires` for every
  business that exists, so an existing business keeps its days. A business that opens afterwards
  carries the zone it picked at setup. The migration only adds and fills a new column; it changes no
  value that existed before it. The shared comparator that proves this for a migration does not exist
  yet: the time-zone part, the first to write a migration, creates it in `tests/migrations/`.
- **A day is worked out in one place, from the instant and the zone.** Today `business_day(instant)`
  and `BUSINESS_TIMEZONE` are in `app/clock.py`. After the time-zone part, `business_day(instant, zone)`
  is in `app/shared/calendar.py` (which exists today and holds `Month` and `Week`, not yet this
  function), and it is the only code that turns an instant into a business day. It takes the zone as
  an argument and reads no constant. `BUSINESS_TIMEZONE` leaves `app/clock.py` in the time-zone part.
- **`get_today` works per business.** Today `get_today` is in `app/clock.py` and answers for the one
  zone. After the time-zone part, `get_today` in `app/accounts/adapters/deps.py` reads the injected
  clock and the zone of the business of the request, and returns `business_day(clock(), zone)`. It
  replaces the `get_today` of `app/clock.py`. A use case
  still receives `today` as a plain `date` (docs/adr/0001-stack-and-shape.md, docs/adr/0002-users-invitations-and-a-signed-session.md); it never reads a zone.
- **No other code asks for today.** No code reads `BUSINESS_TIMEZONE`, a literal zone name or
  `datetime.now` to learn today or a business day; it goes through `get_today` or
  `business_day(instant, zone)`. The wall-clock guards of docs/adr/0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md stay, and the injected clock stays
  the only source of the instant. Any rule that speaks of hours or weekdays in a business's time uses
  the same zone through the same function.
- **Upkeep is due when `last_checked_on` differs from the business's own today.** A published pin is
  due when `last_checked_on` is null or is not the day it is for that business now. The 300-second
  ticker (docs/adr/0014-upkeep-runs-after-the-commit-and-compares-text-before-sending.md) works out each business's today from its zone, so a business west of Argentina is
  not checked early and one east of it is not checked late. The comparison is "differs", not "is
  earlier", because a business that changes its zone can find its today one day behind its last check;
  it is then checked once more, which is harmless, rather than skipped for a day.
- **Changing the zone rewrites nothing.** It moves what "today" is from then on. Recorded dates
  (`paid_on`, expense dates, `last_checked_on`, price entries' effective dates) stay as stored; stored
  instants stay in UTC (ADR-0001).

## Consequences

- docs/adr/0014-upkeep-runs-after-the-commit-and-compares-text-before-sending.md's "not yet checked today" is a comparison with the business's own today. Its lock, its
  three phases and its five-minute lag are unchanged.
- A shifted-date run (docs/adr/0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md) that wants a midnight crossing for a business chooses that business's
  zone; Argentina is the zone of every existing business and of the e2e business until a spec sets
  another.
- The zone can be wrong for a seller who travels; the seller changes it in Settings (the PRD), and
  nothing guesses it from a request.

## Considered and rejected

- **A zone per request or per user**: two people of one business would then see different "today"s for
  the same sale and the same upkeep.
- **A fixed offset instead of an IANA name**: daylight saving would make a business's day start at the
  wrong hour twice a year.
- **Keep `BUSINESS_TIMEZONE` for existing businesses and add a second path for new ones**: two sources
  of "today" is the failure docs/adr/0043-the-operator-commands-take-their-clock-tests-never-read-the-wall-clock.md's guard exists to prevent.
