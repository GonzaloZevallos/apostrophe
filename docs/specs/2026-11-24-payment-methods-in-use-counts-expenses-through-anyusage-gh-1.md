---
status: draft
---
## Goal

A seller who tidies their list of Payment methods can delete only a method that nothing uses. A method that any Payment or Expense of their Business points to can only be archived, and every past record keeps showing its current name. This part makes `in_use` count Expenses as well as Payments, from one rule, now that Expenses can carry a Payment method (GH-837, part 2 of GH-1010). It closes GH-837.

## Acceptance criteria

- For a method used only by an Expense, `GET /api/payment-methods` returns `in_use: true`.
- For a method used only by an Expense, `DELETE /api/payment-methods/{id}` answers 409 `payment_method.in_use` and never a 500.
- A method used only by an Expense can be archived, and the Expense still shows the method's current name.
- For a method used by a Payment and by an Expense, `in_use` is true and `DELETE` answers 409 `payment_method.in_use`.
- The 409 body is byte-identical whether the method has Payments, Expenses or both.
- For a method with no Payments and no Expenses, `in_use` is false and `DELETE` answers 204.
- An Expense without a Payment method does not change any method's `in_use`.
- A method's `in_use` in Business A never depends on Business B's records, and no response reveals that B exists.
- In Settings → Payment methods, a method used only by Expenses offers "Archive" and not "Delete", from the same `in_use` the API returns, with no screen or text change.
- The `PaymentMethodUsage` port is implemented by `AnyUsage`, which combines the payments usage adapter (untouched) and `ExpensesUsingAMethod` in `app/expenses/adapters/method_usage.py`, wired in `app/main.py`.
- `tests/architecture/test_payment_method_references.py` fails when a record type that references `payment_method` is not counted in `in_use`.
- A new ADR records that a method is in use when any Payment or any Expense uses it.
- In `docs/product/expenses.md`, the note that counting Expenses in `in_use` is the next part of GH-1010 is turned into a statement that it is done, and that item leaves the out-of-scope list of part 2 of GH-1010.

## Out of scope

- Any screen, layout or copy change.
- Showing how many records use a Payment method.
- Filtering Expenses by method.
- Totals, Cash or Money in by method, and any change to Cash or Profit.
- Backfilling the method on existing Expenses.
- Choosing or showing an Expense's method on screen (the Add expense form part of GH-837).

## Decisions

- `in_use` stays a true/false answer, and no count of records is shown.
  - Reason: The job only needs to know whether a method can be deleted, and a count adds scope with no value for it.
- An Expense without a Payment method counts toward no method.
  - Reason: The method is optional on an Expense, so a missing method is not a use.
- Archived methods count as in use like any other.
  - Reason: Archiving exists to keep the history of a used method, and its name stays reserved.
- Delete of a method used only by Expenses reuses the existing 409 `payment_method.in_use`, with the same body as for Payments.
  - Reason: The seller sees the same path and answer as today, with no new text, and the foreign key never surfaces as a 500.

## Risks

- If the Expenses usage adapter skips the `business_id` filter, one Business's `in_use` could depend on another Business's records. The isolation check in the acceptance criteria covers it.
- If the delete reaches the `expense.payment_method_id` foreign key before the `in_use` check, the seller gets a 500 instead of the 409.

## Screens

none

## Slices

### in-use-counts-expenses

#### Acceptance criteria

- `in_use` is true when any Payment or any Expense of the same Business points to the method, archived methods included, and false otherwise.
- Deleting a method in use answers 409 `payment_method.in_use`, with the same body for Payments, Expenses or both. A method not in use is deleted with 204.
- An Expense without a method affects no method's `in_use`.
- No `in_use` answer depends on another Business's records or reveals that another Business exists.
- `AnyUsage` and `ExpensesUsingAMethod` are wired in `app/main.py`, and the payments usage adapter is unchanged.
- The architecture test fails if a record type that references `payment_method` is not counted.
- The ADR is written, and `docs/product/expenses.md` no longer lists counting Expenses in `in_use` as pending.

#### Risks

- cross-business-usage-leak
- fk-error-instead-of-409
