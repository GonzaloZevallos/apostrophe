# Sales

What a customer takes in one go, each line priced from the day's prices and that price kept on the line (ADR-0003). Sales are seen only by their business (ADR-0004). Reads current prices from varieties and customers (and their VIP status) from customers. Payments made later and balances (#4) build on it. Stock (`stock.md`) takes each line's grams out of its variety's lots and gives the line its cost of goods, which follows the lots and is never frozen (ADR-0009).

## Jobs

**When** I hand over an order (one or several varieties, maybe with shipping, paid on the spot or left owing), **I want** to record it in a few taps (varieties, grams, who took it, how they paid) with each line priced from that day's current prices and the price kept on the line, **so I** never price from memory, a later price change never rewrites what I charged, and nothing left owing is lost or lands on the wrong person.

Success criteria:

1. **Speed**: from the phone, a sale is recorded in under 60 s, from opening the form to saved. This holds with an existing customer, a new one, or none, and a sale without a customer is the fastest. It is one minute shared with customers.md's find-or-register budget, not a second minute on top.
2. **One order is one sale**: an order is one sale however many varieties it has, with shipping charged once. Its total is the sum of its lines plus shipping. Counts and averages count sales, not lines.
3. **Right price, kept**: each line is priced by the rules below, from the variety's current price on the sale's date, and stores its price per gram and pricing rule. Later changes never alter what an existing sale charged: price entries, a change to a customer's VIP status, a customer assigned afterwards, or any stock entry. A line whose variety has no price that day is refused, unless it has a special price.
4. **No limbo, no lost debt**: a sale with missing or invalid data is refused whole. A sale left owing always has a customer. Only a sale where nothing stays owed may have none. A customer can be added to it later, once, and never swapped for another.
5. **Businesses never mix** (ADR-0004): a sale references only its own business's customers and varieties. Another business's sale answers 404, and lists show none of it. The note never appears in error answers or logs (ADR-0005).

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

  Rules 3 to 5 use the variety's current price on the sale's date. A VIP customer whose variety has no bulk price that day pays the list price. A line both marked as a gift and given a special price is refused. A line without a special price, whose variety has no current price that day, is refused.
- **Line total**:
  - For list, bulk and VIP lines: grams × the stored price per gram, rounded to the nearest whole peso, with exactly half rounding up. For example, 1.55 g × $10 001 = $15 501.55 → $15 502, and $7 502.50 → $7 503.
  - A gift line is $0. A special price line is its typed total, so it needs no rounding.
  - A line total never changes once the sale is recorded.
- **Line cost of goods**: every line, gifts included, has a cost of goods from the lots its grams came out of, oldest first, computed by stock as the lots stand now (ADR-0009). Part or all of it may be pending cost. It is not frozen like the price, and a change to it never moves the line's price or total.
- **Total**: the sum of the rounded line totals plus shipping charged. Lines are rounded one by one, never as a sum.
- **Shipping charged**: whole pesos, zero or more, $0 by default. A negative value is refused.
- **How it was paid**:
  - **Paid in full on the spot, by cash or transfer.** This records a payment for the full total, on the sale's date, with its method, in a form #4 counts as money received without migration.
  - **Left owing**: no method, and the sale needs a customer.
  - **Total of $0**: settled with no method and nothing owed. A method sent with it is ignored and not stored.
  - A total above $0 needs a method or "left owing".
  - Partial payment on the spot does not exist.
- **Customer**:
  - Optional only when nothing stays owed.
  - It must belong to the same business; another business's customer is not found.
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
- **See one**: date, customer or none, shipping, note, how it was paid, total, and each line's variety, grams, stored price per gram, pricing rule, line total and cost of goods (costed amount and pending grams).
- **Delete**:
  - A hard delete, lines and on-the-spot payment included; nothing remains to list or restore.
  - Its grams return to stock, landing back on lots by date (ADR-0009). The answer says the grams returned per variety.
  - Wherever a screen offers the delete, its confirmation says the grams that return, e.g. "vuelven 4 g al stock".
  - #4 defines deletion's effect on later payments.
- **Refusals**: fixed messages that never repeat the input, the note, amounts or names (ADR-0005).
- **Isolation (ADR-0004)**:
  - The business comes from the session.
  - Every sales table carries `business_id`.
  - Another business's sale answers 404 for reading, assigning and deleting.
  - Lists show none of another business's sales.
  - The routes are in `tests/test_business_isolation.py`.

## Metrics

- **Pricing matrix**: each rule, the order they apply in, bulk per line, VIP without a bulk price, no price that day with and without a special price, and gift plus special refused. It also covers rounding: below .50, exactly .50 and above .50, and a multi-line sale whose total is the sum of the rounded lines. 100% passing. (Criterion 3)
- **Stored price immutability**: after a price entry is added or deleted, VIP is toggled, a customer is assigned, or a stock entry is added, edited or deleted, existing lines' price, rule and total are unchanged. 100% passing. (Criterion 3)
- **One sale per order**: a multi-variety sale is one sale, with total = rounded lines + shipping once. (Criterion 2)
- **Whole or nothing**: a refused sale leaves 0 new rows in sales, lines and payments. (Criterion 4)
- **Owing without a customer**: 0 stored; the domain refuses it and a test covers it. (Criterion 4)
- **Delete returns grams**: after deleting a sale, its varieties' stock rises by exactly its lines' grams, and the answer names them.
- **Isolation coverage**: every sales route is in the sweep and answers 404 or empty from another business, including references to another business's customer or variety. (Criterion 5)
- **No echo**: no refusal body or log line contains the note, a customer's name or a submitted amount. (Criterion 5)
- **Record time**: once the form exists, a sale is recorded from a phone in under 60 s with an existing, new or no customer. Recording answers in under 300 ms with a few dozen varieties and customers. (Criterion 1)

## Out of scope

- Later and partial payments, balances, owing since: #4.
- Refusing a sale for lack of stock: never (ADR-0009).
- Editing a sale: delete and record it again.
- Moving a sale between customers or removing its customer.
- Importing sales from the spreadsheet.
