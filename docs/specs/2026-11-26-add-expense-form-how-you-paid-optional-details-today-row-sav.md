---
status: draft
---
## Goal

This task builds the Add expense form for a seller who has just paid for something the business needs and wants to record it from the phone in a few taps. Only the amount and the category are required. Details and How you paid (one of the Business's own Payment methods) are optional. The Save button shows the amount before saving, and when the amount blocks Save the reason names the rule it breaks. The same form serves Expenses, the Analysis card, New sale and edit in place.

## Acceptance criteria

- In every host (`ExpenseNewRoute`, `ExpenseNewSheet`, `ExpenseEditSheet` and `SaleExpenseSheet`), the form shows Amount, Category, Details, Date and How you paid, in that order.
- Category is the existing Selector with "Create a new category" below it, unchanged.
- Details is labelled `expenses:form.detailsOptional` and has no required mark or required validation. The old required key is removed if it ends up unused.
- Date is the shared `DateRow`, filled with today, and its entry is removed from `web/scripts/docs/front-exclude.json`.
- How you paid is an optional Selector, always shown, labelled `expenses:form.paymentMethod`, with the empty choice `expenses:form.paymentMethodNone`.
- How you paid spreads `usePaymentMethodOptions().selector` with the empty-set line `expenses:form.paymentMethodEmpty`, and takes its options, value, selected and loading from `howYouPaidView`.
- How you paid has no inline creation, and a tap on a field whose list failed calls `reload()` through `onOpenChange`.
- `FormState.payment_method_id` comes from the read's `payment_method?.id` and is never resolved through the options list. A new expense starts with `null`, and `sameForm` compares `payment_method_id`.
- Every POST and PUT carries `payment_method_id`.
- An edit with a method, made while payment methods fail to load and changing only the amount, sends the same id in the PUT.
- Choosing None sends `null`, and a new expense sends the chosen id.
- `Expense.payment_method` is typed `PaymentMethodLabel | null`, and `ExpenseInput.payment_method_id` is typed `number | null`.
- A 404 `payment_method.unavailable` does the following:
  - sets `methodGone` from the stored label, or from `paymentMethodName(queryClient, id)`;
  - invalidates the payment-methods query;
  - shows `common:paymentMethodUnavailable` in a `FieldRefusal` tied to the field with `describedBy`;
  - keeps every typed value.
- After that 404, Save stays disabled until the seller picks a method or clears it, and choosing None and saving then sends `null`.
- Save is enabled only when the amount parses, is above 0, a category is chosen, nothing is being sent and `methodGone` is null.
- The Save label is `expenses:form.save` until the amount is valid. After that it is `expenses:form.saveWithAmount`, with the amount in a nowrap `cifra` span filled only by `money.format`.
- The Save button is at least 44 px tall, may wrap and never truncates.
- "1,5" at 0 decimals shows `tooManyDecimalsMessage(money.format)` live.
- "0" shows `expenses:form.amountAboveZero` with `money.format(0)` after blur, and the message clears once the value is valid.
- An empty amount shows nothing, and "1," while focused shows nothing.
- In every host, New sale included, back with the method list open closes only the list, with no discard dialog.
- The Category and method lists never open each other.
- With the fetch held, an open list stays open when the list arrives, and the stored row becomes marked if the list leaves it out.
- In `SaleExpenseSheet`, a method change alone triggers the leave guard.
- The ten Testing Library cases of the request pass with fetch faked, and `ExpenseTooManyDecimals.test.tsx` is updated and passes.
- `statesRecords.ts` has a WalkState with the How you paid list open over the Expense form, and one with a nine-digit amount typed.
- The Details-required comment in `statesSales.ts` is corrected, and the Mobile check passes with no new offenders.
- `expenseSheet`, `expenseLeaveOverSale`, `flow`, `analysis`, `tapBudget` and `helpers/openScreens` are migrated to the new order and the optional Details, with no old element put back (D-69509906).
- `payment_method.in_use` is unchanged, and the PR says so.
- The PR attaches the design capture against `GastoNuevo` and `GastoNuevoOscuro` at 320, 375 and 430 px, light and dark, reporting any width not captured as "not compared".
- The PR names the Writing-standards length question for "Save expense · {amount}".

## Out of scope

- Creating a Payment method from the form.
- Remembering the last method used, or any default method.
- Reports, filters or totals by Payment method, and any change to any total.
- Changing how `payment_method.in_use` is shown.
- Changing the structure of the four hosts or the expense row of the monthly view.
- Deciding the Writing-standards length question for the Save label.
- Settling in the PR a difference against `GastoNuevo` / `GastoNuevoOscuro` that the seller would read or act on differently: the owner decides it.

## Decisions

- The field order is Amount, Category, Details, Date, How you paid.
  - Reason: the two required fields come first, which serves recording an expense in under a minute.
- How you paid is always shown, with None always a choice, no inline creation and no remembered default.
  - Reason: the form stays short on the phone, and the app assumes no way of paying (Assume nothing).
- An edit sends the stored method id until the seller picks another one or clears it, even when the list has failed.
  - Reason: PUT is a full replacement, so an accidental null would erase the method.
- The Save label shows the amount through the Money format, and may wrap but never truncates.
  - Reason: seeing the amount before saving is how a wrong amount gets caught.
- "Too many decimals" shows live, "more than zero" shows after blur, and an unfinished value shows nothing while focused.
  - Reason: each reason names the rule actually broken without interrupting the seller mid-typing.
- The `DateRow` entry is removed from `front-exclude.json` in this task.
  - Reason: D-62e6dc23 says the part that wires a module into a screen removes its entry.

## Risks

- The drawing check against `GastoNuevo` / `GastoNuevoOscuro` is unverified, so the owner may have to decide a difference.
- "Save expense · {amount}" with a long amount may wrap at 320 px, and the Writing standards may judge its length.
- The e2e migration touches six specs and helpers that many flows use, so a missed locator would break unrelated suites.
- A regression in sending the stored id while the method list fails would silently erase the method.

## Screens

The screens come from the design stage.

## Slices

### add-expense-form-how-you-paid

#### Acceptance criteria

- The form shows Amount, Category, Details (optional), Date and How you paid in every host, with How you paid built from `usePaymentMethodOptions` and `howYouPaidView`.
- Every POST and PUT carries `payment_method_id`: an edit keeps the stored id while the list fails, None sends null, and a new expense sends the chosen id.
- A 404 `payment_method.unavailable` keeps everything typed and shows the reason on the field, and Save stays disabled until the seller picks a method or None.
- The Save button reads "Save expense" until the amount is valid, then "Save expense · {amount}" through `money.format`. It is at least 44 px tall and never truncates.
- The amount reasons follow the rules: too many decimals live, "more than zero" after blur, nothing for an empty or unfinished value.
- In every host, back with the method list open closes only the list, and a method change alone triggers the leave guard in `SaleExpenseSheet`.
- The ten Testing Library cases and the updated `ExpenseTooManyDecimals.test.tsx` pass.
- The Mobile check has the new WalkStates and no new offenders.
- The listed e2e specs are migrated with no old element put back.

#### Risks

- drawing-check-unverified
- save-label-length
- e2e-locator-migration
- stored-method-lost-on-failed-list
