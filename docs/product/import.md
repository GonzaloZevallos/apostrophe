# Import

The one-time load of a business's history from the spreadsheet `Control_de_ventas_y_gastos` (an `.xlsx` export) into that business, run by the installation's operator on the day the business switches to the app. It is an operator script, not a route or a screen. It writes varieties and price history (varieties.md), catalog attributes, header and footer (catalog.md), stock entries (stock.md), expense categories and expenses (expenses.md), customers (customers.md), and sales with their on-the-spot payments (sales.md). Every imported record is the same data, under the same rules, as if it had been entered by hand. Everything it writes belongs to the target business alone (ADR-0004).

## Jobs

**When** I switch my business from the spreadsheet to the app, **I want** what the sheet already holds (varieties and their price history, catalog setup, stock entries, expenses, and every sale with who still owes for it) loaded into my business once, on the day I stop using the sheet, **so I can** keep selling in the app from the next order with my real prices, stock and debts in place. I don't retype months of rows, and I don't lose track of who owes me.

Success criteria:

1. **Look before writing.** A dry run reports everything that would be imported and every problem it finds, and writes nothing. The real run loads everything or nothing. If it is refused, the business stays exactly as it was.
2. **The seller opens where the sheet left off on what they act on.** After the import, these figures match the sheet's own records:
   - each variety's current price;
   - the catalog text;
   - stock per variety, to the hundredth of a gram;
   - each customer's balance and owing since, to the peso.

   Any figure that doesn't match is explained in the report. Profit and cash are not expected to match the sheet's Panel, because the sheet got profit wrong. Past Ganancia and Caja come from the app's own rules over the imported rows.
3. **Nothing invented.** The command never guesses a phone number, never imports a row the sheet marked incomplete, and never takes over a derived column (Total, Precio x g, Revisar…). Derived figures are recomputed through the product's rules. Anything it can't trust is reported to the operator, who fixes the file or the mapping and runs it again.
4. **One business, once, never mixed.** It imports only into one business that has no records yet, and never touches a business that has data. Everything imported belongs to that business alone (ADR-0004). The real sheet and its customers' data never enter the repository.

## Behaviour

### Who runs it, and how

- **Who and when**: an operator script, like `scripts/invite-business.sh`. It runs once per business on switch day, after the business is opened through its new-business invitation and before the seller records anything.
- **Not an app feature**: it is neither a route nor a screen, and sits outside accounts.md's "no curl" criterion, as `invite-business.sh` does.
- **Which business**: the operator names the target business on the command line. An unknown business is refused and nothing is written.
- **Inputs**:
  - the `.xlsx` export;
  - a file mapping customer name → phone number;
  - a dry-run switch.

### Dry run and real run

- **Dry run**: runs every check and writes nothing, whatever the outcome. It lists every problem in one pass.
- **Real run**: loads everything or nothing. Any blocking problem leaves the business exactly as it was.
- **Mismatches**: both runs recompute every derived figure and report every row whose recomputed total differs from the sheet's. A mismatch never blocks.
  - The sheet's Ventas Total is compared with the app's sale total, shipping included. This interim rule stands until it is confirmed whether the sheet's Total includes shipping. A wrong guess can only add mismatches to the report; what is stored never changes.
- **The report**, the same for a dry run and a successful real run:
  - counts per kind of record: varieties, price entries, catalog attributes, stock entries, expense categories, expenses, customers, sales and payments;
  - every blocking problem, with its sheet and row;
  - every row left out as incomplete;
  - every total mismatch, with the sheet's total and the recomputed one;
  - categories merged by name;
  - spellings merged into one customer, and the name kept;
  - unused mapping entries.
- **What the report may show**: it exists only on the operator's terminal. It may name customers and show amounts. It never repeats a phone number, including a malformed one. Nothing of it goes to logs (ADR-0005).

### Eligibility

- The import is refused if the business has any variety, price entry, stock entry, customer, sale, payment or expense. The refusal comes before any sheet check and changes nothing.
- These don't count:
  - the business, its name, its users and its invitations;
  - the seeded expense categories, even if renamed or removed;
  - the seeded catalog header and footer.
- The import overwrites the header and footer. It matches or adds categories, and never renames or removes one.

### Reading the file

