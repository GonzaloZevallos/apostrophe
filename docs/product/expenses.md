# Expenses

Money a business spends on anything that isn't flower, filed under its own expense
categories and seen only by that business (ADR-0004). Flower bought is a purchase (stock),
never an expense. Results (#7) read expenses and purchases separately.

## Jobs

**When** I pay for something that isn't flower (packaging, a delivery or trip, cultivation
supplies, anything else), **I want** to note it from my phone with its date, category,
amount and a short detail, and fix or delete it if I got it wrong, **so I can** see how
much I spend each month and on what, and have my profit and cash count it.

**When** I run my business from my phone, **I want to** keep my expenses up to date from
the phone, **so I can** stop keeping them in the spreadsheet and have real data in place
when sales arrive.

Success criteria:

1. An expense is recorded from the phone in under a minute. The date is already set to
   today, and the category is picked from the business's list.
2. For any month, the view shows every expense of that month and the month's total. It
   breaks them down by category, with a subtotal for each. The totals always equal the sum
   of the expenses shown, including straight after an edit or a delete.
3. Flower is never an expense. Nothing here records grams or a variety, and a purchase
   never appears in the expense lists. That way results can count expenses and purchases
   separately without counting anything twice.
4. Everything here is done from the phone with no API call by hand.

## Behaviour

### Expense category

- Category names follow the variety-name rule:
  - trimmed, inner spaces collapsed, up to 60 characters;
  - unique within a business whatever the case or spacing;
  - two businesses may each have a category with the same name.
- **Default categories**: "Insumos de cultivo", "Packaging", "Envíos y traslados" and
  "Otros".
  - A new business opens with them.
  - A business opened before expenses existed receives them once, when the app is
    upgraded.
  - Each business receives the defaults exactly once. A default it removes is never
    recreated.
- **Add**: a duplicate name is refused, with the reason.
- **Rename**: the category's expenses stay under the new name. Renaming to a name another
  category of the business already has is refused.
- **Remove**: permanent; there is no archive or restore. Refused while any expense, of any
  month, is filed under the category.
  - The refusal says only that it still has expenses and suggests renaming it instead:
    "No se puede borrar: todavía tiene gastos. Podés renombrarla." No breakdown of where
    it is used is shown.
  - Once its expenses are deleted or moved to another category, it can be removed.
- There is no minimum: a business may remove every category without expenses, defaults
  included.
- The category list shows every category of the business, sorted by name.
- **Adding a category inside the expense form**: the user can create a category while
  recording an expense, without leaving the form or losing what they already typed.
  - The new category comes out selected for that expense.
  - A duplicate name is refused with the reason, and the expense being typed is kept.

### Expense

- **Date**: defaults to today in Argentina time. It can be changed to any earlier day; a
  future date is refused.
- **Category**: required, with no default; it is chosen every time. It must be one of the
  business's own categories. Any other category id answers 404.
- **Amount**: required, in whole pesos, above zero.
- **Detail**: required, trimmed, not blank, up to 200 characters.
- An expense has no grams, no variety and no pending, draft or approval state.
- **Edit**: all four fields can be edited in place, with the same validation as when
  recording. No edit history is kept.
- **Delete**: removes the expense for good.
- Both an edit and a delete show in the month's totals immediately.

### Monthly view

- One view per month, opening on the current month in Argentina time.
- It shows the month's total, then each category that has expenses that month. Each
  category shows its subtotal and its expenses.
- Categories with no expenses that month are left out. Categories are sorted by name.
- Within a category, expenses run newest date first; on the same date, the most recently
  recorded comes first.
- A month with no expenses shows a total of $0 and no categories.
- This view is how a user finds a mistaken expense to fix or delete.

### On screen (Gastos)

- **The monthly view** (`Gastos`):
  - move between months;
  - a fixed line: "Las compras de flores no van acá: se cargan en Stock."
- **The expense form**:
  - "Categoría", "Monto" and "Detalle" are marked required;
  - submit is blocked while the detail is blank;
  - the date comes filled with today.
- **Deleting an expense**, from the expense reached in the monthly view:
  - it is confirmed with "Antes de borrar", naming the date, category and amount, e.g.
    "¿Borrás el gasto de $ 4.500 en Packaging del 28/09?";
  - there is no undo;
  - the total and the subtotal update at once, and a category left with no expenses that
    month disappears.
- **Categories**: add, rename and "Eliminar". A blocked removal shows the fixed refusal
  above.
- **Toasts**: "Gasto guardado", "Gasto eliminado", "Categoría guardada" and "Categoría
  eliminada", with no amounts in them.
- **Refusals** show inline and keep what was typed.

### Constraints

- Categories and expenses carry `business_id`, and their routes join the isolation sweep
  (ADR-0004).
- No amounts or details are written to logs, the browser console or browser storage.

## Metrics

Read from the data; there is no telemetry.

- **M1, recorded on the spot (criterion 1)**: the share of expenses whose date equals the
  Argentina day they were recorded. Target: a majority once the front is in use. Through
  the front, recording an expense from the phone takes under 60 s.
- **M2, totals hold (criterion 2)**: totals that differ from the sum of the expenses shown
  must be 0. This is checked by tests after create, edit and delete, in the API and on
  screen.
- **M3, "on what" (criterion 2)**: the share of each month's spend filed under "Otros".
  If it stays high, the categories are not helping the user see where the money goes.
- **M4, use**: businesses with at least one expense in a month, out of active businesses.
- **M5, flower kept out (criterion 3)**: purchases that appear in the expense lists must be
  0, by construction. An expense has no field that could hold grams or a variety.
- **M6, no curl (criterion 4)**: the end-to-end front run records, edits and deletes an
  expense, and adds, renames and removes a category, including a refused removal.

## Out of scope

- Profit, cash and any total across sales, purchases and expenses: the results capability.
- Importing the spreadsheet's expense tab. Old expenses are typed in with their real dates.
- Recurring expenses, attachments and receipts.
- Edit history of an expense.
- An all-time list of expenses per category.
- A chronological list of expenses.
- Archiving a category.
