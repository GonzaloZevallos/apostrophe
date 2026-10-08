# Import

The one-time load of a business's history from the spreadsheet `Control_de_ventas_y_gastos` (an `.xlsx` export) into that business. The installation's operator runs it on the day the business switches to the app. It is an operator script, not a route or a screen.

It writes:
- varieties and price history (varieties.md);
- catalog attributes, header and footer (catalog.md);
- stock entries (stock.md);
- expense categories and expenses (expenses.md);
- customers (customers.md);
- sales with their on-the-spot payments (sales.md);
- the pricing switches it needs (pricing-settings.md).

Every imported record is the same data, under the same rules, as if it had been entered by hand. Everything it writes belongs to the target business alone (ADR-0004).

## Jobs

**When** I switch my business from the spreadsheet to the app, **I want** what the sheet already holds (varieties and their price history, catalog setup, stock entries, expenses, and every sale with who still owes for it) loaded into my business once, on the day I stop using the sheet, **so I can** keep selling in the app from the next order with my real prices, stock and debts in place. I don't retype months of rows, and I don't lose track of who owes me.

**When** I register a customer (from Clientes, in the middle of a sale, or through the one-time spreadsheet import) and I don't have their phone number, **I want** to save them under their name anyway and add the number later if I ever get it, **so I can** record every sale and every debt against the person who actually owes it, without inventing a number or keeping that person outside the app. (Served here by the optional mapping file; defined in customers.md.)

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has, **so I can** charge every customer exactly what I mean to, without anyone's price changing by surprise. (Served here by switching on the rules the sheet uses; defined in pricing-settings.md.)

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
5. **A sheet with no phone numbers imports in full.** The run goes through with no mapping file or only part of one. The report says how many customers came in without a number and never repeats a number. A number the mapping does give is still checked, and a malformed one still blocks.
6. **The sheet's pricing keeps working.** A business whose sheet uses bulk prices or "Amigo" rows opens with those rules switched on, so its prices and its VIP customers' next sales come out as the sheet priced them.

## Behaviour

### Who runs it, and how

- **Who and when**: an operator script, like `scripts/invite-business.sh`. It runs once per business on switch day, after the business is opened through its new-business invitation and before the seller records anything.
- **Not an app feature**: it is neither a route nor a screen, and sits outside accounts.md's "no curl" criterion, as `invite-business.sh` does.
- **Which business**: the operator names the target business on the command line. An unknown business is refused and nothing is written.
- **Inputs**:
  - the `.xlsx` export;
  - optionally, a file mapping customer name → phone number. Leaving it out behaves exactly like giving an empty file;
  - a dry-run switch.

### Dry run and real run

- **Dry run**: runs every check and writes nothing, whatever the outcome. It lists every problem in one pass.
- **Real run**: loads everything or nothing. Any blocking problem leaves the business exactly as it was.
- **Mismatches**: both runs report every imported Ventas row whose sheet Total differs from the app's recomputed sale total, shipping included. The sheet's Total includes shipping, so the two are compared like for like. A mismatch never blocks.
- **The report**, the same for a dry run and a successful real run:
  - counts per kind of record: varieties, price entries, catalog attributes, stock entries, expense categories, expenses, customers, sales and payments;
  - the count of customers imported without a phone number;
  - which pricing switches the import turns on (Precio por cantidad, Clientes VIP), or that it turns none on;
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
  - the seeded catalog header and footer;
  - the pricing switches, whatever their state.
- The import overwrites the header and footer. It matches or adds categories, and never renames or removes one.

### Reading the file

- **Any export**: an `.xlsx` saved by Excel or exported by Google Sheets reads the same.
  - Titles on row 1 are found whatever size the file declares, including none.
  - Data rows are read to the last row with data, in Ventas, Entradas, Gastos and the Ajustes price history.
  - Fixed cells and ranges (Ajustes, Catálogo) are read at their address whatever size the file declares.