- The Ventas, Entradas and Gastos columns are found by their header text. The exact headers and header rows are still to be confirmed against the real sheet.
- A required column that can't be found blocks the run. The dry run lists every missing column at once.

### Sheet by sheet

- **Varieties and thresholds** (Ajustes rows 7–16, thresholds in F7:F16):
  - These rows are the complete list of varieties. Blank rows are skipped.
  - Two rows with the same name under varieties.md's rule (case and spacing ignored) block.
  - Every variety named anywhere else (Catálogo, Entradas, Ventas, price history) must match one of them, or the import blocks.
  - A blank threshold means none. A threshold that isn't above zero with at most two decimals blocks.
- **Price history** (Ajustes from row 37: variety, effective date, list price, bulk price, bulk minimum):
  - one price entry per row, following varieties.md's rules;
  - two entries for one variety on one date block;
  - a bulk price without a bulk minimum, or the reverse, blocks;
  - a bulk price not below the list price blocks.
- **Catálogo** (rows 6–15: variety, shown, emoji, % índica, aroma; B18/B19: header and footer):
  - "Sí" means shown and "No" means hidden. Any other value blocks.
  - An emoji cell holding plain text or more than one emoji blocks.
  - A share that isn't a whole number from 0 to 100 blocks. An aroma over 200 characters blocks.
  - A variety with no Catálogo row is shown, with no emoji, share or aroma.
  - B18 and B19 replace the seeded header and footer. A blank cell gives a blank header or footer. More than 500 characters blocks.
- **Entradas** (date, variety, grams, origin, total cost, note):
  - "Compra" → purchase, "Cosecha" → harvest, "Stock inicial" → opening stock, "Ajuste" → adjustment. Any other origin blocks.
  - Each row follows stock.md's rules as if recorded today: grams, date, cost per origin and note. A row stock.md would refuse blocks.
- **Gastos and categories** (Gastos: date, category, amount, detail; categories in Ajustes A21:A28):
  - Each A21:A28 name is matched to an existing category under expenses.md's name rule. A name with no match is created.
  - Two A21:A28 names that match each other become one category, and the report says so.
  - An expense under a category outside A21:A28 blocks.
  - Each row follows expenses.md's rules: a past or present date, a whole-peso amount above $0, and a non-blank detail of up to 200 characters.
- **Ventas** (date, variety, grams, payment, customer, type, shipping, special total, note): one sale with one line per row.
  - **Shipping and note**: shipping charged comes from the row. The note follows sales.md's rule.
  - **"Pendiente"**: the sale is left owing.
  - **"Efectivo" / "Transferencia"**: an on-the-spot payment equal to the recomputed total, with that method, on the row's date.
  - **Any other payment value** blocks.
  - **A row with a $0 total**: its payment value is ignored and nothing stays owed (sales.md).
  - **Incomplete rows**: a row whose Revisar cell holds any non-blank saved value is incomplete. It is left out and listed, and never blocks. This interim rule stands until the sheet's exact marker is confirmed.
  - **Revisar with no saved value**: a Revisar cell holding a formula with no saved value blocks the run. The report asks the operator to recalculate and save the file again. The import never guesses whether such a row is complete.
  - Revisar is only read to decide which rows to leave out. Its value is never stored.

### Pricing rules

- **`""` or `"Lista"`**: list or bulk, by sales.md rules 4 and 5, from the imported price history on the row's date and the row's grams. Never VIP, even for a customer who is VIP elsewhere.
- **`"Amigo"`**: the VIP rule, on that day's bulk price, or the list price when that day has none.
  - Any customer with at least one `"Amigo"` row is imported as VIP.
  - An `"Amigo"` row with no customer blocks.
- **`"Regalo"`**: a gift. It is charged $0 and its grams still come out of stock.
- **Special total**: a whole number above $0 makes the line a special price with that total, whatever the type. An `"Amigo"` row with a special total still makes its customer VIP.
- **These block**:
  - a special total on a `"Regalo"` row;
  - a special-total cell that isn't a whole number above $0 (zero, negative or text).
- **What is stored**: always the app's recomputed price, rule and total. A difference from the sheet is reported and never blocks. To keep the sheet's figure, the operator puts it in the special-total cell and runs again.

### What blocks

