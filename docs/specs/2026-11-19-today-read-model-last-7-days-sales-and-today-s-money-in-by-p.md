---
status: draft
---
## Goal

The seller opens Home's Today during the day. Today's server read gains two figures:

- Sales for today and each of the 6 days before it.
- Money in: today's Payments split by each of the Business's own Payment methods, plus a total.

With these the seller can tell whether today is a normal day and what they should have in hand through each way they get paid. This part is server only. It extends `PanelOut.today`, and later parts of GH-497 draw it.

## Acceptance criteria

- `PaymentRecord` has `payment_method_id: int`, keyword-only with no default, filled from the existing payments SELECT. Every construction site passes it.
- A `PaymentMethods` port in `app/results/application/ports.py` has `all()`, which returns `id, name, position` for every Payment method of the Business, archived ones included.
- The `PaymentMethods` adapter runs exactly one statement, scoped to the Session's Business.
- `PanelOut.today.last_7_days` always has exactly 7 `{day, sales}` items: the 6 days before today and today, oldest first and today last, in the Business day.
- Each `sales` in `last_7_days` sums the Sales dated that day (`sale.day`), shipping included, paid or not. A day with no Sales has `sales: 0`.
- The last item of `last_7_days` equals `today.sales`, and a behaviour test checks it.
- `PanelOut.today.money_in` is always present, as `{total, methods[{payment_method_id, name, amount}]}`.
- `money_in` counts Payments dated today, both on-the-spot and later ones.
- `money_in.total` equals the "Payments received" part of today's Cash computation, to the peso, and a behaviour test checks it.
- `methods` lists only methods with Payments today, archived methods included.
- Each method appears under its current name, so a renamed method shows its new name.
- `methods` is ordered by position, then by `payment_method_id`.
- With no Payments today, `money_in` is `{total: 0, methods: []}`.
- Domain unit tests cover:
  - position ordering and the tie-break by id;
  - an archived method kept;
  - zero Payments;
  - a Payment dated another day left out;
  - a 7-day series that crosses a month boundary.
- Domain code under `app/results/domain/` takes the time zone as an argument and imports neither `app.clock` nor `zoneinfo`.
- The isolation seeder includes a Payment with a method. From another Business, no Payment method name or amount from the first Business appears in the Panel.
- The ADR-0038 statement-count test pins the new constant (one statement more than before) and holds on both the small seed and the year seed.
- Week, Month and Cash responses are unchanged.

## Out of scope

- Any screen, drawing or user-facing wording, including the "no Payments today" text, which a later part adds in `web/src/copy/emptyStates.ts`.
- An archived flag on Money in methods.
- Cash or Profit in the `today` block.
- Payments not dated today.
- Changes to Week, Month or Analysis.

## Decisions

- `last_7_days` runs oldest first with today last, and always has exactly 7 items. A day with no Sales gets `sales: 0`.
  - Reason: the later screen reads it left to right in time, and the front never sorts or fills in a figure (invariant 3).
- `last_7_days` counts Sales by `sale.day`, not by the recorded-on-own-date rule.
  - Reason: this is the glossary and Panel rule for Sales, and it makes the last item equal today's Sales. That rule stays in So far only.
- `money_in` is always present, `{total: 0, methods: []}` when nothing came in, and only methods with Payments today are listed.
  - Reason: the front never has to infer a missing block, and a method with nothing today adds nothing the seller can check.
- Methods are ordered by position, then by `payment_method_id`, and there is no archived flag.
  - Reason: the order must be stable and set by the server, and nothing on Today needs to tell archived methods apart.
- There is no "unknown method" case.
  - Reason: a Payment method with Payments can only be archived, never deleted.
- The Panel's statement count goes up by exactly one fixed statement.
  - Reason: reading method names and positions needs one query. It stays constant in history size, as ADR-0038 requires.

## Risks

- Adding a required keyword field to `PaymentRecord` breaks every fake, factory and adapter that builds one. They must all be updated in the same change.
- If `money_in` used a different date filter from Cash's "Payments received", the two figures would disagree. The behaviour test that compares them guards against this.

## Screens

none

## Slices

### today-series-and-money-in

#### Acceptance criteria

- `PaymentRecord.payment_method_id` is added and filled from the existing payments SELECT. All construction sites are updated.
- The `PaymentMethods` port and its single-statement adapter return every method, archived included.
- `PanelOut.today.last_7_days` and `PanelOut.today.money_in` follow the rules above, all computed and ordered on the server.
- The domain, behaviour, isolation and statement-count tests listed above pass.

#### Risks

- payment-record-construction-sites
- money-in-cash-agreement