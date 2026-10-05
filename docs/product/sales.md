# Sales

What a customer takes in one go, each line priced from the day's prices and that price kept on the line (ADR-0003). Sales are seen only by their business (ADR-0004). Reads current prices from varieties, and customers (with their VIP status) from customers. Payments (`payments.md`) settle what a sale leaves owing and say whether each sale is still owing. Stock (`stock.md`) takes each line's grams out of its variety's lots and gives the line its cost of goods, which follows the lots and is never frozen (ADR-0009). This capability also covers the sales screens: Nueva venta, Ventas and a sale's detail.

## Jobs

**When** I hand over an order (one or several varieties, maybe with shipping, paid on the spot or left owing), **I want** to record it in a few taps (varieties, grams, who took it, how they paid) with each line priced from that day's current prices and the price kept on the line, **so I** never price from memory, a later price change never rewrites what I charged, and nothing left owing is lost or lands on the wrong person.

**When** a customer orders over Telegram or WhatsApp and I'm handing it over, **I want** to load the order on my phone in a few taps (varieties, grams, who takes it, how they paid) and watch each line's price, rule and total, and the sale's total, update as I type, **so I can** confirm the total to the customer in the chat, never price from memory, and never have to redo a sale after saving it.

**When** I want to check what I sold today, this week or this month, **I want** to see that period's sales with their total and count, **so I can** tell how it's going between orders and find a particular sale to fix.

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person. (Served here by the "te debe" mark in Ventas; defined in `payments.md`.)

**When** I register a customer (from Clientes, in the middle of a sale, or through the one-time spreadsheet import) and I don't have their phone number, **I want** to save them under their name anyway and add the number later if I ever get it, **so I can** record every sale and every debt against the person who actually owes it, without inventing a number or keeping that person outside the app. (Served here by Elegir cliente's "Nuevo cliente"; defined in `customers.md`.)

Success criteria, recording (API):

1. **Speed**: from the phone, a sale is recorded in under 60 s, from opening the form to saved.
   - This holds with an existing customer, a new one (with or without a phone number), or none, and a sale without a customer is the fastest.
   - It is one minute shared with customers.md's find-or-register budget, not a second minute on top.
2. **One order is one sale**: an order is one sale however many varieties it has, with shipping charged once. Its total is the sum of its lines plus shipping. Counts and averages count sales, not lines.
3. **Right price, kept**:
   - Each line is priced by the rules below, from the variety's current price on the sale's date, and stores its price per gram and pricing rule.
   - Later changes never alter what an existing sale charged: price entries, a change to a customer's VIP status, a customer assigned afterwards, any stock entry, or any payment.
   - A line whose variety has no price that day is refused, unless it has a special price.
4. **No limbo, no lost debt**:
   - A sale with missing or invalid data is refused whole.
   - A sale left owing always has a customer. Only a sale where nothing stays owed may have none.
   - A customer can be added to it later, once, and never swapped for another.
5. **Businesses never mix** (ADR-0004): a sale references only its own business's customers and varieties. Another business's sale answers 404, and lists show none of it. The note never appears in error answers or logs (ADR-0005).

Success criteria, on screen:

6. **What I see is what I get**: if prices don't change between preview and save, every line's price per gram, rule and total, and the sale's total, match what the API stores, with 0 differences. After saving, the screen shows what the API answered, not the preview.
7. **No surprises at save time**:
   - Debiendo is disabled with "Para dejar debiendo elegí un cliente", and a line with no price that day shows "<variety> no tiene precio para esa fecha", both before saving.
   - Any other refusal comes back with its code, shows in Spanish on its field, and everything typed stays.
   - A refused sale never loses the order.
8. **One order is one sale on screen**: one form, one total and shipping charged once.
9. **Undo in one tap**: a sale saved by mistake is undone in one tap from the "Venta guardada" notice, and nothing of it remains: no lines, no on-the-spot payment, and it is in no list.
10. **Glance between orders**: switching between Hoy, Semana (Monday to Sunday) and Mes, or picking Fechas, answers fast enough to glance at in the middle of a chat.
11. **Find and fix**: any sale in the period can be found and opened. In its detail, a sale with no customer can be given one (once, never changed), and a wrong sale can be deleted. Fixing a sale means exactly these two things.

## Behaviour

- **Sale**:
  - It has a date, at most one customer, shipping charged, an optional note, how it was paid, and one or more lines.
  - A sale with no lines is refused.