- **Numbers where a whole number or grams are expected**: how the cell stores a number never matters, only its value.
  - In a whole-number field (`% índica`, list and bulk price, `Costo total`, `Monto`, `Envío cobrado`, `Precio especial (total)`), a number with no fractional part is that whole number: `60.0` is 60. A fractional value is still refused by the owner's rule (`60.5` is not a share).
  - Grams, bulk minimums and low-stock thresholds keep their exact value to the hundredth (`3.5` is 3,5 g).
- **Numbers where text is expected**: a number in a text cell is read as its text, and then follows that field's rules like any text. This applies to the names of varieties, customers and categories, `Detalle`, `Nota`, `Aroma`, the header and footer, and the cells with a fixed set of values (`Origen`, `Pago`, `Tipo`, Catálogo's shown).
  - A whole number reads as its digits, with no decimals and no thousands separator: `100`, `2024`, `1000`.
  - A non-whole number reads with a decimal comma and the fewest decimals that give its exact value, with no thousands separator: `3,5`, `0,25`.
  - A number is never refused only for being a number where text is expected. A numeric value outside a fixed set (e.g. an `Origen` of `3`) still blocks as unknown.
- **Dates where text is expected**: a date in any of those text cells (e.g. a `Nota` typed as `12/10` that the sheet turned into a date) is never read as text, because the file no longer holds what was typed: the day and month may be swapped by the sheet's locale and a year was added.
  - It blocks, listed with its sheet and row, as a date where text is expected.
  - The problem tells the operator to re-type the cell as text in the sheet (in Google Sheets, starting it with an apostrophe) and run again.
  - The dry run lists every such cell in one pass.
  - Dates in date columns (`Fecha`, the effective date) are read as dates, as always.
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
  - a bulk price not below the list price blocks;
  - an entry with a bulk price also gets a VIP price equal to it, which reproduces the sheet's "Amigo" rule. The sheet has no VIP price column.
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

### Pricing settings

- **What the import switches on**:
  - **Precio por cantidad**, when any imported price entry has a bulk price;
  - **Clientes VIP**, when any customer is imported as VIP.
- **Never off**: the import never turns a switch off. A switch already on stays on.
- **Priced with the switches it will leave**: every row is priced as if the switches already stood as the import will leave them, so a new business's off switches never change how a sheet row is priced.

### Pricing rules

- **`""` or `"Lista"`**: list or bulk, by sales.md's lowest-price rule, from the imported price history on the row's date and the row's grams. Never VIP, even for a customer who is VIP elsewhere.
- **`"Amigo"`**: the VIP rule (sales.md), with the VIP price equal to that day's bulk price. The result is that day's bulk price, or the list price when that day has none, as in the sheet. A tie with the bulk price is stored as VIP.
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
- a date in a text cell (see Reading the file);
- an unknown variety name, or two Ajustes rows 7–16 that are the same name;
- two price entries for one variety on one date;
- an unknown origin or payment value;
- a category outside A21:A28;
- a bad Catálogo value or a bad threshold;
- a mapped number that doesn't normalise;
- "Pendiente" with no customer, or `"Amigo"` with no customer;
- `"Regalo"` with a special total;
- a special total that isn't a whole number above $0.

Rows the sheet marks unfinished are the one exception: they are left out and listed, and never block. A customer name missing from the mapping never blocks: that customer is imported without a number. How the file stores a cell never blocks on its own, with one exception: a date in a text cell, because what was typed can no longer be told.

### Customers

- **Who becomes a customer**: every name on a finished Ventas row, whether or not they ever owed. A name that appears only on unfinished rows creates no customer.
- **A blank customer cell**: the row becomes a sale without a customer, which is allowed only when nothing stays owed.
- **Matching names to the mapping**: exact, after trimming and collapsing inner spaces, with no case-folding.
- **A name with no mapping entry**, or every name when there is no mapping file, is imported without a phone number. It is not a problem and is not listed; the report counts the customers imported without a number.
- **Numbers**: each mapped number goes through customers.md's normalisation. A number that fails blocks, and the report never repeats it.
- **One customer per name**: finished Ventas rows whose customer cells are the same after trimming and collapsing inner spaces (exact, case kept) are one customer. An unmapped spelling that differs in any other way is a separate customer; nothing is merged by guess.
- **Several spellings, one number**: when mapped spellings normalise to the same number, they become one customer, and the report lists them together.
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
  - a dry run writes 0 rows in every table, whatever the outcome, and changes no switch;
  - a refused real run writes 0 rows and changes no switch;
  - the dry run lists every blocking problem of a fixture in one pass, every missing column included.