A row blocks if the product's own rules would refuse it if it were recorded today. Examples:

- a variety with no price that day and no special total;
- grams that aren't above zero with at most two decimals;
- a future date;
- a total above $0 with no payment method;
- a purchase with no cost;
- a note, aroma, header or footer that is too long.

Also blocking:

- a required column that can't be found in Ventas, Entradas or Gastos;
- an unknown variety name, or two Ajustes rows 7–16 that are the same name;
- two price entries for one variety on one date;
- an unknown origin or payment value;
- a category outside A21:A28;
- a bad Catálogo value or a bad threshold;
- a customer name missing from the mapping;
- a mapped number that doesn't normalise;
- "Pendiente" with no customer, or `"Amigo"` with no customer;
- `"Regalo"` with a special total;
- a special total that isn't a whole number above $0;
- a Ventas Revisar cell with no saved value.

Rows the sheet marked incomplete are the one exception: they are left out and listed, and never block.

### Customers

- **Who becomes a customer**: every name in Ventas, whether or not they ever owed. Each one needs a number.
- **A blank customer cell**: the row becomes a sale without a customer, which is allowed only when nothing stays owed.
- **Matching names to the mapping**: exact, after trimming and collapsing inner spaces, with no case-folding. Every unmatched name is listed at once.
- **Numbers**: each goes through customers.md's normalisation. A number that fails blocks, and the report never repeats it.
- **Several spellings, one number**: when the normalised numbers are the same, the spellings become one customer, and the report lists them together.
  - The customer is named after the spelling on their most recent Ventas row.
  - If those rows share a date, the lowest row in the sheet wins.
  - The seller can rename the customer afterwards.
- **Unused mapping entries**: an entry whose name is in no Ventas row creates no customer and is reported as unused.

### Order

- Within Entradas, and separately within Ventas, rows that share a date are recorded in sheet order, top to bottom. That order is their recording order, so it sets lot order (ADR-0010) and settlement (ADR-0012) on that date.
- Across dates, the date decides, so an unsorted sheet still lands right.
- Price-history and expense rows need no tie-break.

### Constraints

- **Isolation (ADR-0004)**: every created row carries the target business, and nothing is reachable from another business.
- **No echo (ADR-0005)**: no customer name, phone number or amount goes to logs. The report exists only on the operator's terminal.
- **Test data**: tests build their own small `.xlsx` and mapping fixtures. The real sheet and real customer data never enter the repository.

## Metrics

From test fixtures, with no telemetry:

- **Look before writing (criterion 1)**:
  - a dry run writes 0 rows in every table, whatever the outcome;
  - a refused real run writes 0 rows;
  - the dry run lists every blocking problem of a fixture in one pass, every missing column included.
- **Opens where the sheet left off (criterion 2)**: after importing a fixture, these equal its expected figures, with 0 unexplained differences:
  - each variety's current price;
  - the catalog text;
  - stock per variety, to the hundredth;
  - each customer's balance and owing since, to the peso.

  Ganancia and Caja are not compared with the sheet.
- **Recording order (criterion 2)**: a fixture with same-date entries and sales, in unsorted dates, gets its lot order and settlement from date first, then sheet order. 100% passing.
- **Nothing invented (criterion 3)**:
  - a matrix of every blocking case passes 100%, including a missing column and a Revisar cell with no saved value;
  - rows with a non-blank Revisar value are left out and listed without blocking;
  - a reference set of total mismatches, with and without shipping, is reported and never blocks;
  - merged categories, merged spellings and unused mapping entries all appear in the report.
- **One business, once (criterion 4)**:
  - an import into a business holding any one of the seven kinds of record is refused with 0 rows written, tested for each kind;
  - a business with only seeded, renamed or removed categories and the seeded header and footer is accepted;
  - imported rows are invisible from another business through the isolation sweep.
- **No echo**: after a run over a fixture with names, numbers and amounts, no log line contains any of them, and the report never contains a phone number.

## Out of scope

- Importing into a business that already has records; running it again, resuming or merging.
- An import screen or route in the app.
- Importing derived columns, or reproducing the sheet's profit and cash.
- Inventing customers, phone numbers, categories or varieties to get an import through.
- Grouping several rows into one sale with several lines.
- Undoing an import once it is done.