- **Date**:
  - Defaults to today, the business day in Argentina time.
  - It cannot be later than today. Earlier dates are allowed.
- **Line**:
  - It has a variety of the same business and grams above zero, with at most two decimals, whatever its rule.
  - A line may optionally be marked as a gift or given a special price.
  - The same variety may appear in several lines of one sale, each priced on its own, with no merging or warning.
- **Stock**: recording a sale or gift is never refused because of stock (ADR-0009). Its grams leave its variety's stock, which may go negative.
- **Pricing**: computed when the sale is recorded and stored on the line with its pricing rule (ADR-0003). The first rule that applies wins:
  1. **Gift**: $0.
  2. **Special price**: the total typed for the line, in whole pesos and above $0.
  3. **VIP**: the customer is VIP at recording time, so the line takes the bulk price.
  4. **Bulk**: the line's grams are at or above the bulk minimum, so it takes the bulk price. The minimum is measured per line, never across lines.
  5. **List**: the list price.

  Rules 3 to 5 use the variety's current price on the sale's date.
  - A VIP customer whose variety has no bulk price that day pays the list price.
  - A line both marked as a gift and given a special price is refused.
  - A line without a special price, whose variety has no current price that day, is refused.
- **Line total**:
  - For list, bulk and VIP lines: grams × the stored price per gram, rounded to the nearest whole peso, with exactly half rounding up. For example, 1.55 g × $10 001 = $15 501.55 → $15 502, and $7 502.50 → $7 503.
  - A gift line is $0. A special price line is its typed total, so it needs no rounding.
  - A line total never changes once the sale is recorded.
- **Line cost of goods**:
  - Every line, gifts included, has a cost of goods from the lots its grams came out of, oldest first, computed by stock as the lots stand now (ADR-0009).
  - Part or all of it may be pending cost.
  - It is not frozen like the price, and a change to it never moves the line's price or total.
- **Total**: the sum of the rounded line totals plus shipping charged. Lines are rounded one by one, never as a sum.
- **Shipping charged**: whole pesos, zero or more, $0 by default. A negative value is refused.
- **How it was paid**:
  - **Paid in full on the spot, by cash or transfer.** This records an on-the-spot payment for the full total, on the sale's date, with its method (ADR-0007). It settles this sale alone (`payments.md`).
  - **Left owing**: no method, and the sale needs a customer. Later payments settle it oldest debt first (`payments.md`).
  - **Total of $0**: settled with no method and nothing owed. A method sent with it is ignored and not stored.
  - A total above $0 needs a method or "left owing".
  - Partial payment on the spot does not exist.
- **Customer**:
  - Optional only when nothing stays owed.
  - It must belong to the same business; another business's customer is not found.
  - A customer with or without a phone number is chosen the same way (customers.md).
- **Sale without a customer**: counts in every total and in no customer's history.
- **Assign a customer later**:
  - Only to a sale with none, and only a customer of the same business.
  - A sale that already has a customer is refused.
  - Stored lines are never repriced.
- **Note**:
  - Optional. It is trimmed and holds up to 200 characters; empty after trimming means none.
  - It is not unique and is never searched, logged or repeated in errors.
- **List**:
  - Filters by date range. Both ends are optional and inclusive; a missing end has no limit.
  - An inverted range is empty.
  - Order: newest date first, then most recently recorded first.
  - Each sale says whether it is still owing, worked out live by payments.
- **See one**: date, customer or none, shipping, note, how it was paid, total, and each line's variety, grams, stored price per gram, pricing rule, line total and cost of goods (costed amount and pending grams).
- **Delete**:
  - A hard delete, lines and on-the-spot payment included; nothing remains to list or restore.
  - Its grams return to stock, landing back on lots by date (ADR-0009). The answer says the grams returned per variety.
  - Later payments that had settled it apply to the customer's next oldest debt, or become a credit (`payments.md`).
- **Refusals** (ADR-0005, ADR-0008):
  - They are fixed messages that never repeat the input, the note, amounts or names.
  - Each one carries its own namespaced `code`, listed in `web/src/api/contract.json` and checked by `tests/test_refusal_codes.py`. The rules with a code:
    - missing lines;
    - invalid grams;
    - gift with a special price;
    - special price at or below $0;
    - no price that day;
    - negative shipping;
    - future date;
    - a total above $0 with no method and not left owing;
    - left owing without a customer;
    - note too long;
    - assigning to a sale that already has a customer;
    - another business's sale, customer or variety (gone).
