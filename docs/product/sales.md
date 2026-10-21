# Sales

What a customer takes in one go, each line priced from the day's prices and the business's pricing settings, and that price kept on the line (ADR-0003). Sales are seen only by their business (ADR-0004). This capability reads:
- current prices from varieties;
- customers, with their VIP status, from customers;
- which pricing rules the business uses from pricing settings (pricing-settings.md).

Payments (`payments.md`) settle what a sale leaves owing and say whether each sale is still owing. Stock (`stock.md`) takes each line's grams out of its variety's lots and gives the line its cost of goods, which follows the lots and is never frozen (ADR-0009). This capability also covers the sales screens: New sale, Sales and a sale's detail, on the phone and on a computer. Where they sit is navigation.md.

## Jobs

**When** I hand over an order (one or several varieties, maybe with shipping, paid on the spot or left owing), **I want** to record it in a few taps (varieties, grams, who took it, how they paid) with each line priced from that day's current prices and the price kept on the line, **so I** never price from memory, a later price change never rewrites what I charged, and nothing left owing is lost or lands on the wrong person.

**When** a customer orders over Telegram or WhatsApp and I'm handing it over, **I want** to load the order on my phone in a few taps (varieties, grams, who takes it, how they paid) and watch each line's price, rule and total, and the sale's total, update as I type, **so I can** confirm the total to the customer in the chat, never price from memory, and never have to redo a sale after saving it.

**When** I'm handing over an order on my phone, mid-chat with the customer on Telegram or WhatsApp and often with one hand free, **I want** to fill in and save the sale with my thumb, with every field whole and readable, the total and "Save sale" always in reach, and the keyboard never hiding what I'm typing, **so I can** confirm the total in the chat and get back to the customer in under a minute, without zooming, mis-tapping, losing the order or redoing the sale. (This refines the two jobs above for the phone; it is not a new job.)

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has (a bulk price if I sell by quantity, and a VIP price I set per variety if I have VIP customers), **so I can** charge every customer exactly what I mean to without typing a special price by hand, without seeing fields that don't apply to me, and without anyone's price changing by surprise. (This refines the first job; it is not a new job. Defined in pricing-settings.md.)

**When** I want to check what I sold today, this week or this month, **I want** to see that period's sales with their total and count, **so I can** tell how it's going between orders and find a particular sale to fix.

**When** I check between orders what I sold today, this week or this month, **I want** to switch period and open a sale on my phone without mis-tapping and without a blank screen while it loads, **so I can** find the sale to fix and assign its customer or delete it in a few taps. (This refines the job above and criterion 11 for the phone; fixing a sale still means exactly those two things.)

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person. (Served here by the "owes you" mark in Sales; defined in `payments.md`.)

**When** I register a customer (from Customers, in the middle of a sale, or through the one-time spreadsheet import) and I don't have their phone number, **I want** to save them under their name anyway and add the number later if I ever get it, **so I can** record every sale and every debt against the person who actually owes it, without inventing a number or keeping that person outside the app. (Served here by Pick a customer's "New customer"; defined in `customers.md`.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by "+ New sale", one tap from every tab root.)

The protagonist of the phone jobs is the seller. The computer layouts (`NuevaVentaCompu`, `VentasCompu`) are the same jobs on a bigger screen. Before the phone redesign the seller recorded sales on the phone with friction (scrolling to find the save button, zooming to hit small controls, sometimes recording later from memory), with no fallback outside the app.

Success criteria, recording (API):

1. **Speed**: from the phone, a sale is recorded in under 60 s, from opening the form to saved.
   - This holds with an existing customer, a new one (with or without a phone number), or none, and a sale without a customer is the fastest.
   - It is one minute shared with customers.md's find-or-register budget, not a second minute on top.
2. **One order is one sale**: an order is one sale however many varieties it has, with shipping charged once. Its total is the sum of its lines plus shipping. Counts and averages count sales, not lines.
3. **Right price, kept**:
   - Each line is priced by the rules below, from the variety's current price on the sale's date and the business's pricing settings when it is saved. It stores its price per gram and pricing rule.
   - Later changes never alter what an existing sale charged: price entries, the pricing settings, a change to a customer's VIP status, a customer assigned afterwards, any stock entry, or any payment.
   - A line whose variety has no price that day is refused, unless it has a special price.
