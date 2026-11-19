---
status: draft
---
## Goal

The panel read (`GET` panel) gains a `today` block. It carries today's Sales, the So far comparison against the same weekday last week, and two hourly running-total series, all computed on the server. It serves the seller who opens the app in the middle of the day and wants to know at a glance whether today is going better or worse than usual. This is part 1 of 15 of GH-497 and it is server only: a later part of GH-497 draws the block.

## Acceptance criteria

- `SaleRecord` in `app/results/domain/ledger.py` has `recorded_at: datetime` (UTC), keyword-only with no default.
- The sales ledger adapter fills `recorded_at` from its existing SELECT, and the panel's statement count does not change.
- Every construction site of `SaleRecord` is updated in the same change.
- `app/results/domain/today_series.py` exists, imports stdlib only, and offers `hour_of`, `hourly_running_total`, `so_far` and `change_percent`, taking `now` and `tz` as arguments.
- `hour_of`: a Sale recorded on its own local date counts at its local hour. A Sale recorded on any other day, earlier or later, counts at hour 23 of its own date.
- `so_far` counts only Sales recorded on their own date whose local time of day is at or before now's, to the second. 14:05:00 is included and 14:05:01 is not, and the rule is the same for today and last week.
- `change_percent` is a signed whole percent, rounded half up with the existing rounding helper.
- `change_percent` is None when the base is 0 (both 0 included) and −100 when today is 0 against a base above 0. It is not capped.
- `PanelOut.today` has `sales`, `sales_count`, `so_far`, `last_week_so_far`, `last_week_day` (today − 7 days), `change_percent`, `hourly_today` and `hourly_last_week`.
- Week and Month are unchanged.
- `hourly_today` runs from hour 00 to the current local hour.
- `hourly_last_week` runs the full 24 hours.
- Both series are cumulative, include shipping and never fall back. The point of `hourly_last_week` at the current hour is equal to or higher than `last_week_so_far`.
- `sales` and `sales_count` equal Sales for today, shipping included, paid or not, in TestClient behaviour tests with the movable clock.
- Domain unit tests cover:
  - midnight;
  - a Sale recorded late;
  - a Sale recorded before its date;
  - now 14:05 against a 14:55 Sale last week (out of so far, in the hour-14 point);
  - exactly 14:05:00 (in);
  - a base of 0;
  - −100;
  - rounding half up.
- An architecture check fails if an adapter that builds a `SaleRecord` calls `astimezone`, or if `app/results/domain/` imports `app.clock` or `zoneinfo`.
- The ADR-0038 statement-count test still holds at a small and a large history.
- The router passes `now` (get_clock) and `tz` (BUSINESS_TIMEZONE) into `read_panel`.

## Out of scope

- Any screen, copy or style change. The block is drawn by later parts of GH-497.
- How the front presents a very large percent.
- Cash, Payments and Profit in the `today` block.
- Changes to Week and Month.
- A time zone per Business. That comes with the time-zone part of GH-318, ADR-0057.
- Fixing an edit path that rewrites `recorded_at`, if one is found.

## Decisions

- `hourly_today` runs from 00 to the current hour, and `hourly_last_week` runs the full 24 hours.
  - Reason: today has no future hours to show, and last week's full line shows where the day ended up for the quick mid-day look.
- A Sale recorded on a day other than its date appears at hour 23 of its own date in the series and is in no So far window.
  - Reason: the full-day line matches the Sales list, and the comparison stays fair to the second, as the round-1 success criterion requires.
- A Sale recorded before its date (dated ahead) is also out of So far, not only one recorded late.
  - Reason: `hour_of` already treats every Sale recorded off its own date the same way. Counting it by its time of day would compare a moment that did not happen on that day.
- The point of `hourly_last_week` at the current hour is not required to equal `last_week_so_far`.
  - Reason: the hourly point covers the whole hour while So far cuts at the minute and second, so they differ whenever a Sale falls later within that hour.
- `change_percent` is −100 when today is 0 against a base above 0, None at base 0, and has no cap.
  - Reason: the PM settled that there is no percent at base 0. The server returns the true figure and the screen decides how to present it.
- The basis is Sales paid or not, shipping included, with Cash outside the block.
  - Reason: the job asks how much was sold, not how much was collected, and it must match Sales and Home exactly.
- Editing a Sale keeps its original `recorded_at`.
  - Reason: a correction made later must not move the Sale into a So far window it did not happen in.

## Risks

- An edit path in sales could rewrite `recorded_at`. Verify while building, and if one does, raise it as a finding without changing it here.
- About 29 `SaleRecord` construction sites change in one diff. A missed one breaks typing or tests.
- `BUSINESS_TIMEZONE` is Argentina until GH-318. A Business in another zone sees hours shifted until the time-zone part ships.

## Screens

none

## Slices

### today-read-model

#### Acceptance criteria

- `SaleRecord.recorded_at` is filled by the adapter with no new statement, and every construction site is updated.
- `today_series.py` implements `hour_of`, `hourly_running_total`, `so_far` and `change_percent` as in the Spec, with its domain unit tests passing.
- `PanelOut.today` exposes the eight fields, `sales` and `sales_count` equal Sales for today, and Week and Month are unchanged.
- The architecture check and the ADR-0038 statement-count test pass.

#### Risks

- recorded-at-rewritten-on-edit
- construction-site-churn
- argentina-only-time-zone
