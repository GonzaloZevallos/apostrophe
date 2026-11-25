---
status: draft
---
## Goal

Each row in the Expenses month view's list shows how the expense was paid. It shows the payment method's current name as short muted text after the detail, and nothing when there is no method. An expense with an empty detail is titled by its category. This serves the seller going through the month's expenses on the phone, who can then tell which money paid for what without opening each expense.

## Acceptance criteria

- The row keeps today's layout: the date on the left, the category over the detail in the middle, the amount on the right.
- A row whose expense has a payment method shows the method's current name, as text only with no icon, in the muted style of the lower line after the detail, as "{detail} · {method}".
- A row whose expense has no payment method shows no dash, no "Unknown", no Attention icon and no empty gap.
- An expense whose detail is empty is titled by its category, and the category never appears twice.
- With an empty detail and a method, the lower line holds only the method's name. With neither, the row has no lower line.
- An archived method's name still shows, and a renamed method shows its new name. The name is read from the expense's `payment_method`, never from the methods list.
- The lower line never wraps. The detail truncates first, with the row's existing truncation, so the method's name stays visible.
- If the row's accessible name is built from its parts, it includes the method's name only when there is one.
- The front's expense API type carries `payment_method` (`{id, name, icon}` or null).
- No copy key is added, and the pinned mobile fixture is unchanged.
- `docs/product/expenses.md` describes the method in the list row, and its GH-837 guard no longer says no screen shows the method.
- `ci-ok` is green, including the Mobile check over Expenses with no new offenders.

## Out of scope

- Showing the method's icon in the row.
- Rebuilding the row as a title over a muted line.
- Filtering, grouping or totalling expenses by method.
- Any change to the expense form, the API or the invariants of parts 1 to 3.
- Changing the pinned mobile fixture.

## Decisions

- The row keeps its drawn layout, and the method goes on the lower line after the detail.
  - Reason: rebuilding a drawn element is the owner's call and adds nothing to the job.
- The method is shown as its name only, with no icon.
  - Reason: the name alone says how the expense was paid, and the drawing has no icon there.
- The detail truncates before the method's name.
  - Reason: the method is the shorter part and the one the seller uses to tell how an expense was paid.
- The category is never shown twice when the detail is empty.
  - Reason: repeating it adds noise and goes against the no-placeholder rule already in `expenses.md`.
- The design capture reports "not compared" for the method in the row.
  - Reason: no drawing covers it, and the drawn structure does not change.

## Risks

The pinned mobile fixture stays as it is, so the Mobile check may not walk a row with a method. That leaves the one-line behaviour at 320 px with the text at 130 % without automated proof.

## Screens

The screens come from the design stage. This task changes the Expenses list row, and no drawing covers the method's placement.

## Slices

### expenses-row-payment-method

#### Acceptance criteria

- A row with a method shows its current name after the detail, as "{detail} · {method}", with no icon, and the line never wraps.
- A row without a method shows no placeholder of any kind.
- An empty detail gives the category as the title, shown once. The lower line then holds only the method's name, or does not exist.
- An archived method's name still shows.
- The row's accessible name includes the method's name only when there is one.
- No new copy key, the pinned mobile fixture is unchanged, and `ci-ok` is green, including the Mobile check over Expenses.

#### Risks

- mobile-check-fixture-without-method