4. **No limbo, no lost debt**:
   - A sale with missing or invalid data is refused whole.
   - A sale left owing always has a customer. Only a sale where nothing stays owed may have none.
   - A customer can be added to it later, once, and never swapped for another.
5. **Businesses never mix** (ADR-0004): a sale references only its own business's customers and varieties. Another business's sale answers 404, and lists show none of it. The note never appears in error answers or logs (ADR-0005).

Success criteria, pricing rules (pricing-settings.md):

17. **Only the business's rules apply.** With a rule switched off, a sale is priced as if the rule did not exist, and New sale shows nothing about it. With both off, every line that is neither a gift nor a special price takes the list price.
18. **A VIP never pays more than a regular customer.** A VIP customer is charged the lowest of the rules that apply to the line. A variety with no VIP price charges a VIP like anyone else.
19. **Nobody's price moves by surprise.** After the migration, every existing VIP customer is charged exactly what they were charged before, for the same variety, day and grams.

Success criteria, on screen:

6. **What I see is what I get**: if prices and the pricing settings don't change between preview and save, every line's price per gram, rule and total, and the sale's total, match what the API stores, with 0 differences. After saving, the screen shows what the API answered, not the preview.
7. **No surprises at save time**:
   - Owing is disabled with "To leave it owing, pick a customer", and a line with no price that day shows "<variety> no tiene precio para esa fecha", both before saving.
   - Any other refusal comes back with its code, shows in Spanish on its field, and everything typed stays.
   - A refused sale never loses the order.
8. **One order is one sale on screen**: one form, one total and shipping charged once.
9. **Undo in one tap**: a sale saved by mistake is undone in one tap from the "Sale saved" notice, and nothing of it remains: no lines, no on-the-spot payment, and it is in no list.
10. **Glance between orders**: switching between Today, Week (Monday to Sunday) and Month, or picking Dates, answers fast enough to glance at in the middle of a chat.
11. **Find and fix**: any sale in the period can be found and opened. In its detail, a sale with no customer can be given one (once, never changed), and a wrong sale can be deleted. Fixing a sale means exactly these two things.

Success criteria, on the phone:

12. **Nothing clipped, save in reach**: at 320, 375 and 430 px wide and at 130 % text, nothing in New sale, Sales or a sale's detail overflows or is clipped. In New sale the total and "Save sale" are visible without scrolling, above the keyboard and the home indicator, and the last field can be scrolled fully into view.
13. **Thumb-sized, no zoom**: every control on these screens, dialog buttons included, is at least 44 px tall; every input is at least 16 px, the date included, so iOS never zooms on focus. Grams open a decimal keypad and pesos a numeric one, with `enterkeyhint` to move through a line.
14. **Never blank**: nothing on these screens that waits for the server shows a blank screen; the sale is still recorded in under 60 s (criterion 1).
15. **The order is never lost by accident**: the system back gesture asks "Discard the sale?" under exactly the same condition as "Close".
16. **Nothing else changes**: pricing, the preview, the flow, the texts and the computer layouts behave as defined here; existing sales and navigation tests pass without being edited to fit the phone layout.

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
- **Pricing**: computed when the sale is recorded, and stored on the line with its pricing rule (ADR-0003). It uses the variety's current price on the sale's date and the business's pricing settings at the moment of saving. The first step that applies wins:
  1. **Gift**: $0.
  2. **Special price**: the total typed for the line, in whole pesos and above $0.
  3. **Otherwise, the lowest price per gram** among the rules that apply to the line:
     - **List**: always applies.
     - **Bulk**: Precio por cantidad is on, the current price has a bulk price, and the line's grams are at or above the bulk minimum. The minimum is measured per line, never across lines.
     - **VIP**: Customers VIP is on, the customer is VIP at recording time, and the current price has a VIP price.
  - **Naming the rule**:
    - On a tie between VIP and bulk, the line is stored as VIP.
    - Otherwise the strictly lowest rule names the line.
    - A bulk price and a VIP price are always below list, so list applies only when neither of the others does.
  - **A VIP customer is priced like anyone else** when that day's price has no VIP price. A VIP price above the bulk price, on a line at or above the bulk minimum, gives the bulk price, stored as "bulk".
  - **With both switches off**, every line that is neither a gift nor a special price takes the list price.
  - **Refused**:
    - a line both marked as a gift and given a special price;
    - a line without a special price whose variety has no current price that day.
  - **Switches changed while a form is open**: a sale is priced by the switches in force when it is saved, as it is by the price entries in force. The save goes through with no refusal and no notice.
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

