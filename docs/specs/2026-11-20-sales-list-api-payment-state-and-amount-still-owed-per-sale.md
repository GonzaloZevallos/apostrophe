---
status: draft
---
## Goal

Every Sale the sales API returns gains two fields: `payment_state` (`paid`, `unpaid`, `part_paid`) and `still_owed`, the amount still owed on that Sale. A later part of GH-500 can then show the seller, on the phone's Sales list, which sales are open and for how much, without opening each one. This part is enabling work and changes the API only. Both fields are worked out live from the Settlement by a single domain rule, are never stored, and never break the list.

## Acceptance criteria

- `GET /sales`, `POST /sales`, `PUT /sales/{id}/customer` and `GET /sales/{id}` return `payment_state` (`paid`, `unpaid`, `part_paid` or null) and `still_owed` (same money shape as `total`, or null) on every Sale.
- Nothing else in the response changes: `GET /sales` stays a list, `still_owing` stays, and no query parameter is added.
- The domain function `payment_state` in `app/sales/domain/` applies the first matching rule:
  1. A total of 0 is paid.
  2. Paid on the spot is paid, and it raises if the Settlement also lists the Sale.
  3. No customer and not paid on the spot raises.
  4. A customer's Sale missing from the Settlement raises.
  5. Otherwise, still_owed 0 is paid, still_owed equal to the total is unpaid, and anything else is part-paid.
- `still_owed` equals the Settlement figure for that Sale with no rounding of its own. A paid Sale carries 0.
- The API reference set through TestClient matches the Settlement with 0 differences in the list and in the detail. It covers paid on the spot, paid later, part-paid, unpaid, $0, settled by a Credit and no customer.
- An inconsistent Sale gets null in both fields on all four routes. No route fails, and every other row is unchanged.
- Each inconsistent Sale writes one log line with the Business id and the Sale number. A test shows the line never contains the Note, a customer name, a phone number, an amount or a Balance.
- `OwingSales.owed_of(customer_ids)` is implemented in `app/payments/adapters/settlements.py` with the same `SqlLedgers.for_customers` read and `settle()`. `still_owing` is a wrapper over it, and `list_sales` calls it once, never `settlement_of` per row.
- `tests/sales/test_list_cost.py` stays at 9 statements with 30 and with 300 sales, with every payment state in the data.
- `bill_payment` is rebuilt on `payment_state`, keeping its $0 → `none` branch, and the existing Sale bill tests pass unedited.
- No router, schema or front component re-derives the state. The schema only translates the enum to its wire string.
- `tests/test_contract_shapes.py` declares both fields nullable. `web/src/api/sales.ts` declares `payment_state: 'paid' | 'unpaid' | 'part_paid' | null` and `still_owed: number | null`. Typed front fixtures change shape only, with no step or assertion changed.
- `tests/test_business_isolation.py` shows that another Business's Sale never appears and never changes a `still_owed`.
- Domain unit tests cover the three states and the three raises, and are written before the code.

## Out of scope

- Any screen, copy, filter or sorting on the new fields. Later parts of GH-500 show them.
- Removing `still_owing`, or turning `GET /sales` into anything other than a list.
- Any change to the Sale bill's behaviour or wording.
- Storing the state or the amount, or any data migration.
- Deduplicating or alerting on the inconsistent-sale log line.
- A time threshold for the list. The statement count is the measure.

## Decisions

- The detail and the write routes return null in both fields for an inconsistent Sale instead of failing.
  - Reason: The list and the detail must agree, and a seller who opens the Sale must not lose its lines, customer and date over a data problem they cannot fix.
- Each inconsistent Sale leaves one log line for the Operator with the Business id and the Sale number only.
  - Reason: A null alone would hide a defect in the books forever. Customer data and amounts are personal and must not leave the response path or appear in logs (ADR-0005).
- A paid Sale carries `still_owed` 0, and null is reserved for an inconsistent Sale.
  - Reason: Agreement with the Settlement must be checkable for on-the-spot, $0 and no-customer sales, which the Settlement does not list.
- An inconsistent Sale keeps today's Sale bill outcome: the detail responds without a Sale bill.
  - Reason: The Sale bill's behaviour stays unchanged in this part, and its existing tests must pass unedited.

## Risks

- Money rounding: `still_owed` must equal the Settlement figure at either Money scale, with no rounding of its own.
- Tenant isolation: the Settlement read must cover only the listed customers of one Business.
- Drift between `still_owing` and `still_owed` if they were computed separately rather than one wrapping the other.

## Screens

none

## Slices

### payment-state-per-sale

#### Acceptance criteria

- The four sales routes return `payment_state` and `still_owed`, decided only by `payment_state` in `app/sales/domain/`, matching the Settlement with 0 differences across the reference set.
- An inconsistent Sale gets null in both fields with no route failing, plus one Operator log line with only the Business id and the Sale number.
- `GET /sales` stays at 9 statements with 30 and 300 sales, using one `owed_of` call.
- Existing Sale bill tests pass unedited. The contract, isolation and front type changes are in place.

#### Risks

- money-rounding
- tenant-isolation
- still-owing-drift