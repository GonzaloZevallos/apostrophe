# Expenses

Money a business spends on anything that isn't flower, filed under its own expense
categories and seen only by that business (ADR-0004). Flower bought is a purchase (stock),
never an expense. Results (#7) read expenses and purchases separately. Gastos is reached
from Más on the phone and from the sidebar on a computer; categories are managed in
Configuración → Categorías de gastos (navigation.md).

## Jobs

**When** I pay for something that isn't flower (packaging, a delivery or trip, cultivation
supplies, anything else), **I want** to note it from my phone with its date, category,
amount and a short detail, and fix or delete it if I got it wrong, **so I can** see how
much I spend each month and on what, and have my profit and cash count it.

**When** I run my business from my phone, **I want to** keep my expenses up to date from
the phone, **so I can** stop keeping them in the spreadsheet and have real data in place
when sales arrive.

**When** I run my business from my phone between orders or mid-chat with a customer,
several times a day, **I want** the app laid out around what I actually do and how often,
with expenses within reach for the weekly or monthly look and every setting in one place,
**so I can** get back to the customer instead of hunting through menus. (The navigation
job, navigation.md: served here by "+ Cargar gasto" in Más, a way to record from Gastos
itself, Gastos as the one monthly view, and categories in Configuración.)

In practice, these jobs come together like this. The seller pays for something that isn't
flower between orders, or sits down for the weekly or monthly look at spending. They load
the expense in at most 2 taps from wherever they are. They find any month's expenses, with
the total and what each category took, in one obvious place. The computer is the same job
on a bigger screen.

Success criteria:

1. An expense is recorded from the phone in under a minute. Its form opens in at most 2
   taps from any tab root (Más → "+ Cargar gasto") and in 1 tap from Gastos. On a
   computer it takes no more taps than on the phone. The date is already set to today,
   and the category is picked from the business's list.
2. For any month, the view shows every expense of that month and the month's total. It
   breaks them down by category, with a subtotal for each. The totals always equal the sum
   of the expenses shown, including straight after an edit or a delete.
3. Flower is never an expense. Nothing here records grams or a variety, and a purchase
   never appears in the expense lists. That way results can count expenses and purchases
   separately without counting anything twice.
4. Everything here is done from the phone with no API call by hand.
5. **Categories are managed in one place.** Gastos has no add, rename or remove of
   categories, only a link to Configuración → Categorías de gastos. The one exception is
   creating a category inside the expense form.
6. **It looks as designed.** Más and Gastos, phone and computer, match
   `docs/product/design-system/pantallas/`, judged by eye.

## Behaviour

### Expense category

- Category names follow the variety-name rule:
  - trimmed, inner spaces collapsed, up to 60 characters;
  - unique within a business whatever the case or spacing;
  - two businesses may each have a category with the same name.
- **Default categories**: "Insumos de cultivo", "Packaging", "Shipping and transport" and
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
    "It can't be deleted: it still has expenses. You can rename it." No breakdown of where
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
- A month with no expenses shows a total of $0 and no categories. The flower line and the
  way to record an expense still show.
- This view is how a user finds a mistaken expense to fix or delete.

### On screen

- **Gastos** (`Expenses`, route `/expenses`; the old `/gastos` redirects there permanently)
  is a tab root (navigation.md). It shows the bar on the phone or the sidebar on a
  computer, with Gastos active, and "+ New sale". It is reached from Más on the phone
  and from the sidebar on a computer, under the divider. It holds:
  - month navigation;
  - the fixed line "Flower purchases don't go here: enter them in Stock.";
  - a link that opens Configuración → Categorías de gastos. Gastos itself never adds,
    renames or removes a category;
  - its own way to record a new expense, opening the expense form with today's date in
    1 tap:
    - on the phone, a secondary action in Gastos' body, never a second floating "+"
      competing with "+ New sale";
    - on a computer, the "Add expense" button in the page header.

    Its exact look is design's call.
- **"+ Cargar gasto"**, first in Más on the phone (route `/more`; the old `/mas`
  redirects there permanently), opens the expense form directly with today's date. Its
  subtitle is design's call.
- **The expense form** is a form (navigation.md): no bar and no "+ New sale", and it
  closes with "Close".
  - "Category", "Amount" and "Details" are marked required.
  - Submit is blocked while the detail is blank.
  - The date comes filled with today.
  - "Close" and a successful save go back by history to the screen that opened it (Más
    or Gastos).
  - With no history (a direct link), it goes back to Gastos on the current month.
  - A successful save shows "Expense saved" with no jump elsewhere. After a save from
    Gastos, Gastos stays on the month it was showing and refreshes.
  - Leaving with something typed asks before discarding; an untouched form closes at
    once.
