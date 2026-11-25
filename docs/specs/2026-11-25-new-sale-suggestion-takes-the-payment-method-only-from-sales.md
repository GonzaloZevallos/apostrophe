---
status: draft
---
## Goal

The Payment method that New sale proposes must come only from a Sale paid in full on the spot, never from a partial On-the-spot payment (a Deposit, which GH-1063 will add). The suggestion read is changed before Deposits exist, so a seller who takes a Deposit by transfer never sees the next walk-in Sale start on Transfer. The seller should finish a Sale in fewer taps without correcting a wrong method. Nothing on screen changes.

## Acceptance criteria

- `SqlNewSaleSuggestions.last_paid_method` considers only Sales whose On-the-spot payment amount equals `coalesce(sum(sale_line.line_total), 0) + sale.shipping_charged`.
- Line totals come from a `GROUP BY sale_id` subquery over `sale_line` filtered on `business_id`; the query has no correlated SUM.
- The comparison uses the raw stored columns, or `scaled()` with the same factor on both sides if `tests/architecture/test_money_adapters_scaled.py` demands it.
- Every `business_id` filter and the composite method join are kept; ordering stays `sale.number` desc, limit 1.
- The Sale is picked first and its method is judged after: an archived method on the picked Sale still gives `null`, and no older Sale is used.
- A code comment states the cost: linear in the Business's sale lines, once per suggestions read.
- Adapter test, at both money scales via the existing `money_scale` parametrisation: two Sales paid on the spot through the real path, the newer one with Shipping charged. With the newer one's payment amount lowered by hand in the test session, the older one's method is returned; with the amounts equal, the newer one's method is returned.
- Adapter test, at both money scales: a single Sale paid on the spot whose payment amount is lowered by hand returns `null`.
- The five existing last-method adapter cases and the Business isolation sweep pass without edits.
- `method_usage.py` and `payments_ledger.py` are unchanged, and the PR says so and why.

## Out of scope

- Recording Deposits or Orders (GH-1063).
- Any change to how Cash, Money in or method usage count a Deposit.
- Any change to the New sale screen, the Payment method field or any text.
- Suggesting the most used method instead of the last one, or looking further back when the last fully paid Sale's method is archived.
- A new index.

## Decisions

- A Sale with only one On-the-spot payment that is lowered by hand returns `null`; this case is added to the tests.
  - Reason: success criterion 2 promises nothing is suggested when no Sale was paid in full, and the request's tests only covered the fallback to an older Sale.
- Deposit is not added to the glossary in this task.
  - Reason: GH-1063 introduces and defines it; this task only excludes it from the suggestion.
- The rule is written in `sales.md` ("New sale suggestions › Último medio"), and the glossary entry for New sale suggestions now says "paid in full on the spot".
  - Reason: that is where the server read is defined; `sale-in-progress.md` only consumes the id and stays correct.

## Risks

A scale mismatch between the payment amount and the line totals would silently drop every Sale and suggest nothing; the tests at both money scales guard against it.
The query cost grows with the Business's sale lines; it runs once per suggestions read and stays acceptable for a few thousand lines.

## Screens

none

## Slices

### last-method-paid-in-full

#### Acceptance criteria

- `last_paid_method` returns the method of the newest Sale, by Sale number, whose On-the-spot payment equals its lines plus Shipping charged, using a `GROUP BY sale_id` subquery filtered on `business_id`.
- At both money scales: a lowered newer payment returns the older Sale's method, equal amounts return the newer Sale's method, and a single lowered payment returns `null`.
- The existing last-method cases and the Business isolation sweep pass without edits, and `method_usage.py` and `payments_ledger.py` are unchanged.
- A code comment states the cost: linear in the Business's sale lines, once per suggestions read.

#### Risks

- money-scale-mismatch
- query-cost-linear-in-sale-lines