- **Isolation (ADR-0004)**:
  - The business comes from the session.
  - Every sales table carries `business_id`.
  - Another business's sale answers 404 for reading, assigning and deleting.
  - Lists show none of another business's sales.
  - The routes are in `tests/test_business_isolation.py`.

### On screen: Nueva venta (`NuevaVenta`, `NuevaVentaCompu`)

- **Opening the form**:
  - from the fixed "Nueva venta" button;
  - or from "Nueva venta a <name>" on a customer's card, with that customer already chosen.
- **Fields**:
  - the date: today by default, shown as "Hoy 02/10", never a later day;
  - the customer;
  - one or more lines. Each line has a variety, grams, "Regalo", and "Precio especial" (the line's total);
  - shipping charged;
  - the note;
  - how it was paid: Efectivo · Transferencia · Debiendo.
- **The sale's total** shows with the grams sold and the grams gifted.
- **Live preview**:
  - Each line shows its price per gram, its rule badge (lista, por cantidad, VIP, regalo, especial) and its total. The sale's total updates as the seller types.
  - It applies exactly the pricing, rounding and total rules above.
  - Prices are loaded when the form opens and again when the date changes, which reprices every line from that day's current prices.
  - Prices are never re-checked live while the seller types.
- **Regalo and Precio especial exclude each other**:
  - Choosing one clears and disables the other, and turning it off frees the other.
  - Precio especial doesn't accept $0.
  - The domain's gift-plus-special refusal stays as an unreachable backstop.
- **No price that day**: a line whose variety has no current price on the sale's date shows "<variety> no tiene precio para esa fecha". The name comes from the screen's own line.
- **Customer and payment stay in step**, whichever changes last:
  - Debiendo is available exactly when a customer is chosen. Otherwise it is disabled and shows "Para dejar debiendo elegí un cliente".
  - Removing the customer or choosing "Sin cliente" while Debiendo is selected resets how it was paid to unselected. It never falls back to Efectivo on its own.
  - A $0 sale needs no method.
- **Saving**:
  - On success, the app opens the sale's detail as the API answered it, with the "Venta guardada" notice.
  - A refusal shows on its field in Spanish and keeps everything typed.
  - A price deleted by a partner before saving: the save is refused, and the line shows the no-price message.
  - A price changed before saving: the save goes through, and the detail shows what was stored.
  - A customer or variety not found when saving shows the generic line and keeps the form.
- **Leaving**:
  - Back or close after a line, a customer, shipping or a note has been entered asks "¿Descartás la venta?", with "No, seguí cargando" and "Sí, descartala".
  - An untouched form closes at once.
  - There are no drafts or autosave.
- **Elegir cliente** (`NuevaVentaCliente`):
  - A sheet over the sale. It offers search by phone or part of the name, "Sin cliente", and "Nuevo cliente" (the same form as in Clientes: only the name required; phone optional, plus channel and VIP), which creates the customer and uses it.
  - Closing the sheet only returns to the form.
- **"Venta guardada"** (`Estados`):
  - It carries **Deshacer** and no amount or name. It is announced like a toast and lasts a fixed few seconds.
  - Deshacer deletes the sale with no confirmation, then shows "Venta eliminada · los gramos vuelven al stock" and returns to Ventas.
  - If the sale is already gone, Deshacer shows "Eso ya no está. La lista ya está al día."
  - After the notice is gone, the way to undo is "Borrar venta".

### On screen: Ventas (`Ventas`, `VentasCompu`)

- **Periods**: Hoy · Semana · Mes · Fechas, in Argentina time.
  - Semana is the Monday-to-Sunday week containing today.
  - Mes is the current calendar month.
  - Fechas opens on the current month's first and last day. The start can't be set later than the end.
- **The period's total and count**:
  - the total is the sum of the sale totals shown, paid or not, shipping included;
  - the count is of sales, not lines;
  - the total is never presented as profit or cash.
- **Each sale** shows:
  - its date;
  - its customer, or "Sin cliente" in grey;
  - a VIP badge;
  - its varieties and grams;
  - its total. A sale still owing, partially paid ones included, shows its total in amber with "te debe" under it, as the API answers it.
- **The VIP badge shows the customer's current VIP status**, not how the sale was priced.
  - Each line's rule badge in the detail is the record of how it was priced.
  - A customer who stops being VIP loses the badge on past sales, while their lines still read "VIP". That is not a reprice (ADR-0003).

### On screen: Detalle de venta (`VentaDetalle`)

- **Shows**:
  - the total;
  - each line's variety, grams, price per gram, rule badge and line total;
  - shipping, the note, how it was paid, and the customer or "Sin cliente".
- **Asignar cliente**:
  - It shows only when the sale has none, and opens Elegir cliente without "Sin cliente".
  - On success, the toast "Cliente asignado".
  - If someone assigned one first, "Esta venta ya tiene cliente." and the detail refreshes.
- **Borrar venta**:
  - It is confirmed with `Antes de borrar`, naming the date, the amount and the total grams of its lines that return to stock, gifts included. For example: "¿Borrás la venta de $ 11.000 del 02/10? Vuelven 4 g al stock." The buttons are "No, dejala / Sí, borrala".
  - Then the toast "Venta eliminada" and back to Ventas.
  - The copy never mentions debt or credit; the customer's account shows the effect afterwards (`payments.md`).
- **A sale that is gone** follows accounts.md:
  - opening it shows "Eso ya no está." with "Volver a Ventas";
  - assigning, deleting or undoing shows "Eso ya no está. La lista ya está al día."
- No names, notes or amounts go to the console or browser storage, and no business id appears in a URL.

## Metrics

- **Pricing matrix**: 100% passing. (Criterion 3) It covers:
  - each rule and the order they apply in;
  - bulk measured per line;
  - VIP without a bulk price;
  - no price that day, with and without a special price;
  - gift plus special refused;
  - rounding below .50, exactly .50 and above .50;
  - a multi-line sale whose total is the sum of the rounded lines.
- **Stored price immutability**: 100% passing. (Criterion 3) Existing lines' price, rule and total stay unchanged after:
  - a price entry is added or deleted;
  - VIP is toggled;
  - a customer is assigned;
  - a stock entry is added, edited or deleted;
  - a payment is recorded or deleted.
- **One sale per order**: a multi-variety sale is one sale, with total = rounded lines + shipping once, through the API and the form. (Criteria 2, 8)
- **Whole or nothing**: a refused sale leaves 0 new rows in sales, lines and payments. (Criterion 4)
- **Owing without a customer**: 0 stored; the domain refuses it and a test covers it. (Criterion 4)
- **Delete returns grams**: after deleting a sale, its varieties' stock rises by exactly its lines' grams, and the answer names them. Borrar venta's confirmation names the grams, and Deshacer's notice says they return.
- **Isolation coverage**: every sales route is in the sweep and answers 404 or empty from another business, including references to another business's customer or variety. On screen, another business's sale opened by id shows "Eso ya no está." (Criterion 5)
- **No echo**: (Criterion 5)
  - no refusal body or log line contains the note, a customer's name or a submitted amount;
  - after a full front run, the console and browser storage hold none of them.
- **Record time**: a sale is recorded through the front, from a phone viewport, in under 60 s with an existing, new (with or without a number) or no customer. Recording answers in under 300 ms with a few dozen varieties and customers. (Criterion 1)
- **Preview = stored**: (Criterion 6)
  - the front preview passes the same pricing matrix as the domain;
  - the end-to-end run compares the preview with the saved detail: 0 differences.
- **Caught before save**: (Criterion 7)
  - Debiendo is disabled with no customer, and removing the customer resets the method;
  - a no-price line shows its message before saving;
  - a forced API refusal keeps every field typed;
  - every sales refusal has a code in `contract.json`, checked by `tests/test_refusal_codes.py`.
- **Undo leaves nothing**: after Deshacer, 0 rows remain for that sale in sales, lines and payments, and it is in no list. (Criterion 9)
- **Ventas**: (Criteria 10, 11)
  - each period's total and count equal the sum and number of the sales shown;
  - the week runs Monday to Sunday;
  - the "te debe" mark matches the API's settlement;
  - the list answers in under 300 ms with a few hundred sales.
- **Fixing**: the end-to-end run assigns a customer to a sale that had none (Asignar cliente then disappears) and deletes a sale through its confirmation. (Criterion 11)

## Out of scope

- Later and partial payments, balances, owing since and credit: `payments.md`.
- Refusing a sale for lack of stock: never (ADR-0009).
- Editing a sale: delete and record it again.
- Moving a sale between customers or removing its customer.
- Drafts or autosave of a sale.
- Profit and cash in Ventas: the results capability.
- Live updates between partners while a form or list is open.
- Importing sales from the spreadsheet.
