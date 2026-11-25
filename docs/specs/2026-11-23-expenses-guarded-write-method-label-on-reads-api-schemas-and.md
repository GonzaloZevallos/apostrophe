---
status: draft
---
## Goal

A seller can record, through the API, which of their own Payment methods an Expense was paid with, and read it back under the method's current name. This part covers:

- the guarded write of `payment_method_id` on create and edit;
- the method's label on the single-Expense read and on the monthly view;
- an optional detail;
- the API schemas and router, with their HTTP, architecture and isolation tests.

It is part 2 of GH-1010. It serves the job "When I record money I spent on something that isn't stock, I want to note which of my payment methods it came out of, so that later I can tell where the money actually left from."

## Acceptance criteria

- `POST /api/expenses` with an offered method of the Business returns 201, with `payment_method: {id, name, icon}` on the Expense read and on its monthly row.
- `POST` without `payment_method_id`, or with `null`, returns 201 and `payment_method: null`.
- After renaming the method, existing Expenses return the new name. After archiving it, they still return the method.
- `POST` with an archived, deleted or nonexistent method id, one from another Business, or 0 answers 404 `payment_method.unavailable`, and nothing is written.
- `PUT` that switches to a different archived method answers 404, and the Expense is unchanged.
- `PUT` that resends the method the Expense already has, now archived, answers 200 and keeps it. `PUT` with `null` or without the key removes it.
- Business B naming a method of Business A, and naming 999999, receive byte-identical bodies. B's `PUT` on A's Expense answers `expense.not_found`.
- An id of 0 together with a 201-character detail answers 404 `payment_method.unavailable`. A 201-character detail with an unavailable id of 1 or more answers 422 `expense.detail_invalid`.
- A missing `detail` key gives 201 with `""`. A blank detail is stored as `""`. `null` answers 422.
- Cash, Profit and the Panel figures for Week and Month are identical for the same Expenses with and without a method.
- In `tests/test_business_isolation.py`, both Expense bodies carry `payment_method_id`, `seed_expenses` uses one of Business A's methods, and the sweep passes.
- The architecture tests listed in GH-1010's subtask pass.

## Out of scope

- Any screen: the Expense form neither sends nor shows a method.
- Filtering Expenses by method.
- Spending totals per method.
- Any per-method Cash or Money in figure.
- Counting Expenses toward a method's `in_use`: the next part of GH-1010.
- The Business export of the method.
- Changes to the Spreadsheet import.
- Back-filling or guessing a method for existing Expenses.

## Decisions

- Every unavailable method answers the same 404 `payment_method.unavailable`, with byte-identical bodies: archived, deleted, nonexistent, from another Business, 0 or negative.
  - Reason: `expenses.md` already fixes this contract, and it keeps any answer from revealing that another Business exists.
- `PUT` is a full replacement: leaving out `payment_method_id` removes the method.
  - Reason: this is the contract in `expenses.md`, with no special case. The Add expense form part inherits the duty to resend the current method.
- The rule that the Business offers the method now is checked inside the same SQL write, through `_offered(business_id, method_id)` in `sql_expenses.py`.
  - Reason: one place holds the rule, and a rejected request writes nothing.
- `PaymentMethodId` is built as in `app/payments/adapters/router.py`.
  - Reason: an id of 0 or less then answers the same 404 in Payments and in Expenses.

## Risks

- Tenant isolation: the method id comes from the request, so an id from another Business must stay indistinguishable from a missing one, in status and body.
- A client that leaves out `payment_method_id` on `PUT` silently removes the method.

## Screens

none

## Slices

### expense-payment-method-api

#### Acceptance criteria

- Create and edit accept an optional `payment_method_id`, checked inside the same write. An unavailable method answers one byte-identical 404 `payment_method.unavailable`.
- Editing keeps an already-held archived method when its id is resent. `null` or a missing key removes it.
- The single-Expense read and the monthly rows return `payment_method: {id, name, icon}` or `null`, with the current name.
- The detail is optional, and a blank detail is stored as `""`.
- The method changes no total: Cash, Profit and the Panel figures are identical with and without it.
- The HTTP, architecture and `tests/test_business_isolation.py` tests pass.

#### Risks

- tenant-isolation-of-method-id
- put-full-replacement-drops-method