# Payments

Money a customer hands over, and what each customer owes because of it: their balance, owing since and the account of their sales and payments. Seen only by its business (ADR-0004). Reads sales and their on-the-spot payments from sales (ADR-0007) and customers from customers. Cash (#7) will count payments on their own dates. Which sale a payment settles is worked out live and never stored, like cost of goods (ADR-0009, ADR-0010), while sale prices stay frozen (ADR-0003).

## Jobs

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person.

This is the same "run my business from my phone" job as every other capability. It replaces the spreadsheet's single paid/pending column. Settling a debt overwrote that column, so there was no payment date and no partial payment.

Success criteria:

1. **Fast from the phone**: a payment is recorded from the customer's card in under a minute, with the date already set to today. Paying everything owed takes one tap ("Todo").
2. **Partial payments just work, oldest debt first**: the seller never picks a sale. Every later payment settles the customer's oldest unpaid sale first, then the next. Before saving, the seller sees which sales it settles and what is still owed. After saving, they see what is still owed.
3. **The balance is always right**:
   - The balance equals what was bought and not paid, minus payments, to the peso.
   - Owing since is the date of the oldest sale not fully paid.
   - Both are right straight after any sale or payment is recorded or deleted, and never depend on the order things were typed in.
4. **Who owes, at a glance**: every customer who owes, oldest debt first, each with their balance and owing since. Also the total owed and the count of sales still owing, without working it out from sales. In Ventas, a sale still owing is marked as such.
5. **A traceable account**:
   - Each customer's account shows their sales and payments in date order, with the running balance.
   - Each sale says how it was paid or that it was left owing.
   - Each payment says its date, its method and which sale it went to.
   - A mistaken payment can be deleted, and the account and balance follow at once.
6. **Payment dates are kept**: a payment keeps its own date and method, so Cash (#7) counts money on the day it came in, never on the sale's date.
7. **Businesses never mix, nothing leaks**: a payment belongs to one customer of its own business (ADR-0004). Another business's customer or payment is gone (404). No amount or name goes to an error, a log, the console or browser storage (ADR-0005).
8. **No curl, and the browser computes nothing**: everything is done from the phone. Every balance, owing since and settlement shown comes from the API.

## Behaviour

### Payment

- **Fields**: a customer of the same business, a date, an amount in whole pesos above $0, and a method (cash or transfer). There is no note.
- **Date**: defaults to today, the business day in Argentina time. Earlier days are allowed; a future date is refused.
- **Customer**: required. Another business's customer is gone (404).
- **Above the balance**: a payment above the customer's current balance is refused, so recording never creates a credit.
  - The current balance counts all the customer's sales, whatever the payment's date.
  - A customer whose balance is $0 or a credit cannot be given a payment.
- **No edit**: a payment cannot be edited. A mistaken one is deleted and recorded again.
- **Delete**: a hard delete, confirmed first. Only a later payment can be deleted this way.

### Settlement

- **On-the-spot payment**: the payment recorded with a sale paid in full (sales.md, ADR-0007).
  - It settles that sale and only that sale, in full. It never takes part in the oldest-first walk.
  - It is deleted with its sale and cannot be deleted on its own.
- **Later payment**: recorded through Registrar cobro. Later payments settle what the customer's sales left owing, oldest debt first.
  - Sales are taken by date, then by recording order.
  - Later payments are applied by date, then by recording order.
  - A payment that reaches past one sale goes on to the next.
  - **A payment's own date never limits what it settles.** A payment dated before the customer's oldest owed sale still settles that sale. Its date says when the money came in (criterion 6), not which debt it may pay.
- **Nothing about a settlement is stored.** Which sale a payment covers, the balance and owing since are worked out live from the customer's sales and payments as they stand now.
  - A sale or payment recorded late takes its place by its own date.
  - Deleting either one makes everything after it work out again.
- **Deleting a sale**: the later payments that had settled it apply to the customer's next oldest debt, or become a credit.
- **Deleting a payment**: whatever it settled is owed again.
- **What never moves**: a sale's stored prices, rules and line totals (ADR-0003, ADR-0007), and a payment's date, amount and method. Only which sale a payment is shown against can change.

### Credit

- Only deleting a sale that later payments had settled can leave money over. It stays visible and is never floored to $0:
  - the balance goes below zero and shows as "A favor $ X";
  - the credit applies automatically to the customer's next sales left owing;
  - it counts in no debt figure;
  - a credit that should not exist is fixed by deleting the mistaken payment;
  - the app records no refunds.

### Who owes and the totals

- **Sales still owing**: every sale of the business not fully paid once settlement is applied, partially paid ones included, each counted once. A sale covered by a credit is paid.
- **Total owed**: the sum of the balances above $0. Credits never subtract from it.

### On screen: Clientes and Te deben

- **Clientes** stays sorted by name (customers.md).
  - Its header reads "N clientes · M te deben $ X" (e.g. "6 clientes · 2 te deben $ 37.000"). With no debtors it shows no debt part, and there is nothing to tap.
  - A customer who owes shows the amount in amber with "te debe desde dd/mm" under it, never as a chip.
  - A customer in credit shows "A favor $ X" in the neutral/blue treatment, never green or amber.
- **Te deben** opens by tapping the header's debt part.
  - It lists only customers whose balance is above $0, by owing since (oldest first), ties by name.
  - Each row shows the balance and "desde dd/mm", and opens the customer's card.
  - The total owed and the count of sales still owing head the view.
  - No search, no new tab and no entry in Más.

### On screen: the customer's card (`ClienteFicha`)

- It shows "Te debe $ X desde dd/mm". For a credit it shows "A favor $ X" with no "desde". With a balance of $0 it shows neither.
- "Registrar cobro" shows only when the balance is above $0. Otherwise it is hidden.
- The account lists sales and payments in date order, with the running balance:
  - a sale paid on the spot: "Pagada por efectivo" or "Pagada por transferencia", with no payment row of its own;
  - a sale left owing: "Quedó debiendo";
  - a later payment: one row per sale it reaches, "Cobro · <método> · A cuenta de la venta del dd/mm", with the amount applied to that sale;
  - any part beyond every debt: "A favor".
- **Running balance below zero**: between a payment and a later-dated sale it settles, the running balance goes below zero and that row reads "A favor $ X".
  - It is the running figure only, not a credit, and counts in no figure.
  - The card's own balance reads "A favor" only when the balance today is below zero.
- **"Borrar cobro"** exists only on later payments.
  - It is confirmed with "¿Borrás el cobro de $ 15.000 (transferencia) del 20/09?", "No, dejalo / Sí, borralo". The confirmation names the payment, never the sales it covered.
  - Then the toast "Cobro eliminado", with no data, and the account and balance refresh from the API.
  - A payment that is gone follows accounts.md's "Eso ya no está." rule.

### On screen: Registrar cobro (`Cobro`)

- **The sheet**:
  - "Todo: $ X" fills the amount with the whole balance in one tap;
  - the date comes filled with today;
  - Efectivo · Transferencia, required.
- **Before saving**, the API's preview shows which sales the payment settles ("Se descuenta de la deuda más vieja") and "Le queda debiendo $ X" when something remains.
- **After saving**:
  - "Cobro guardado · queda debiendo $ X" when something remains;
  - "Cobro guardado" when nothing does.

  This is the second deliberate exception to accounts.md's no-data toast rule.
- **Refusals** show inline in Spanish and keep everything typed:
  - above the balance;
  - future date;
  - amount at or below $0;
  - missing method.

### Constraints

- `payment` is ADR-0007's table and carries `business_id`. The business comes from the session.
- Payment routes join the isolation sweep, the gated-route test and the ownership migration test.
- Refusal codes go in `contract.json` (ADR-0008):
  - above the balance;
  - future date;
  - amount at or below $0;
  - missing method;
  - deleting an on-the-spot payment;
  - customer gone;
  - payment gone.
- No amount or name in refusals, logs, the console or browser storage (ADR-0005).
- Every balance, owing since, settlement split, total and count on screen is read from the API.

## Metrics

- **Record time (criterion 1)**: a payment is recorded through the front from a phone viewport in under 60 s. "Todo" fills the whole balance in one tap.
- **Settlement matrix (criteria 2, 3)**: 100% passing. It covers:
  - oldest first;
  - a partial payment;
  - a payment spanning several sales;
  - a payment dated before the sale it settles;
  - an on-the-spot payment staying with its sale;
  - independence from recording order;
  - working out again after a late record or a delete of a sale or a payment.
- **Balance identity (criterion 3)**: balance = bought and unpaid − payments, to the peso, after every create and delete of sales and payments.
- **Credit**: after a settled sale is deleted, the credit is shown as "A favor", kept out of the header count, "Te deben", the total owed and the count, and applied to the next sale left owing.
- **Who-owes totals (criterion 4)**: the total owed, the count of sales still owing, the Clientes header and the Ventas mark equal a direct computation over sales and payments. 0 differences.
- **Account (criterion 5)**: the rows and running balance match the settlement for every case of the matrix.
- **Dates kept (criterion 6)**: after any recompute, every payment's date, amount and method are unchanged.
- **Preview = stored (criteria 2, 8)**: Registrar cobro's preview matches the settlement after saving. 0 differences.
- **Isolation (criterion 7)**: every payment route is in the sweep and answers 404 or empty from another business.
- **No echo (criterion 7)**: no refusal or log line contains an amount or a name. After a full front run, the console and browser storage hold none of them.
- **No curl (criterion 8)**: an end-to-end run through the front alone:
  - records a payment;
  - settles everything with "Todo";
  - records a partial payment;
  - deletes a payment;
  - opens "Te deben".

## Out of scope

- Refunds.
- A note on a payment.
- Assigning a payment to a sale by hand.
- Deleting an on-the-spot payment on its own; editing a payment.
- Search in "Te deben".
- Cash and profit: the results capability (#7).
- Live updates between partners.