### On screen: New sale (`NuevaVenta`, `NuevaVentaCompu`)

- **Opening the form**:
  - from the fixed "+ New sale" button, on every tab root (navigation.md);
  - or from "New sale to <name>" on a customer's card, with that customer already chosen.
  - With no variety priced today, "+ New sale" stays visible and says in words what is missing (navigation.md).
- **A form** (navigation.md): no bar and no "+ New sale"; it closes with "Close".
- **Fields**:
  - the date: today by default, shown as "Today 02/10", never a later day;
  - the customer;
  - one or more lines. Each line has a variety, grams, "Gift", and "Special price" (the line's total);
  - shipping charged;
  - the note;
  - how it was paid: Cash · Transfer · Owing.
- **The sale's total** shows with the grams sold and the grams gifted.
- **Live preview**:
  - Each line shows its price per gram, its rule badge (lista, por cantidad, VIP, regalo, especial) and its total. The sale's total updates as the seller types.
  - It applies exactly the pricing, rounding and total rules above, with the business's pricing settings.
  - It shows only rules that can apply now: with a rule switched off, its badge never appears.
  - Prices and the pricing settings are loaded when the form opens and again when the date changes; a date change reprices every line from that day's current prices.
  - Prices are never re-checked live while the seller types.
- **Waiting for prices**: while the form waits for prices on opening, it shows the shared loading state (accounts.md, `Estados`). On a date change the form stays on screen with everything typed; each line's price, rule and total show the loading state, never a placeholder figure, until that day's prices arrive, then every line is repriced.
- **Regalo and Precio especial exclude each other**:
  - Choosing one clears and disables the other, and turning it off frees the other.
  - Precio especial doesn't accept $0.
  - The domain's gift-plus-special refusal stays as an unreachable backstop.
- **No price that day**: a line whose variety has no current price on the sale's date shows "<variety> no tiene precio para esa fecha". The name comes from the screen's own line.
- **Customer and payment stay in step**, whichever changes last:
  - Owing is available exactly when a customer is chosen. Otherwise it is disabled and shows "To leave it owing, pick a customer".
  - Removing the customer or choosing "No customer" while Owing is selected resets how it was paid to unselected. It never falls back to Cash on its own.
  - A $0 sale needs no method.
- **Saving**:
  - On success, the app opens the sale's detail as the API answered it, with the "Sale saved" notice.
  - A refusal shows on its field in Spanish and keeps everything typed.
  - A price deleted by a partner before saving: the save is refused, and the line shows the no-price message.
  - A price or the pricing settings changed before saving: the save goes through, and the detail shows what was stored.
  - A customer or variety not found when saving shows the generic line and keeps the form.
- **Leaving**:
  - "Close", or the system back gesture, after a line, a customer, shipping or a note has been entered asks "Discard the sale?", with "No, keep entering" and "Yes, discard it".
  - "No, keep entering" keeps the user on the form with everything intact; the next back gesture asks again.
  - An untouched form closes at once.
  - With a sheet open over the form (Pick a customer, or New customer inside it), back does exactly what that sheet's own "Close" does: it closes only the top sheet, and the form keeps everything typed. It never asks "Discard the sale?".
  - There are no drafts or autosave.
- **Elegir cliente** (`NuevaVentaCliente`):
  - A sheet over the sale.
  - It offers search by phone or part of the name, "No customer", and "New customer", which creates the customer and uses it. "New customer" is the same form as in Customers: only the name required; the phone optional; VIP only while Customers VIP is on (customers.md); no channel.
  - It shows a customer's VIP mark only while Customers VIP is on.
  - Its results show the shared loading state before their first answer.
  - Closing the sheet only returns to the form.
- **"Sale saved"** (`Estados`):
  - It carries **Deshacer** and no amount or name. It is announced like a toast and lasts a fixed few seconds.
  - Deshacer deletes the sale with no confirmation, then shows "Sale deleted · the grams go back to stock" and returns to Sales.
  - If the sale is already gone, Deshacer shows "That is gone. The list is up to date."
  - After the notice is gone, the way to undo is "Delete sale".

#### New sale on the phone

The phone layout only; `NuevaVentaCompu` keeps its own.

- **Full screen, three zones**: a fixed header, a scrolling body and a fixed footer.
- **Header**: fixed, never scrolls away; "Close" and the date. The date input is at least 16 px and at least 44 px tall.
- **Body**: scrolls between header and footer, in this order: the customer, the lines, shipping charged, the note, and how it was paid last. It scrolls so that how it was paid, and the "To leave it owing, pick a customer" line under it, come fully into view above the footer; that line has the screen's normal side margin.
- **Footer**: fixed within thumb reach, above the keyboard and the home indicator. It holds the sale's total, the grams sold and gifted on one compact line, and "Save sale". With the keyboard open it shrinks to the total and the button and stays visible. Its exact look is design's call.
- **A line**: one fixed layout on every phone width from 320 to 430 px and at 130 % text, never switched by measuring the screen. First row: the variety and the grams. Under it: "Gift", a toggle row at least 44 px tall, and "Special price". Below those: the line's price per gram, rule badge and total.
- **No field overflows or is clipped** at 320 px or at 130 % text.
- **Targets**: the payment options, "Add another variety" and the dialog buttons are at least 44 px tall; every input is at least 16 px.
- **Keypads**: grams `inputmode="decimal"`; pesos (shipping, Precio especial) `inputmode="numeric"`; a line's fields carry `enterkeyhint` so the keyboard's action key moves through them.

### On screen: Sales (`Sales`, `VentasCompu`)

- **A tab root** (navigation.md): the bar or sidebar and "+ New sale".
- **Periods**: Today · Week · Month · Dates, in Argentina time.
  - Week is the Monday-to-Sunday week containing today.
  - Month is the current calendar month.
  - Dates opens on the current month's first and last day. The start can't be set later than the end.
- **The period's total and count**:
  - the total is the sum of the sale totals shown, paid or not, shipping included;
  - the count is of sales, not lines;
  - the total is never presented as profit or cash.
- **Each sale** shows:
  - its date;
  - its customer, or "No customer" in grey;
  - a VIP badge, only while Customers VIP is on;
  - its varieties and grams;
  - its total. A sale still owing, partially paid ones included, shows its total in amber with "owes you" under it, as the API answers it.
- **The VIP badge shows the customer's current VIP status**, not how the sale was priced.
  - Each line's rule badge in the detail is the record of how it was priced.
  - A customer who stops being VIP loses the badge on past sales, while their lines still read "VIP". That is not a reprice (ADR-0003).
  - While Customers VIP is off, no row shows the badge, and the customers' marks stay stored (customers.md).
- **Loading**: before its first answer, the list shows the shared loading state, never a blank screen.
- **On the phone** (`VentasCompu` unchanged):
  - each period tab is at least 44 px tall;
  - at normal text the four tabs share one row equally; when they don't fit (e.g. at 320 px or 130 % text) they wrap into equal-width cells, two by two, each at least 44 px tall; never horizontal scrolling, never a shortened label;
  - the selected tab is marked by more than color;
  - Dates' two date inputs are at least 16 px and at least 44 px tall and never overflow at 320 px or 130 % text.

### On screen: Detalle de venta (`VentaDetalle`)

- **A detail** (navigation.md): the bar or sidebar and "‹ Sales", without "+ New sale".
- **Loading**: while the sale loads, it shows the shared loading state (accounts.md, `Estados`), never a blank page.
- **Shows**:
  - the total;
  - each line's variety, grams, price per gram, rule badge and line total;
  - shipping, the note, how it was paid, and the customer or "No customer".
- **Recorded rule badges** ("VIP", "bulk") always show what was recorded, whatever the pricing settings say today. They are history (ADR-0003).
- **Asignar cliente**:
  - It shows only when the sale has none, and opens Pick a customer without "No customer".
  - The system back gesture with its sheet open does what the sheet's own "Close" does: it closes only the sheet and asks nothing.
  - On success, the toast "Customer assigned".
  - If someone assigned one first, "This sale already has a customer." and the detail refreshes.
- **Borrar venta**:
  - On the phone it, and its confirmation's buttons, are at least 44 px tall.
  - It is confirmed with `Before deleting`, naming the date, the amount and the total grams of its lines that return to stock, gifts included. For example: "Delete the $ 11.000 sale from 02/10? 4 g go back to stock." The buttons are "No, keep it / Yes, delete it".
  - Then the toast "Sale deleted" and back to Sales.
  - The copy never mentions debt or credit; the customer's account shows the effect afterwards (`payments.md`).
- **A sale that is gone** follows accounts.md:
  - opening it shows "That is gone." with "Back to Sales";
  - assigning, deleting or undoing shows "That is gone. The list is up to date."
- No names, notes or amounts go to the console or browser storage, and no business id appears in a URL.

### Shared loading state

- On these screens it applies to the sale's detail, Sales' list before its first answer, New sale while it waits for prices (on opening and on a date change) and Pick a customer's results before their first answer.
- It carries no digit, currency symbol or placeholder figure (accounts.md, criterion 7).

## Metrics

- **Pricing matrix**: 100% passing. (Criteria 3, 17, 18) It covers:
  - both switches off, only bulk on, only VIP on, and both on;
  - gift and special price first, and the order of the steps;
  - the lowest-price rule below, at and above the bulk minimum;
  - the VIP-bulk tie stored as "VIP";
  - a VIP price above the bulk price, stored as "bulk" at the minimum;
  - a variety with no VIP price, for a VIP;
  - bulk measured per line;
  - no price that day, with and without a special price;
  - gift plus special refused;
  - rounding below .50, exactly .50 and above .50;
  - a multi-line sale whose total is the sum of the rounded lines.
- **Stored price immutability**: 100% passing. (Criterion 3) Existing lines' price, rule and total stay unchanged after:
  - a price entry is added or deleted, a VIP price included;
  - either pricing switch is changed;
  - VIP is toggled;
  - a customer is assigned;
  - a stock entry is added, edited or deleted;
  - a payment is recorded or deleted.
- **No surprise for existing VIPs (criterion 19)**: after the migration, for every existing VIP customer, a sale's price, rule and total equal what they were before, for the same variety, day and grams. 0 differences.
- **One sale per order**: a multi-variety sale is one sale, with total = rounded lines + shipping once, through the API and the form. (Criteria 2, 8)
- **Whole or nothing**: a refused sale leaves 0 new rows in sales, lines and payments. (Criterion 4)
- **Owing without a customer**: 0 stored; the domain refuses it and a test covers it. (Criterion 4)
- **Delete returns grams**: after deleting a sale, its varieties' stock rises by exactly its lines' grams, and the answer names them. Borrar venta's confirmation names the grams, and Deshacer's notice says they return.
- **Isolation coverage**: every sales route is in the sweep and answers 404 or empty from another business, including references to another business's customer or variety. On screen, another business's sale opened by id shows "That is gone." (Criterion 5)
- **No echo**: (Criterion 5)
  - no refusal body or log line contains the note, a customer's name or a submitted amount;
  - after a full front run, the console and browser storage hold none of them.
- **Record time**: the front run records a sale from a phone viewport with an existing, new (with or without a number) or no customer (`web/e2e/sales.spec.ts`, `web/e2e/ventasTelefono.spec.ts`), and the tap budget holds (`web/e2e/tapBudget.spec.ts`); its duration is not measured by any test. Recording answers in under 300 ms with a few dozen varieties and customers. (Criteria 1, 14)
- **Preview = stored**: (Criterion 6)
  - the front preview passes the same pricing matrix as the domain, for every combination of switches;
  - the end-to-end run compares the preview with the saved detail: 0 differences.
- **Switches on screen (criterion 17)**: front tests show, for each switch off, no badge or field of that rule in New sale, no VIP badge in Sales and no VIP mark in Pick a customer, while a sale's detail keeps its recorded badges.
- **Caught before save**: (Criterion 7)
  - Owing is disabled with no customer, and removing the customer resets the method;
  - a no-price line shows its message before saving;
  - a forced API refusal keeps every field typed;
  - every sales refusal has a code in `contract.json`, checked by `tests/test_refusal_codes.py`.
- **Undo leaves nothing**: after Deshacer, 0 rows remain for that sale in sales, lines and payments, and it is in no list. (Criterion 9)
- **Ventas**: (Criteria 10, 11)
  - each period's total and count equal the sum and number of the sales shown;
  - the week runs Monday to Sunday;
  - the "owes you" mark matches the API's settlement;
  - the list answers in under 300 ms with a few hundred sales: checked by `tests/sales/test_list_cost.py` through the query plan of the list statements (the indexes are searched, no table is scanned) and the statement count at 30 and 300 sales, never by time (docs/adr/0038).
- **Fixing**: the end-to-end run assigns a customer to a sale that had none (Asignar cliente then disappears) and deletes a sale through its confirmation. (Criterion 11)
- **No overflow on the phone (criterion 12)**: front tests at 320, 375 and 430 px and at 130 % text, for New sale, Sales and the sale's detail, show nothing clipped or overflowing horizontally, "Special price", shipping and Dates' inputs included; Sales' tabs covered on one row and wrapped two by two.
- **Save in reach (criterion 12)**: at those widths the footer's total and "Save sale" are visible on load; the header stays while the body scrolls; with a simulated keyboard the footer stays visible; the payment options and the Owing hint (with side margin) scroll fully above the footer.
- **Targets and inputs (criterion 13)**: every interactive element of the three screens, dialog buttons included, is at least 44 px tall; every input has a computed font size of at least 16 px; grams carry `inputmode="decimal"`, pesos `"numeric"`, and a line's fields `enterkeyhint`.
- **Never blank (criterion 14)**: front tests show the shared loading state on the detail, Sales' list, New sale's price wait (opening and date change) and Pick a customer's results, holding no digit, currency symbol or placeholder figure.
- **Date change**: a front test shows everything typed is kept, the lines show loading, then every line is repriced.
- **Back guard (criterion 15)**: front tests drive the system back gesture: it asks "Discard the sale?" under the Cerrar condition; "No, keep entering" keeps the form and the next back asks again; an untouched form closes at once; with Pick a customer, New customer or Asignar cliente open, back closes only the top sheet as its own "Close" does, the sale or detail underneath stays intact, and "Discard the sale?" never appears.
- **No regression (criterion 16)**: the existing sales and navigation tests pass without being edited; the pricing matrix and "preview = stored" stay at 0 differences; `NuevaVentaCompu` and `VentasCompu` are unchanged.

## Out of scope

- Later and partial payments, balances, owing since and credit: `payments.md`.
- Refusing a sale for lack of stock: never (ADR-0009).
- Editing a sale: delete and record it again.
- Moving a sale between customers or removing its customer.
- Drafts or autosave of a sale.
- Profit and cash in Sales: the results capability.
- Live updates between partners while a form or list is open.
- Importing sales from the spreadsheet.
- A measurement-driven switch between line layouts on the phone; horizontal scrolling or shortened labels for Sales' period tabs.
- Changes to the computer layouts as part of the phone redesign; English screen texts (#53); the bar and back rule (#59).
- Building New customer's unsaved-changes confirmation (customers.md): its own issue, with its own copy, for Customers and Pick a customer alike.
- Other VIP rules (a percent off list); price promotions by date.
- Refusing or warning a sale because the pricing settings changed mid-sale.
