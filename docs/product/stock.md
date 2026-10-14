# Stock

What comes into a business (stock entries), what goes out of it without a sale (stock
withdrawals), what it has on hand per variety, and what every gram sold, gifted or withdrawn
cost, taken from the lots it came out of, oldest first. Seen only by its business
(ADR-0004). Reads sale lines from sales and varieties from varieties. Its cost of goods
sold feeds profit (#7) and margins (#8); the cost of withdrawn grams feeds profit as
Promoción and Consumo propio, never cost of goods sold or margins. Cost follows the lots
as they stand and is never frozen (ADR-0009). Stock has no tab of its own: it is shown on
Variedades, in the list and on each variety's page (varieties.md).

## Jobs

**When** I buy, harvest or count flower, **I want** to record it from my phone in a few
taps (date, variety, grams, where it came from, what it cost), **so I can** know what I
have of each variety, see one running out before a customer asks for it, and know what
the grams I sell or gift cost me.

**When** I take grams out of my own stock without selling them (to share at a party so
people get to know the business, or for my own use), **I want** to record them from my
phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right
and see in Ganancia what promoting the business and my own consumption cost me, without
recording a sale nobody made or an adjustment that reads as lost flower.

This refines BRIEF.md's stock job and its results job; it is not a new top-level job.
Before it, the seller recorded such grams as a sale without a customer made of gift lines
(a sale nobody made), as a negative adjustment (lost flower, counted as shortfall), or not
at all (stock drifted until the next count corrected it as shortfall).

**When** I run my business from my phone, **I want to** keep my stock up to date from the
phone, **so I can** stop keeping it in the spreadsheet's stock tab.

**When** I run my business from my phone between orders or mid-chat with a customer,
several times a day, **I want** the app laid out around what I actually do and how often,
**so I can** get back to the customer instead of hunting through menus. (The navigation
job, navigation.md: served here by "+ Entrada de stock" and "Sacar del stock" on
Variedades, at most 2 taps from any tab root, and a variety's stock on its own page.)

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my
lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if
it never moved and archiving it if it has history, **so** my lists show only what I still
sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly
as it was if I start selling it again. (Served here by refusing new stock entries and
withdrawal lines on an archived variety while existing ones stay workable; defined in
varieties.md.)

Success criteria:

1. **Exact stock**: a variety's stock always equals its entries minus the grams sold,
   gifted or withdrawn, exact to the hundredth, with no drift or rounding. It holds
   straight after an entry or a withdrawal is recorded, edited or deleted, and after a
   sale is recorded or deleted.
2. **A count corrects it**: the seller weighs what is on hand and records the difference
   as an adjustment, plus or minus. Afterwards the stock shown equals the count. The app
   never reconciles itself.
3. **Traceable, bounded cost**: every sale or gift line and every withdrawal line knows
   which lot or lots its grams came from, oldest first, and what they cost.
   - Across all draws, the cost taken from a lot never exceeds the lot's cost.
   - Once a lot is used up, the costs taken from it add up to exactly its cost.
   - Grams with no lot behind them are pending, never $0.
4. **Visible status, no surprises**: Variedades (the list and each variety's page) says on
   its own, by shape and word and never by color alone, when a variety is sold out or
   below its threshold, so the seller never finds out partway through a sale. A variety
   with no threshold still shows sold out. Days left at the pace of the last 30 days sits
   next to each variety's grams.
5. **Clean start**: a fresh business records its opening stock as ordinary
   `opening stock` entries before its first sale. A business bringing real history moves
   it through the spreadsheet import (#11). There is no date rule between opening stock
   and sales.
6. **From the phone**: an entry is recorded from the phone in under a minute, and
   everything here is done with no API call by hand.
7. **Withdrawals, fast from the phone**: a withdrawal is recorded in under a minute; its
   form opens in at most 2 taps from any tab root, and on a computer in no more taps than
   on the phone.
8. **Withdrawals keep stock right**: once a withdrawal is recorded, edited or deleted, the
   change shows at once in the variety's stock, status, days left and history, and in the
   lots after it. Pending grams are pending, never $0.
9. **A withdrawal is not a sale and not a loss**: sales count, sales total, average sale,
   Ventas, every customer's history and Caja stay exactly as they were, and stock
   shortfall never includes a withdrawal. Its cost shows only as Promoción or Consumo
   propio (results.md, analysis.md).
10. **Businesses never mix** (ADR-0004), for withdrawals as for entries.
11. **Nothing new on an archived variety** (varieties.md): no new stock entry or
    withdrawal line is recorded against an archived variety, while an existing entry or
    withdrawal that already names it stays editable and deletable.

## Behaviour

### Stock entry

- **Fields**: a date, a variety, grams, an origin, an optional total cost and an optional
  note.
- **Date**: defaults to today in Argentina time. Earlier days are allowed; a future date
  is refused.
- **Variety**: must be one of the business's own. Any other id answers 404.
  - An archived variety is refused as gone (`variety.archived`), except on an edit that
    keeps the entry's own variety; an edit never moves an entry onto a different archived
    variety (varieties.md).
- **Grams**: up to two decimals, never zero.
  - Above zero for purchase, harvest and opening stock.
  - An adjustment may be positive or negative.
- **Origin**: purchase, harvest, opening stock or adjustment.
  - Opening stock has no limit per variety: it is an ordinary origin.
- **Total cost**: whole pesos.
  - Required and above $0 for a purchase.
  - Optional for harvest, opening stock and a positive adjustment; above $0 when given.
  - Refused on a negative adjustment.
- **Note**: optional. It is trimmed, holds up to 200 characters, and empty means none. It
  is never logged, searched or repeated in errors.
- **Edit**: every field, the variety included, with the same validation as when
  recording. It is confirmed before saving.
- **Delete**: a hard delete, confirmed first.
- **Consumed entries**: neither an edit nor a delete is ever refused because the entry's
  grams were already used (ADR-0009). Grams it no longer covers come out of the next lot,
  or become pending cost and negative stock.

### Stock withdrawal (Retiro)

- **Fields**: one reason, a date, one or more lines of variety and grams, and an optional
  note.
- **Reason**: Promoción (to make the business known) or Consumo propio (the seller's own
  consumption). Set once for the whole withdrawal, never per line. Required, with no
  default: it is chosen every time. A party that mixes both reasons is two withdrawals.
- **Date**: defaults to today in Argentina time. Earlier days are allowed; a future date
  is refused. It is the day the grams left stock; there are no planned or draft
  withdrawals.
- **Lines**: each a variety of the business (any other id answers 404) and grams above
  zero with at most two decimals. The same variety may appear in several lines, with no
  merging. A withdrawal with no lines is refused.
- **Archived varieties** (varieties.md: nothing new is recorded against one):
  - recording a withdrawal with any line on an archived variety is refused whole, as gone
    (`variety.archived`, 404), repeating no name, grams or amount;
  - an edit may name an archived variety only when the withdrawal as stored already has a
    line on that variety: such a line stays, and its grams may change, along with the
    date, reason, note and the other lines;
  - an edit that adds a line on an archived variety the withdrawal had no line on, or
    moves a line onto a different archived variety, is refused the same way;
  - deleting a withdrawal with a line on an archived variety works as for any other.
- **Note**: optional, trimmed, up to 200 characters; empty means none. Never logged,
  searched or repeated in errors.
- **Never refused for lack of stock** (ADR-0009). Stock may go negative and then shows
  as sold out.
- **No money moves**: Caja is untouched. A withdrawal is never a sale: it is in no sales
  count, sales total, average sale, Ventas or customer's history.
- **Edit**: every field (date, reason, lines, note) with the same validation as when
  recording. Saving is confirmed first. The lots after it are worked out again.
- **Delete**: a hard delete, confirmed with "Antes de borrar", naming the reason, date
  and total grams: "¿Borrás la promoción del 03/10? Vuelven 5 g al stock." or
  "¿Borrás el consumo propio del 03/10? Vuelven 5 g al stock.", with "No, dejalo / Sí,
  borralo". Its grams return to stock and land back on lots by date.
- Neither an edit nor a delete is refused because the withdrawal's grams were already
  drawn from lots (ADR-0009).

### Lots and cost of goods sold (ADR-0009)

- **Lots**: every positive entry is a lot. Its cost per gram is the total cost over its
  grams.
  - With no recorded cost, the lot costs $0.
  - A negative adjustment is not a lot. Its grams go out like a sale's.
- **Order**: grams going out of a variety (sale lines, gift lines, negative adjustments
  and withdrawal lines) take from the oldest lot of that variety first.
  - Lots are ordered by date, then by recording order.
  - Grams going out follow the same order: by date, then the one recorded first draws
    first.
  - A late or corrected entry or withdrawal takes its place by its own date, whenever it
    was typed in.
- **Pending cost**: grams going out beyond every lot have no cost yet, never $0. A later
  entry of any origin covers them in date order, wherever its date falls.
- **Line cost**: each draw's cost is a whole-peso amount, rounded once over everything it
  took from every lot, never lot by lot. A used-up lot's drawn costs sum to exactly its
  cost.
- **Where each draw's cost goes**: a sale or gift line's cost is cost of goods sold; a
  negative adjustment's is stock shortfall; a withdrawal line's is promotion cost or
  own-use cost, by its withdrawal's reason. A withdrawal's cost never enters cost of goods
  sold, stock shortfall or any variety's margin.
- **Never frozen**: costs are always computed from the entries, withdrawals and sales as
  they stand now.
  - Any change to them shows in every affected cost the next time it is read.
  - There is no time bound and no closed period.
  - Only that variety's costs move: never a sale's prices, line totals, payments or
    balances (ADR-0003, ADR-0007), and never other varieties' costs.
- **Overselling**: recording a sale, gift or withdrawal is never refused because of
  stock.

### Stock, status and days left

- **Stock** for a variety: the sum of its entries' grams, signed, minus the grams of its
  sale lines (gifts included) and of its withdrawal lines. It can be negative, and is
  always shown as a figure.
- **Status**: checked in this order, and the first that fits applies.
  1. **No entries**: nothing has moved for the variety: no stock entry, no sale or gift
     and no withdrawal. Its stock is exactly 0.
  2. **Sold out**: stock ≤ 0. This includes a variety with sales, gifts or withdrawals but
     no stock entry, and one whose entries net to 0 (ADR-0009: overselling shows sold out
     at once). It shows the date of the movement (a withdrawal included) after which
     stock has stayed at or below 0 ("Sin gramos desde el 30/09"), and for a variety with
     no entries that is the day of its first sale, gift or withdrawal.
  3. **Low**: stock > 0 and under the variety's low-stock threshold.
  4. **Ok**: otherwise.
- **Low-stock threshold**: optional, per variety, above zero, up to two decimals. It is
  set or turned off on the variety's page, in "Aviso de stock bajo". With none, a variety
  is never low, but it can still be sold out.
- **Days left**: stock ÷ (grams sold, gifted or withdrawn in the last 30 days, today
  included, ÷ 30), rounded down to whole days. Nothing shows when stock ≤ 0 or when no
  grams went out in those 30 days.
- **Total**: the sum of every variety's stock. The API answers it; no screen shows it.

### On screen (in Variedades)

- **No Stock tab.** Stock lives in Variedades (varieties.md, navigation.md); the old
  Stock path redirects there.
- **Per variety**, on Variedades' list and at the top of its page: its grams, its status
  mark and its detail ("Sin gramos desde el 30/09", "Avisás abajo de 20 g", "Al ritmo de
  los últimos 30 días", "Cargale la primera entrada" only for no entries), plus days
  left.
- **Status marks** (`MarcaEstado`): told by shape and word, never by color alone.
  - square = agotada, as the inverted chip, not red;
  - filled circle = baja;
  - empty circle = ok.
- **"Stock y entradas"** on a variety's page: its last 3 movements (entries and
  withdrawals) and "Ver todas" for all of that variety's movements, newest date first,
  then most recently recorded first.
  - A withdrawal row shows its date, "Promoción" or "Consumo propio", and that variety's
    grams in it with a minus sign (e.g. "−5 g"): going out is told by word and sign,
    never by color. A withdrawal touching several varieties shows on each one's page.
- **"Todas las entradas"**, at the foot of Variedades: a detail ("‹ Variedades") with
  every entry of the business, with date, variety, origin, grams, total cost and cost per
  gram, newest date first, then most recently recorded first. Each can be edited or
  deleted. It lists entries only, never withdrawals; there is no business-wide list of
  withdrawals.
  - Its empty state: "Sin entradas de stock · Cargá tu stock inicial o una compra".
- **Nueva entrada** (`EntradaStock`), a form (navigation.md): "Cerrar", and a
  confirmation when leaving with something typed.
  - Opened from "+ Entrada de stock" on Variedades (the seller chooses the variety) or
    from "+ Entrada" on a variety's page (that variety already chosen, and "Stock
    inicial" preselected as the origin when the variety has no entries yet).
  - date (filled with today), grams, and variety with "Hoy tiene N g";
  - origin: Compra · Cosecha · Stock inicial · Ajuste;
  - total cost, with "Obligatorio cuando es una compra";
  - note;
  - the cost per gram before saving ("Te queda en $ 8.500 el gramo") whenever there is a
    cost.
- **Sacar del stock**, the withdrawal form, a form (navigation.md): "Cerrar", no bar, no
  "+ Nueva venta", and a confirmation when leaving with something typed. It follows the
  phone standard for inputs and targets (#80).
  - Opened from Más (second, after "+ Cargar gasto"), from the secondary "Sacar del
    stock" on Variedades (next to "+ Entrada de stock", phone and computer), with no
    variety chosen, and from "Sacar del stock" on a variety's page, with that variety
    already chosen.
  - reason (Promoción · Consumo propio, required, no default), date (filled with today),
    one or more lines of variety and grams, and note.
  - Its variety pickers offer unarchived varieties only (varieties.md).
  - **Opened with a variety that is archived** (or unknown), for example through an old
    link: it opens as from Más, with no variety chosen, and says nothing about it.
  - Editing opens the same form with the withdrawal filled in; saving an edit is
    confirmed first.
  - **Editing a withdrawal with a line on a variety archived since**: that line shows the
    variety's plain name and its grams stay editable, and the withdrawal saves. The
    pickers of the other lines still offer unarchived varieties only.
  - **A variety archived while the form is open** (a partner archived it): saving is
    refused under varieties.md's rule, as for a stock entry. The form stays open, the
    line shows the gone message, and the rest of what was typed is kept.
- **A withdrawal's detail**, opened from its row: a detail (navigation.md), with the bar
  or sidebar and a "‹" back to the variety's page it came from (Variedades when there is
  no history), and no "+ Nueva venta". It shows the date, the reason, every line and the
  note, with "Editar" and "Borrar".
- **Editing an entry**: saving is confirmed first.
- **Deleting an entry**: confirmed with "Antes de borrar", naming the date, variety and
  grams.
- **Pending cost**, wherever a line's cost shows:
  - "Costo pendiente" when none of the line is costed;
  - the costed part plus "y N g sin costo" for a split line;
  - a gift reads "Regalo".
- **Toasts**: "Entrada guardada", "Entrada eliminada", "Aviso guardado", "Retiro
  guardado" and "Retiro eliminado". None carries grams or amounts.
- **Refusals** show inline and keep what was typed.
- **An entry or withdrawal that is gone** follows accounts.md's "Eso ya no está." rule:
  opening it offers "Volver a Variedades"; saving, deleting or confirming on it shows
  "Eso ya no está. La lista ya está al día."
- **Pinned catalog**: recording, editing or deleting an entry or a withdrawal is an
  upkeep trigger (pinned-catalog.md).

### Constraints

- Every stock and withdrawal table carries `business_id`. The business comes from the
  session.
- Every route joins the isolation sweep, the gated-route test and the ownership migration
  test.
- Business removal exports and deletes withdrawals and their lines through ADR-0015's
  schema reflection.
- Refusals carry codes from `contract.json` (ADR-0008) and never repeat the note, grams,
  amounts or names (ADR-0005). A line on an archived variety reuses `variety.archived`
  (kind `gone`); no new code is added.
- No note, grams or amount goes to logs, the console or browser storage.
- Copy is in Rioplatense Spanish with vos.

## Metrics

- **Exact stock (criteria 1, 8)**: after each kind of operation (record, edit or delete
  an entry or a withdrawal; record or delete a sale), stock equals in minus out to the
  hundredth. 100% passing.
- **Count corrects (criterion 2)**: stock N plus an adjustment of (count − N) reads count,
  for both signs.
- **Lot conservation (criterion 3)**: for every lot, the grams drawn are ≤ its grams and
  the cost drawn is ≤ its cost, and both are equal once the lot is used up, withdrawals
  included. One draw spanning lots is rounded once. Pending grams are never costed $0.
- **Recompute (criteria 3, 8)**: a backdated, edited or deleted entry or withdrawal moves
  costs in that variety only. Prices, line totals, payments and other varieties stay
  unchanged. 100% passing.
- **Oversell (criterion 3)**: a sale or a withdrawal beyond stock is recorded. Stock reads
  negative and the status reads sold out.
- **Status (criterion 4)**: the matrix of nothing moved (no entries), sales without
  entries (sold out), a withdrawal only (not "sin entradas"), entries netting to 0 (sold
  out), low, ok and no threshold, plus days left counting withdrawn grams and "Sin gramos
  desde" following a withdrawal's date: 100%. No status is told by color alone.
- **Entry from a variety**: an entry started from a variety's page comes with that
  variety chosen, and with "Stock inicial" preselected only when it has no entries.
- **Not a sale, not a loss (criterion 9)**: after recording a withdrawal, 0 differences in
  sales total and count, average sale, Ventas, every customer's balance and account,
  Caja, stock shortfall, and every variety's margin and grams sold or gifted.
- **Withdrawal validation matrix**: grams at or below zero, more than two decimals, a
  future date, a missing reason, no lines, a note over 200 characters and another
  business's variety each give their own coded refusal, which never repeats the input.
- **Archived varieties (criterion 11)**: 100% passing, through the HTTP API.
  - Recording a withdrawal with a line on an archived variety, an edit adding a line on
    one, and an edit moving a line onto a different archived variety are each refused
    with `variety.archived` (404), writing nothing.
  - An edit keeping a line on a variety archived after the withdrawal was recorded, with
    its grams changed, is accepted; deleting that withdrawal works.
  - An unknown or another business's variety still answers its existing 404.
  - Front tests (Testing Library): the form opened with an archived variety's id has no
    variety chosen; the edit form of a withdrawal with an archived line shows its name and
    saves; a save refused with `variety.archived` keeps the form open with the rest of
    what was typed and shows the gone message on the line.
- **Isolation (criterion 10)**: every stock and withdrawal route sits in the sweep and
  answers 404 or empty from another business, including a reference to another business's
  variety.
- **No echo**: no refusal or log contains the note, grams or amounts. After a full front
  run, the console and browser storage hold none of them.
- **Speed (criteria 6, 7)**: an entry and a withdrawal are each recorded from the phone in
  under 60 s through the front, and each form opens in at most 2 taps from any tab root,
  on phone and computer viewports, never more on the computer. Reading stock and costs
  answers in under 300 ms with a few dozen varieties.
- **Withdrawal screens**: front tests show the form's chrome and its discard
  confirmation, the detail's chrome, the edit and delete confirmations, "Retiro guardado"
  and "Retiro eliminado", both "Eso ya no está." forms, history rows told apart by word
  and sign, and "Todas las entradas" holding no withdrawal.
- **No curl (criteria 6, 7)**: the end-to-end front run records an entry from Variedades
  and one from a variety's page, edits and deletes one from "Todas las entradas", sets
  and turns off a threshold on a variety's page, records a withdrawal from Más and one
  from a variety's page, and edits and deletes a withdrawal.
- **Looks as designed**: before and after comparisons from `scripts/design/compare.sh`
  for the withdrawal form, its detail, Variedades and a variety's page, phone and
  computer, judged by eye.

## Out of scope

- How results (#7) and margins (#8) present pending cost, a negative adjustment's draw
  and a withdrawal's cost: results.md and analysis.md.
- Reconstructing lots from the spreadsheet: that is the import (#11).
- A date rule between opening stock and sales.
- Spreading cultivation inputs over harvests: those are expenses.
- Live updates between partners; edit history of an entry or a withdrawal.
- Notifications outside the app.
- A Stock tab, or total grams on screen.
- A business-wide list of withdrawals; a per-variety breakdown of promotion or own-use
  cost.
- Planned or draft withdrawals; splitting one withdrawal across two reasons.
- Who attended a party or how many tried; tying a promotion to later sales; money spent
  on a party (an expense).
- Recording a new withdrawal line on an archived variety by any path; telling the seller
  why a preselected variety was not chosen.
