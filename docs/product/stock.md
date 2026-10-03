# Stock

What comes into a business (stock entries), what it has on hand per variety, and what
every gram sold or gifted cost, taken from the lots it came out of, oldest first. Seen
only by its business (ADR-0004). Reads sale lines from sales and varieties from
varieties. Its cost of goods sold feeds profit (#7) and margins (#8). Cost follows the
lots as they stand and is never frozen (ADR-0009).

## Jobs

**When** I buy, harvest or count flower, **I want** to record it from my phone in a few
taps (date, variety, grams, where it came from, what it cost), **so I can** know what I
have of each variety, see one running out before a customer asks for it, and know what
the grams I sell or gift cost me.

**When** I run my business from my phone, **I want to** keep my stock up to date from the
phone, **so I can** stop keeping it in the spreadsheet's stock tab.

Success criteria:

1. **Exact stock**: a variety's stock always equals its entries minus the grams sold or
   gifted, exact to the hundredth, with no drift or rounding. It holds straight after an
   entry is recorded, edited or deleted, and after a sale is recorded or deleted.
2. **A count corrects it**: the seller weighs what is on hand and records the difference
   as an adjustment, plus or minus. Afterwards the stock shown equals the count. The app
   never reconciles itself.
3. **Traceable, bounded cost**: every sale or gift line knows which lot or lots its grams
   came from, oldest first, and what they cost.
   - Across all lines, the cost taken from a lot never exceeds the lot's cost.
   - Once a lot is used up, the costs taken from it add up to exactly its cost.
   - Grams with no lot behind them are pending, never $0.
4. **Visible status, no surprises**: Stock and Variedades say on their own, by shape and
   word and never by color alone, when a variety is sold out or below its threshold, so
   the seller never finds out partway through a sale. A variety with no threshold still
   shows sold out. Days left at the pace of the last 30 days sits next to each variety's
   grams.
5. **Clean start**: a fresh business records its opening stock as ordinary
   `opening stock` entries before its first sale. A business bringing real history moves
   it through the spreadsheet import (#11). There is no date rule between opening stock
   and sales.
6. **From the phone**: an entry is recorded from the phone in under a minute, and
   everything here is done with no API call by hand.

## Behaviour

### Stock entry

- **Fields**: a date, a variety, grams, an origin, an optional total cost and an optional
  note.
- **Date**: defaults to today in Argentina time. Earlier days are allowed; a future date
  is refused.
- **Variety**: must be one of the business's own. Any other id answers 404.
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

### Lots and cost of goods sold (ADR-0009)

- **Lots**: every positive entry is a lot. Its cost per gram is the total cost over its
  grams.
  - With no recorded cost, the lot costs $0.
  - A negative adjustment is not a lot. Its grams go out like a sale's.
- **Order**: grams going out of a variety (sale lines, gift lines and negative
  adjustments) take from the oldest lot of that variety first.
  - Lots are ordered by date, then by recording order.
  - Grams going out follow the same order: by date, then the one recorded first draws
    first.
  - A late or corrected entry takes its place by its own date, whenever it was typed in.
- **Pending cost**: grams going out beyond every lot have no cost yet, never $0. A later
  entry of any origin covers them in date order, wherever its date falls.
- **Line cost**: each line's cost of goods is a whole-peso amount, rounded once over
  everything it took from every lot, never lot by lot. A used-up lot's drawn costs sum to
  exactly its cost.
- **Never frozen**: costs are always computed from the entries as they stand now.
  - Any change to entries or sales shows in every affected cost the next time it is read.
  - There is no time bound and no closed period.
  - Only that variety's cost of goods moves: never a sale's prices, line totals, payments
    or balances (ADR-0003, ADR-0007), and never other varieties' costs.
- **Overselling**: recording a sale or gift is never refused because of stock.

### Stock, status and days left

- **Stock** for a variety: the sum of its entries' grams, signed, minus the grams of its
  sale lines (gifts included). It can be negative, and is always shown as a figure.
- **Status**: checked in this order, and the first that fits applies.
  1. **No entries**: nothing has moved for the variety, with no stock entry and no sale
     or gift. Its stock is exactly 0.
  2. **Sold out**: stock ≤ 0. This includes a variety with sales or gifts but no stock
     entry, and one whose entries net to 0 (ADR-0009: overselling shows sold out at
     once). It shows the date of the movement after which stock has stayed at or below 0
     ("Sin gramos desde el 30/09"), and for a variety with no entries that is the day of
     its first sale or gift.
  3. **Low**: stock > 0 and under the variety's low-stock threshold.
  4. **Ok**: otherwise.
- **Low-stock threshold**: optional, per variety, above zero, up to two decimals. It is
  set or turned off from the variety. With none, a variety is never low, but it can still
  be sold out.
- **Days left**: stock ÷ (grams sold or gifted in the last 30 days, today included,
  ÷ 30), rounded down to whole days. Nothing shows when stock ≤ 0 or when no grams went
  out in those 30 days.
- **Total**: the sum of every variety's stock.

### On screen (Stock)

- **Bar**: Stock is a tab: Inicio · Clientes · Stock · Más.
- **Stock** (`Stock`):
  - the total grams;
  - per variety: its grams, its status mark and its detail ("Sin gramos desde el 30/09",
    "Avisás abajo de 20 g", "Al ritmo de los últimos 30 días", "Cargale la primera
    entrada" only for no entries), plus days left;
  - the entries with date, variety, origin, grams, total cost and cost per gram, newest
    date first, then most recently recorded first. Each can be edited or deleted.
- **Status marks** (`MarcaEstado`): told by shape and word, never by color alone.
  - square = agotada, as the inverted chip, not red;
  - filled circle = baja;
  - empty circle = ok.
- **Empty state**: "Sin entradas de stock · Cargá tu stock inicial o una compra".
- **Nueva entrada** (`EntradaStock`):
  - date (filled with today), grams, and variety with "Hoy tiene N g";
  - origin: Compra · Cosecha · Stock inicial · Ajuste;
  - total cost, with "Obligatorio cuando es una compra";
  - note;
  - the cost per gram before saving ("Te queda en $ 8.500 el gramo") whenever there is a
    cost.
- **Editing an entry**: saving is confirmed first.
- **Deleting an entry**: confirmed with "Antes de borrar", naming the date, variety and
  grams.
- **Pending cost**, wherever a line's cost shows:
  - "Costo pendiente" when none of the line is costed;
  - the costed part plus "y N g sin costo" for a split line;
  - a gift reads "Regalo".
- **Toasts**: "Entrada guardada", "Entrada eliminada" and "Aviso guardado". None carries
  grams or amounts.
- **Refusals** show inline and keep what was typed.
- **An entry that is gone** follows accounts.md's "Eso ya no está." rule.

### Constraints

- Every stock table carries `business_id`. The business comes from the session.
- Every route joins the isolation sweep, the gated-route test and the ownership migration
  test.
- Refusals carry codes from `contract.json` (ADR-0008) and never repeat the note, grams,
  amounts or names (ADR-0005).
- No note, grams or amount goes to logs, the console or browser storage.

## Metrics

- **Exact stock (criterion 1)**: after each kind of operation (record, edit or delete an
  entry; record or delete a sale), stock equals in minus out to the hundredth. 100%
  passing.
- **Count corrects (criterion 2)**: stock N plus an adjustment of (count − N) reads count,
  for both signs.
- **Lot conservation (criterion 3)**: for every lot, the grams drawn are ≤ its grams and
  the cost drawn is ≤ its cost, and both are equal once the lot is used up. One line
  spanning lots is rounded once. Pending grams are never costed $0.
- **Recompute (criterion 3)**: a backdated, edited or deleted entry moves costs in that
  variety only. Prices, line totals, payments and other varieties stay unchanged. 100%
  passing.
- **Oversell (criterion 3)**: a sale beyond stock is recorded. Stock reads negative and
  the status reads sold out.
- **Status (criterion 4)**: the matrix of nothing moved (no entries), sales without
  entries (sold out), entries netting to 0 (sold out), low, ok and no threshold, plus days
  left: 100%. No status is told by color alone.
- **Isolation**: every stock route sits in the sweep and answers 404 or empty from another
  business, including a reference to another business's variety.
- **No echo**: no refusal or log contains the note, grams or amounts.
- **Speed (criterion 6)**: an entry is recorded from the phone in under 60 s through the
  front. Reading stock and costs answers in under 300 ms with a few dozen varieties.
- **No curl (criterion 6)**: the end-to-end front run records, edits and deletes an entry,
  and sets and turns off a threshold.

## Out of scope

- How results (#7) and margins (#8) present pending cost and a negative adjustment's
  draw.
- Reconstructing lots from the spreadsheet: that is the import (#11).
- A date rule between opening stock and sales.
- Spreading cultivation inputs over harvests: those are expenses.
- Live updates between partners; edit history of an entry.
- Notifications outside the app.