- **Any export (criteria 1, 3)**: a fixture laid out like a Google Sheets export, with no declared size in any worksheet and every number stored as a float, is read in full by the dry run. 100% passing. It holds:
  - whole numbers in `% índica`, prices, costs, amounts, shipping and a special total, all read as whole numbers;
  - decimal grams and a decimal threshold, read to the hundredth;
  - numbers in text cells (a Detalle, a Nota, a variety, customer and category name made of digits, one of them non-whole), read as `100`-style digits or with a decimal comma.

  Every column and every row is found, and none of these is reported as a problem. A `60.5` share is still refused.
- **Dates in text cells (criteria 1, 3)**: the same fixture with a date in a Nota, a Detalle and a name cell reports each one, with its sheet and row, as a date where text is expected, with the fix to re-type it as text. Nothing is read from them, and a real run over that file writes 0 rows. 100% passing.
- **Opens where the sheet left off (criterion 2)**: after importing a fixture, these equal its expected figures, with 0 unexplained differences:
  - each variety's current price;
  - the catalog text;
  - stock per variety, to the hundredth;
  - each customer's balance and owing since, to the peso.

  Ganancia and Caja are not compared with the sheet.
- **Recording order (criterion 2)**: a fixture with same-date entries and sales, in unsorted dates, gets its lot order and settlement from date first, then sheet order. 100% passing.
- **Pricing settings (criterion 6)**: 100% passing.
  - A fixture with bulk prices and "Amigo" rows ends with both switches on and VIP price = bulk price on every entry with a bulk price, and the report lists both switches.
  - A fixture with neither ends with both off.
  - A switch already on before the import stays on.
  - Every row's stored price, rule and total equal what the import stored before pricing settings existed, "Amigo" rows included.
- **Nothing invented (criterion 3)**:
  - a matrix of every blocking case passes 100%, including a missing column and a filled-in Ventas row with an empty Total;
  - Ventas rows with text in Total, and Entradas and Gastos rows with text in Revisar, are left out and listed with that text, without blocking;
  - a name, an `Amigo` or a spelling found only on unfinished rows creates no customer, no VIP and no kept name;
  - a reference set of total mismatches, with and without shipping and including a `Regalo` with shipping, is reported and never blocks;
  - merged categories, merged spellings and unused mapping entries all appear in the report.
- **One business, once (criterion 4)**:
  - an import into a business holding any one of the seven kinds of record is refused with 0 rows written, tested for each kind;
  - a business with only seeded, renamed or removed categories, the seeded header and footer, and either switch state is accepted;
  - imported rows are invisible from another business through the isolation sweep.
- **No phone numbers (criterion 5)**: 100% passing.
  - a fixture with no mapping file imports in full, every customer without a number;
  - a fixture with a partial mapping imports the unmapped names without a number and the mapped ones with theirs;
  - the report's count of customers without a number equals the customers stored with none, in the dry run and the real run;
  - a malformed mapped number still blocks;
  - unmapped names that are equal after trimming and collapsing spaces become one customer, and ones that differ otherwise stay separate.
- **No echo**: after a run over a fixture with names, numbers and amounts, no log line contains any of them, and the report never contains a phone number.

## Out of scope

- Importing into a business that already has records; running it again, resuming or merging.
- An import screen or route in the app.
- Importing derived columns, or reproducing the sheet's profit and cash.
- Importing rows the sheet marks unfinished, or anything they name.
- Inventing customers, phone numbers, categories or varieties to get an import through.
- Merging differently spelled customer names that have no mapped number.
- Reading back as text a date the sheet made out of what was typed into a text cell.
- Grouping several rows into one sale with several lines.
- Undoing an import once it is done.
- How a phone number stored as a number in the mapping is read (#54).
- A VIP price column in the sheet; turning a pricing switch off.
