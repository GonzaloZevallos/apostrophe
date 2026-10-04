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
3. **Nothing invented.** The command never guesses a phone number, never imports a row the sheet marked unfinished, and never takes over a derived column (Total, Precio x g, Revisar…). Derived figures are recomputed through the product's rules. Anything it can't trust is reported to the operator, who fixes the file or the mapping and runs it again.
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
- **Mismatches**: both runs report every imported Ventas row whose sheet Total differs from the app's recomputed sale total, shipping included. The sheet's Total includes shipping, so the two are compared like for like. A mismatch never blocks.
- **The report**, the same for a dry run and a successful real run:
  - counts per kind of record: varieties, price entries, catalog attributes, stock entries, expense categories, expenses, customers, sales and payments;
  - every blocking problem, with its sheet and row;
  - every row left out as unfinished, with the sheet's own text for it (e.g. `Falta pago`);
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

- **Ventas, Entradas and Gastos**: column titles are on row 1 and data starts on row 2. Columns are found by their title.
  - **Ventas** reads `Fecha`, `Variedad`, `Gramos`, `Pago`, `Cliente`, `Tipo`, `Envío cobrado`, `Precio especial (total)` and `Nota`. It also reads `Total`, only to tell whether a row is finished and to report mismatches.
  - **Entradas** reads `Fecha`, `Variedad`, `Gramos`, `Origen`, `Costo total` and `Nota`, plus `Revisar` to tell whether a row is finished.
  - **Gastos** reads `Fecha`, `Categoría`, `Monto` and `Detalle`, plus `Revisar` to tell whether a row is finished.
  - The sheet's other formula columns (`Precio x g`, `Rige desde`, `Precio lista`, `Precio por cantidad`, `Cantidad mínima`, `Orden deuda`, `Día`, `Gramos válidos`, `Costo válido`, `Gramos con costo`) are never read. Nothing from `Total` or `Revisar` is ever stored.
- **A missing column**: a required column that can't be found blocks the run. The dry run lists every missing column at once.
- **Finished and unfinished rows**:
  - **Ventas**: a row is finished when its `Total` is a number. Text in `Total` means the row is unfinished: `Falta fecha`, `Falta variedad`, `Faltan gramos`, `Falta pago`, `Falta cliente`, `Sin precio` or any other text. An unfinished row is left out and listed with that text.
  - **Entradas and Gastos**: a row is finished when its `Revisar` is blank. Any text in `Revisar` means the row is unfinished, and it is left out and listed with that text.
  - A wholly empty row is skipped and not listed.
  - Unfinished rows never block.
- **A file that wasn't recalculated**: a Ventas row with any typed cell filled in, whose `Total` is empty, blocks the run. One message asks the operator to recalculate and save the file. This is the only recalculation check. In Entradas and Gastos, anything `Revisar` would flag is also refused by stock.md's and expenses.md's own rules, so it blocks anyway.
- **An unfinished row adds nothing.** It creates no customer, makes no one VIP, needs no phone number, and doesn't count when choosing which spelling of a customer is kept.

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
- **Entradas** (finished rows only):
  - "Compra" → purchase, "Cosecha" → harvest, "Stock inicial" → opening stock, "Ajuste" → adjustment. Any other origin blocks.
  - Each row follows stock.md's rules as if recorded today: grams, date, cost per origin and note. A row stock.md would refuse blocks.
- **Gastos and categories** (finished Gastos rows; categories in Ajustes A21:A28):
  - Each A21:A28 name is matched to an existing category under expenses.md's name rule. A name with no match is created.
  - Two A21:A28 names that match each other become one category, and the report says so.
  - An expense under a category outside A21:A28 blocks.
  - Each row follows expenses.md's rules: a past or present date, a whole-peso amount above $0, and a non-blank detail of up to 200 characters.
- **Ventas** (finished rows only): one sale with one line per row.
  - **Shipping and note**: shipping charged comes from `Envío cobrado`. The note follows sales.md's rule.
  - **"Pendiente"**: the sale is left owing.
  - **"Efectivo" / "Transferencia"**: an on-the-spot payment equal to the recomputed total, with that method, on the row's date.
  - **Any other payment value** blocks.
  - **A row with a $0 total**: its payment value is ignored and nothing stays owed (sales.md).

### Pricing rules

