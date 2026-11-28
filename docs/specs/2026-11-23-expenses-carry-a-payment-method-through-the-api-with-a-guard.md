---
status: draft
---
## Goal

Part 2 of 2 of GH-837, backend only. After this part, the API lets an Expense carry one of its own Business's Payment methods by id, and an Expense's Details are optional. This serves the job of a seller who pays for something that is not stock and wants to record how they paid, without writing a description. This part delivers the API half. The Add expense form part delivers the few-taps half. No screen changes.

## Acceptance criteria

- `POST /api/expenses` without a `payment_method_id` returns 201 with `payment_method: null`.
- `POST /api/expenses` without a `detail` key returns 201 with `detail: ""`. A blank or whitespace-only detail is stored as `""`. A `null` detail returns 422.
- `POST` with an archived, deleted, nonexistent, other-business or 0 `payment_method_id` returns 404 `payment_method.unavailable`, and the Expense list is unchanged.
- Business B naming A's method and B naming 999999 receive byte-identical response bodies.
- `PUT` keeping a stored method that was archived later returns 200, with the method kept.
- `PUT` with a different archived method returns 404 `payment_method.unavailable`, and the Expense is unchanged.
- `PUT` with `payment_method_id: null` clears the method, and a `PUT` without the key leaves it null.
- A 201-character detail with an unavailable method returns 422 `expense.detail_invalid`, on both `PUT` and `POST`.
- B's `PUT` of A's Expense returns `expense.not_found`.
- The single read and the monthly view rows carry `payment_method: {id, name, icon} | null`. An archived method still shows, and a rename shows the new name.
- Domain unit tests:
  - 201 characters is refused;
  - blank Details become `""`;
  - a label without an id, or with a different id, raises `ExpenseRuleBroken` with `expense.payment_method_mismatch`.
- The spreadsheet import refuses whitespace-only Details with `InvalidDetail.code` and writes nothing. Imported Expenses never carry a method.
- A Payment method used only by an Expense:
  - shows `in_use: true` in `GET /api/payment-methods`;
  - `DELETE` returns 409 `payment_method.in_use`;
  - archiving it succeeds.
- In `tests/business_removal/`, an Expense with a method that was archived, then renamed, is exported with the method's current name, and removal succeeds with matching counts.
- In `tests/test_business_isolation.py`, both expense bodies carry `payment_method_id: 1`, and `seed_expenses` posts with one of A's methods.
- `docs/product/expenses.md` and `docs/product/payment-methods.md` describe:
  - optional Details;
  - `payment_method_id`, the read shape and the 404;
  - keeping an archived stored method;
  - the export naming the method;
  - the full-replace PUT obligation;
  - the empty-Details row rule;
  - the deletion rule.
- No change under `docs/api/**`, `docs/architecture/generated/**` or `decisiones.md` relative to the merge-base.
- No front-end file sends `payment_method_id` or shows an Expense's method, and the Expense form still requires Details.
- `ci-ok` is green.

## Out of scope

- Any screen or user-facing text, including relaxing the Expense form's Details requirement.
- Where an Expense row shows its method, and whether it has an icon.
- A per-method spending breakdown, and any change to Cash, Profit or Money in.
- Making the Payment method required on an Expense.
- Any import change beyond the Details check.
- Editing the stale "Fuera de alcance" import line in `docs/product/expenses.md`. It is listed as a finding in the PR.

## Decisions

- A Payment method that any Expense points to can only be archived, never deleted, through the same path and 409 `payment_method.in_use` as a method with Payments.
  - Reason: this is the first part that lets an Expense point to a method. Deleting such a method would either fail on the foreign key or erase how the Expense was paid.
- `in_use` in `GET /api/payment-methods` counts Expenses as well as Payments.
  - Reason: otherwise the Settings list would offer a Delete that the server refuses.
- PUT stays a full replace: a missing or null `payment_method_id` clears the method, and clients must send the current method on every edit.
  - Reason: this matches how `detail` already behaves, and the Guard keeps the risk at zero until the form part.
- Keeping an archived stored method on edit is allowed; only choosing an archived method is refused.
  - Reason: otherwise archiving a method would make old Expenses impossible to edit.
- Empty-Details row rule: the row is titled with its Expense category and has no Details line, with no placeholder and no Attention icon.
  - Reason: a missing description is neither a failure nor something the seller must act on (Icon and text rule).
- POST uses the same rejection order as PUT, without the Expense 404.
  - Reason: one predictable order for both writes, so the 422 for an over-long detail wins over the 404 for an unavailable method.

## Risks

- `tests/architecture/test_money_adapters_scaled.py` or `test_frozen_columns.py` may reject the single Core update. The fallback is ORM assignment for the other columns plus one guarded update of `payment_method_id` alone, recorded in the PR.
- If #1009 does not translate the foreign-key violation on `DELETE` into 409 `payment_method.in_use`, a method used only by Expenses could return a 500.
- A future client that omits `payment_method_id` on PUT silently clears the method. The docs state the obligation, and the Add expense form part inherits it.
- The empty-Details row is unverified against the Expenses drawing. The screen part must raise any departure.

## Screens

none

## Slices

### expense-payment-method-api

#### Acceptance criteria

- POST and PUT accept an optional `payment_method_id` and an optional `detail`. Every unavailable method gets the same 404 `payment_method.unavailable`, and a stored archived method is kept on edit.
- Reads and the monthly view carry `payment_method: {id, name, icon} | null` with the current name, archived methods included.
- A method used by an Expense cannot be deleted (409 `payment_method.in_use`, with `in_use: true`) and can be archived.
- The import keeps refusing blank Details. The Business export names each Expense's method, and removal counts match.
- Isolation tests return identical bodies for another Business's method and an unknown one. The product docs are updated, and `ci-ok` is green.

#### Risks

- architecture-tests-may-reject-single-update
- fk-delete-may-surface-as-500
- full-replace-put-clears-method