- **A category gone while the expense form is open** (a partner removed it):
  - saving keeps the form open and everything typed;
  - the category list refreshes and "Category" is left empty;
  - the field shows "That category is gone. Pick another."
- **Deleting an expense**, from the expense reached in the monthly view:
  - it is confirmed with "Before deleting", naming the date, category and amount, e.g.
    "Delete the $ 4.500 expense in Packaging from 28/09?";
  - there is no undo;
  - the total and the subtotal update at once, and a category left with no expenses that
    month disappears.
- **Categories** are managed in Configuración → Categorías de gastos, and nowhere else:
  add, rename and "Delete". A blocked removal shows the fixed refusal above. Creating
  one inside the expense form stays as described.
- **An expense or category that is gone** when it is saved, deleted or opened follows the
  app's rule in `accounts.md`: "That is gone." Opening one offers "Volver a Gastos" on
  the current month.
- **Toasts**: "Expense saved", "Expense deleted", "Category saved" and "Categoría
  eliminada", with no amounts in them.
- **Refusals** show inline and keep what was typed.
- **Feedback**: network loss shows "No connection", and a server error shows a generic
  retry (accounts.md).

### Constraints

- Categories and expenses carry `business_id`, and their routes join the isolation sweep
  (ADR-0004).
- No amounts or details are written to logs, the browser console or browser storage.
- A link from Gastos to Configuración → Categorías de gastos appears only once that group
  exists. No link may point at a screen that doesn't exist, and no seller may lose
  category management.

## Metrics

Read from the data and from tests; there is no telemetry.

- **M1, recorded on the spot (criterion 1)**: the share of expenses whose date equals the
  Argentina day they were recorded. Target: a majority once the front is in use. Through
  the front, recording an expense from the phone takes under 60 s.
- **M2, totals hold (criterion 2)**: totals that differ from the sum of the expenses shown
  must be 0. This is checked by tests after create, edit and delete, in the API and on
  screen. A month with no expenses shows $0 and no categories.
- **M3, "on what" (criterion 2)**: the share of each month's spend filed under "Otros".
  If it stays high, the categories are not helping the user see where the money goes.
- **M4, use**: businesses with at least one expense in a month, out of active businesses.
- **M5, flower kept out (criterion 3)**: purchases that appear in the expense lists must be
  0, by construction. An expense has no field that could hold grams or a variety.
- **M6, no curl (criterion 4)**: the end-to-end front run:
  - records an expense from Más → "+ Cargar gasto" and one from Gastos;
  - edits and deletes one;
  - moves between months;
  - adds, renames and removes a category in Configuración, including a refused removal.
- **M7, taps (criterion 1)**: the end-to-end run counts the taps to open the expense form,
  on phone and computer viewports:
  - from every tab root, ≤2;
  - from Gastos, 1;
  - on a computer, never more than on the phone.

  Target: 100% within budget.
- **M8, Gastos chrome (criteria 1, 5)**: front tests show:
  - the bar or sidebar, with "+ New sale";
  - the month navigation and the fixed flower line;
  - the record action: secondary on the phone (no second floating "+"), the header
    button on a computer.
- **M9, categories left Gastos (criterion 5)**: front tests show:
  - no add, rename or remove of categories in Gastos;
  - a link that opens Configuración → Categorías de gastos;
  - inline creation in the expense form still working.
- **M10, form return**: front tests cover:
  - "Close" and a successful save going back by history to Más or to Gastos;
  - "Expense saved";
  - the discard confirmation, and the untouched close;
  - the no-history fallback to Gastos on the current month.
- **M11, redirects**: `/gastos` → `/expenses` and `/mas` → `/more` answer a permanent
  redirect, each tested.
- **M12, looks as designed (criterion 6)**: before and after comparisons from
  `scripts/design/compare.sh`, phone and computer, attached to the PR and judged by eye.

## Out of scope

- Profit, cash and any total across sales, purchases and expenses: the results capability.
- Importing the spreadsheet's expense tab. Old expenses are typed in with their real dates.
- Recurring expenses, attachments and receipts.
- Edit history of an expense.
- An all-time list of expenses per category.
- A chronological list of expenses.
- Archiving a category.
- Managing categories from Gastos.
- Building Configuración or its groups: navigation.md and their own issues.