- **`""` or `"Lista"`**: list or bulk, by sales.md rules 4 and 5, from the imported price history on the row's date and the row's grams. Never VIP, even for a customer who is VIP elsewhere.
- **`"Amigo"`**: the VIP rule, on that day's bulk price, or the list price when that day has none.
  - Any customer with at least one finished `"Amigo"` row is imported as VIP.
  - An `"Amigo"` row with no customer blocks.
- **`"Regalo"`**: a gift. It is charged $0 and its grams still come out of stock. With shipping, the sale's total is the shipping alone, as in the sheet.
- **Special total** (`Precio especial (total)`): a whole number above $0 makes the line a special price with that total, whatever the type. An `"Amigo"` row with a special total still makes its customer VIP.
- **These block**:
  - a special total on a `"Regalo"` row;
  - a special-total cell that isn't a whole number above $0 (zero, negative or text).
- **What is stored**: always the app's recomputed price, rule and total. A difference from the sheet is reported and never blocks. To keep the sheet's figure, the operator puts it in the special-total cell and runs again.

### What blocks

A finished row blocks if the product's own rules would refuse it if it were recorded today. Examples:

- a variety with no price that day and no special total;
- grams that aren't above zero with at most two decimals;
- a future date;
- a total above $0 with no payment method;
- a purchase with no cost;
- a note, aroma, header or footer that is too long.

Also blocking:

- a required column that can't be found in Ventas, Entradas or Gastos;
- a filled-in Ventas row whose `Total` is empty (the file wasn't recalculated);
- an unknown variety name, or two Ajustes rows 7–16 that are the same name;
- two price entries for one variety on one date;
- an unknown origin or payment value;
- a category outside A21:A28;
- a bad Catálogo value or a bad threshold;
- a customer name missing from the mapping;
- a mapped number that doesn't normalise;
- "Pendiente" with no customer, or `"Amigo"` with no customer;
- `"Regalo"` with a special total;
- a special total that isn't a whole number above $0.

Rows the sheet marks unfinished are the one exception: they are left out and listed, and never block.

### Customers

- **Who becomes a customer**: every name on a finished Ventas row, whether or not they ever owed. Each one needs a number. A name that appears only on unfinished rows needs none and creates no customer.
- **A blank customer cell**: the row becomes a sale without a customer, which is allowed only when nothing stays owed.
- **Matching names to the mapping**: exact, after trimming and collapsing inner spaces, with no case-folding. Every unmatched name is listed at once.
- **Numbers**: each goes through customers.md's normalisation. A number that fails blocks, and the report never repeats it.
- **Several spellings, one number**: when the normalised numbers are the same, the spellings become one customer, and the report lists them together.
  - The customer is named after the spelling on their most recent finished Ventas row.
  - If those rows share a date, the lowest row in the sheet wins.
  - The seller can rename the customer afterwards.
- **Unused mapping entries**: an entry whose name is on no finished Ventas row creates no customer and is reported as unused.

### Order

- Within Entradas, and separately within Ventas, rows that share a date are recorded in sheet order, top to bottom. That order is their recording order, so it sets lot order (ADR-0010) and settlement (ADR-0012) on that date.
- Across dates, the date decides, so an unsorted sheet still lands right.
- Price-history and expense rows need no tie-break.

### Constraints

- **Isolation (ADR-0004)**: every created row carries the target business, and nothing is reachable from another business.
- **No echo (ADR-0005)**: no customer name, phone number or amount goes to logs. The report exists only on the operator's terminal.
- **Test data**: tests build their own small `.xlsx` and mapping fixtures, laid out like the real sheet (titles on row 1). The real sheet and real customer data never enter the repository.

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
  - a matrix of every blocking case passes 100%, including a missing column and a filled-in Ventas row with an empty Total;
  - Ventas rows with text in Total, and Entradas and Gastos rows with text in Revisar, are left out and listed with that text, without blocking;
  - a name, an `Amigo` or a spelling found only on unfinished rows creates no customer, no VIP and no kept name;
  - a reference set of total mismatches, with and without shipping and including a `Regalo` with shipping, is reported and never blocks;
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
- Importing rows the sheet marks unfinished, or anything they name.
- Inventing customers, phone numbers, categories or varieties to get an import through.
- Grouping several rows into one sale with several lines.
- Undoing an import once it is done.
