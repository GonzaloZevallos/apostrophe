---
status: draft
---
## Goal

Deliver the read behind the New sale shortcuts: `GET /api/sales/suggestions?on=YYYY-MM-DD`, built for one Business. It returns only ids:
- the Customers most recently sold to;
- the Products most sold in the 30 days ending on `on`;
- the Payment method of the last Sale paid on the spot.

It serves the seller recording a Sale on the phone, so that later GH-496 parts can offer one-tap picks and keep a sale under a minute. This is part 1 of 14 of GH-496 and has no screen.

## Acceptance criteria

- `GET /api/sales/suggestions?on=YYYY-MM-DD` is on the gated sales router, declared before `/{sale_id}`.
- The route is backed by:
  - a `NewSaleSuggestions` port in `app/sales/application/ports.py`;
  - a `suggest_for_new_sale` use case in `app/sales/application/`;
  - the adapter `app/sales/adapters/sql_suggestions.py`.
- The answer has exactly `recent_customer_ids`, `most_sold_product_ids` and `last_payment_method_id`, with no names, prices or amounts.
- `recent_customer_ids`:
  - counts every Sale of the Business whatever its date;
  - lists each Customer once, ranked by their most recent Sale (latest date, then highest Sale number);
  - excludes Sales without a Customer;
  - holds at most 8 ids.
- `most_sold_product_ids`:
  - sums Sale line quantity in hundredths over [on − 29 days, on], both ends included;
  - excludes Gift lines, Archived products and Products with nothing sold;
  - includes Hidden products and Products without a Current price on `on`;
  - is ordered by quantity descending, then case-folded name, then Product id;
  - holds at most 8 ids.
- `last_payment_method_id`:
  - takes the Sale with an On-the-spot payment and the highest Sale number, whatever its date;
  - returns `null` if that Sale's method is archived, and never falls back to an older Sale or method;
  - is `null` when no Sale was paid on the spot.
- Owing Sales and $0 Sales never count as paid on the spot.
- The query never filters archived methods before picking the Sale.
- A Business with no matching history gets 200 with `[]`, `[]` and `null`.
- A missing or malformed `on` gets 422 `RequestInvalid`. Any well-formed date gets 200. There is no limit parameter, and `SUGGESTIONS_PER_LIST = 8`.
- Every statement of the adapter is filtered on `business_id`. Another Business's data never changes the answer.
- The route is in the seeder of `tests/test_business_isolation.py`.
- An adapter test covers five last-method cases:
  1. the latest paid Sale's method is archived and an older one is live: `null`;
  2. the latest Sale is owing: skipped;
  3. the latest Sale is $0: skipped;
  4. another Business has a newer paid Sale: never seen;
  5. no paid Sale at all: `null`.
- HTTP tests cover:
  - both orderings and the tie-break;
  - the Gift, Archived and Hidden rules, and the zero-sold exclusion;
  - the window edges (on − 29 in, on − 30 out, `on` in);
  - the caps of 8;
  - the empty answer;
  - the 422 for a missing and a malformed `on`.
- An ADR named by date and slug records the rules and the §8 cost note: Most sold grows with the window, Recent customers is one linear GROUP BY pass, and there is no new index.
- `docs/product/sales.md` describes the read, criteria 51 to 54, its metrics and its out-of-scope.

## Out of scope

- The New sale screen and any other screen using this read. Collect and the Customer page do not use it.
- Preselecting the method on screen, and changing `sales.md` criterion 34.
- Names, prices, amounts or a limit parameter in the answer.
- Any pricing rule inside the read.
- A "repeat last sale" or "copy a sale" shortcut.
- A new index.
- Any front-end, Copy module or e2e change.

## Decisions

- Recent customers counts every Sale, whatever its date, and `on` plays no part in it.
  - Reason: the job is "the Customers I sold to most recently". Someone who bought after a late entry's date is still a likely buyer, and the request put a window only on Most sold.
- Last method counts every Sale paid on the spot, whatever its date, and the highest Sale number decides.
  - Reason: the Sale number is the order of saving, which is what "last used" means, and invariant 3 names only the highest Sale number.
- A Product with no Current price on `on` is still suggested.
  - Reason: the read is about sales history and returns only ids. The screen prices lines through `priceSale`/`priceLine`, and filtering would drop a Product that is still on the full list.
- No matching history answers 200 with empty lists and `null`, never an error.
  - Reason: nothing is wrong without history, and the answer must look the same whether or not the Business ever had Sales.
- Each Customer appears once, ranked by their own most recent Sale.
  - Reason: the request gave the sort keys but not the unit being ranked, and a Customer listed twice would waste one of the 8 places.
- Most sold breaks a remaining name tie by Product id.
  - Reason: it makes the answer deterministic, whatever the database row order.
- "Paid on the spot" means a Sale with an On-the-spot payment, that is, a payment row whose `sale_id` is set.
  - Reason: owing Sales and $0 Sales have no such row, so the request's skip rules follow from the record itself, with no second total check that could disagree.
- Any well-formed `on`, including a date after today, answers 200.
  - Reason: the only decided error is a missing or malformed `on`, and the read does not enforce New sale's date rule.

## Risks

- Most sold scans Sale lines over a 30-day window with no new index. Its cost grows with sales volume in the window, as the §8 cost note accepts.
- `sales.md` criterion 34 and its out-of-scope line ("remember the last method or propose a default") stay true only until the GH-496 screen part that preselects the method. That part must rewrite both.

## Screens

none

## Slices

### suggestions-read

#### Acceptance criteria

- `GET /api/sales/suggestions?on=YYYY-MM-DD` returns `recent_customer_ids`, `most_sold_product_ids` and `last_payment_method_id`, following the orderings, exclusions, window and caps of 8 above.
- The last-method read picks the Sale with the highest Sale number among those paid on the spot first. Only then does it return `null` if that Sale's method is archived.
- The five-case adapter test and the HTTP tests pass.
- A missing or malformed `on` gets 422 `RequestInvalid`.
- The route is in the isolation sweep seeder, and every adapter statement filters on `business_id`.
- The ADR (date and slug) with the §8 cost note is added, and `docs/product/sales.md` is updated.

#### Risks

- none