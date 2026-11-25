---
status: draft
---
## Goal

A seller tidying their Payment methods in Settings must never be able to delete a method that an Expense points to. They can only archive it, just as with a method that has Payments, so the record of how they paid is never lost. This backend part makes the in-use rule count Expenses through the single `PaymentMethodUsage` port. It turns the server error into the clear `payment_method.in_use` rejection, and it checks that Business export and Business removal keep working. Part 3 of GH-1010 already did some of this work. This part verifies it, finishes what is missing and covers it with tests.

## Acceptance criteria

- A Payment method used only by an Expense (created through `POST /api/expenses` with `payment_method_id`) lists `in_use: true` in `GET /api/payment-methods`.
- `DELETE /api/payment-methods/{id}` for that method answers 409 `payment_method.in_use`, byte for byte the same body as for a method with Payments, and never a 500.
- Archiving that method still succeeds, and the Expense keeps showing the method's current name.
- An Expense without a method changes no method's `in_use`, and a method with no Payments and no Expenses still deletes with 204.
- The `in_use` of a method in one Business is unaffected by another Business's Expenses.
- Business export on a business whose Expense names a method carries that method as a reference by name.
- Business removal on that business succeeds under ON DELETE RESTRICT, with `app/business_removal` unchanged.
- `app.state.payment_method_usage` is a factory `(session, business_id)` that returns a single union over `PaymentsUsingAMethod` and `ExpensesUsingAMethod`, defined in `app/main.py`. `app.payments` imports no expense table, and there is exactly one implementation of the port.
- `docs/adr/20261111-payment-methods-by-id.md` is amended. An Expense may name a method by id, optionally. Its write uses the same guard inside the statement, and an unchanged archived method is accepted on edit. `in_use` counts Expenses.
- `ci-ok` is green.

## Out of scope

- The Expense form and any other screen. Nothing new is drawn.
- Changing how an Expense write checks its method. The ADR amendment only records the existing guard.
- Any edit to `app/business_removal`.
- Showing how many records use a method, and any per-method report or total.

## Decisions

- Reuse what part 3 of GH-1010 already built instead of adding a second adapter or union.
  - Reason: The capability file and the worktree already have `ExpensesUsingAMethod` and `AnyUsage`. Two implementations of the port would split the single in-use rule.
- Business export and Business removal are made a criterion of their own (criterion 9 in payment-methods.md), with its own metric.
  - Reason: The interview accepted it as success criterion 3, and the capability file did not yet record it.
- The Expense form invariant stays listed but is not built here.
  - Reason: It belongs to the parent GH-520 and the form is out of scope. This part only must not break it.
- No glossary change.
  - Reason: The Payment method entry already says "uno con Payments o con Expenses solo se archiva".

## Risks

The code from part 3 of GH-1010 may already satisfy most criteria. The Tech Lead must verify it rather than rebuild, or the result is duplicated wiring.
If the export does not follow `expense.payment_method_id`, it would need a change outside `app/business_removal`. That is reported as a finding, not patched in removal.

## Screens

none

## Slices

### expense-counts-method-in-use

#### Acceptance criteria

- A method used only by an Expense lists `in_use: true`, its DELETE answers 409 `payment_method.in_use` (never a 500), and archiving it works.
- Business export carries the Expense's method by name, and Business removal succeeds under RESTRICT, with `app/business_removal` unchanged.
- One `PaymentMethodUsage` union, wired in `app/main.py` as a factory `(session, business_id)`. `app.payments` imports no expense table.
- The ADR is amended with the three points, and `ci-ok` is green.

#### Risks

- duplicate-usage-wiring
- export-misses-expense-method-fk