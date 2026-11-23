---
status: draft
---
## Goal

The Customer account read, `GET /api/customers/{id}/account`, gains four figures: `age_days`, `still_owing`, `sales_by_month` and `average_sale`. They give the age of the oldest debt, every Sale still owing with what is left on it, the Customer's Sales total for each of the last six months, and their Average sale over those months.

A seller who is about to remind a Customer, or to decide whether to sell to them again without being paid, gets these figures without working anything out. The screens that show them come in later parts of GH-498. This part delivers only the read. The Average sale's half-up rounding also moves to `app/shared/`, so Analysis and this read share one rule.

## Acceptance criteria

- `age_days` is the number of whole days from the Customer's Owing since to today on the Business's day. A Sale dated today or later gives 0. A part-paid Sale keeps its own date. It is null when the Customer owes nothing or has a Credit.
- `still_owing` lists `{sale_number, date, remaining}` for every Sale not fully paid after Settlement, part-paid ones included. Entries follow Settlement order with no cap. `remaining` is never the Sale total, and the entries sum exactly to the Balance when it is above $0.
- A Customer who owes nothing or has a Credit gets an empty `still_owing`. A Credit never appears as an entry and is never netted into one.
- `sales_by_month` always has exactly six `{month, total}` entries, with `month` as `YYYY-MM`. They run oldest first and end in the current month on the Business's day. Each Sale counts in its own date's month, shipping included, paid or not, with Gifts at $0. Empty months are 0. A Sale dated after the current month is outside the window.
- `average_sale` is the window's Sales total divided by its number of Sales, not lines, rounded half up with the helper in `app/shared/`. It is null when the window has no Sales, including when all the Customer's Sales are older than the window.
- `remaining`, `total` and `average_sale` travel in currency units as a decimal (ADR-0058).
- The half-up rounding lives only in `app/shared/`. Results imports it unchanged, and results' existing tests pass without their assertions changing.
- The monthly totals and the Average sale come only from `app/payments/domain/customer_sales.py`. `age_days` and `still_owing` come only from `settle()` and `debt_age`. No adapter, router, schema or browser code computes any of them.
- The existing account rows, the Balance and Owing since do not change. `openapi.json` and its snapshot are regenerated, with no `Breaking-API:` line.
- The account of another Business's Customer still answers 404. `tests/test_business_isolation.py` seeds a Customer with empty months.
- `docs/product/payments.md` describes the four fields. Nothing under `docs/api/**` or `docs/architecture/**` is edited.

## Out of scope

- Any screen, copy, WalkState or `screens.json` change, and Reminder text or how a Reminder is sent.
- Per-sale lines on `GET /api/payments/debtors`. Its own part adds them, only with `with_lines=true`.
- These figures in the Catalog, the Sale bill or any other read.
- An Average sale over the Customer's whole history, or a window configurable per Business (#330).

## Decisions

- The field is `sales_by_month` and the module is `app/payments/domain/customer_sales.py`, not the `purchases` names in the request.
  - Reason: in the glossary, Purchase means stock coming in, and Sale lists "purchase" under Avoid. Naming Customer Sales "purchases" would name the opposite flow of money.
- `month` is the calendar month as `YYYY-MM`.
  - Reason: the request left the shape open, and later screens need one fixed shape for every Customer.
- The window is six months, set as one constant taken from `ClientesCompu.dc.html`.
  - Reason: the drawing shows six months ("de mayo a octubre"), and the request asks for the number the drawing shows.
- The Average sale covers the six-month window only.
  - Reason: the seller can check it against the six months shown next to it. A whole-history figure could not be checked that way.
- `age_days` and `still_owing` are null and empty for a Customer who owes nothing or has a Credit.
  - Reason: a Credit never counts in any debt figure, and a Reminder that disagrees with the Balance is worse than none.
- The six-month window is recorded as a known Assume nothing assumption for #330, not made configurable here.
  - Reason: the same constant applies to every Business, and the existing fixed assumptions are swept in #330.

## Risks

Later parts of GH-498, or the GH-498 plan, may refer to `purchases_by_month`. They must read `sales_by_month` instead.
Moving the rounding helper could change Analysis's Average sale if it is not a pure move. Results' tests guard this.
Month edges depend on the Business's day in Argentina time. Tests must use the movable clock around month boundaries.

## Screens

none

## Slices

### account-debt-and-sales-figures

#### Acceptance criteria

- `GET /api/customers/{id}/account` returns `age_days`, `still_owing`, `sales_by_month` and `average_sale` as defined above. The `still_owing` amounts sum exactly to the Balance when it is above $0.
- Domain tests for `customer_sales.py` match a direct calculation. They cover half-up rounding, empty months, no Sales, all Sales older than the window, and Sales dated later in or after the current month.
- The half-up rounding is moved unchanged to `app/shared/`, and results' tests pass with the new import.
- Another Business's Customer stays 404. The isolation sweep seeds a Customer with empty months.
- `openapi.json`, its snapshot and `docs/product/payments.md` are updated.

#### Risks

- rounding-move-regression
- month-boundary-on-business-day
- field-rename-for-later-parts