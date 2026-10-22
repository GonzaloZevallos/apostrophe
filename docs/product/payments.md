# Payments

Money a customer hands over, and what each customer owes because of it: their balance, owing since and the account of their sales and payments. Seen only by its business (ADR-0004). Reads sales and their on-the-spot payments from sales (ADR-0007) and customers from customers. Cash (#7) counts payments on their own dates. Which sale a payment settles is worked out live and never stored, like cost of goods (ADR-0009, ADR-0010), while sale prices stay frozen (ADR-0003). Who owes is shown as the Owed to you section at the top of Customers and as Home's "Owed to you" block; there is no separate Owed to you screen.

## Jobs

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person.

This is the same "run my business from my phone" job as every other capability. It replaces the spreadsheet's single paid/pending column. Settling a debt overwrote that column, so there was no payment date and no partial payment.

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by "Collect" on every debtor row of Customers and Home, which opens Record payment with the customer chosen in at most 2 taps.)

**When** a customer pays me while I'm chatting with them on my phone, **I want** to open Record payment from their card or debtor row, record the payment and be back on that customer straight away, **so I** see their balance drop without losing my place. (GH-46 follow-up: on the phone Record payment is a sheet over the screen it was opened from, never a page of its own, and that screen keeps its scroll position.)

Success criteria:

1. **Fast from the phone**: a payment is recorded in under a minute, with the date already set to today. Record payment, with the customer chosen, opens in at most 2 taps from any tab root ("Collect" on Customers or Home). Paying everything owed takes one tap ("All").
2. **Partial payments just work, oldest debt first**: the seller never picks a sale. Every later payment settles the customer's oldest unpaid sale first, then the next. Before saving, the seller sees which sales it settles and what is still owed. After saving, they see what is still owed.
3. **The balance is always right**:
   - The balance equals what was bought and not paid, minus payments, to the peso.
   - Owing since is the date of the oldest sale not fully paid.
   - Both are right straight after any sale or payment is recorded or deleted, and never depend on the order things were typed in.
4. **Who owes, at a glance**: every customer who owes, oldest debt first, each with their balance and owing since, at the top of Customers. Also the total owed and the count of sales still owing, without working it out from sales. In Sales, a sale still owing is marked as such.
5. **A traceable account**:
   - Each customer's account shows their sales and payments in date order, with the running balance.
   - Each sale says how it was paid or that it was left owing.
   - Each payment says its date, its method and which sale it went to.
   - A mistaken payment can be deleted, and the account and balance follow at once.
6. **Payment dates are kept**: a payment keeps its own date and method, so Cash (#7) counts money on the day it came in, never on the sale's date.
7. **Businesses never mix, nothing leaks**: a payment belongs to one customer of its own business (ADR-0004). Another business's customer or payment is gone (404). No amount or name goes to an error, a log, the console or browser storage (ADR-0005).
8. **No curl, and the browser computes nothing**: everything is done from the phone. Every balance, owing since and settlement shown comes from the API.
9. **Never lose your place**: on the phone, Record payment opens as a sheet over the screen it was opened from (the customer's card, Customers or Home) and closes with "Close". Saving or closing lands the seller back on that screen, at the scroll position it had, with the balance already lower after a save. On the computer it is a modal. The product docs, the drawing and the built app agree on this.

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
- **Later payment**: recorded through Record payment. Later payments settle what the customer's sales left owing, oldest debt first.
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
  - the balance goes below zero and shows as "Credit $ X";
  - the credit applies automatically to the customer's next sales left owing;
  - it counts in no debt figure;
  - a credit that should not exist is fixed by deleting the mistaken payment;
  - the app records no refunds.

### Who owes and the totals

- **Sales still owing**: every sale of the business not fully paid once settlement is applied, partially paid ones included, each counted once. A sale covered by a credit is paid.
- **Total owed**: the sum of the balances above $0. Credits never subtract from it.

### On screen: the Customers' "Owed to you" section

- **Where**: the top section of Customers (customers.md), above everyone A–Z. It replaces the former Owed to you screen, which no longer exists; its old path redirects to Customers (navigation.md). Home's Owed to you heading opens Customers on this section (results.md).
- **Its head**: the total owed and the count of sales still owing.
  - The count reads "1 sale owing" for one sale still owing, and "N sales owing" for two or more (e.g. "4 sales owing"). This is the same singular and plural rule Home's "Owed to you" block uses for the same count (results.md).
- **Its rows**: only customers whose balance is above $0, by owing since (oldest first), ties by name.
  - Each row shows the balance in amber and "since dd/mm", never as a chip.
  - Each row carries **"Collect"** (accessible name "Collect from <name>"), which opens Record payment with that customer already chosen. Tapping the rest of the row opens the customer's card.
- **Nobody owes**: the section reads a fixed "Nobody owes you", with nothing to tap.
- **Customers' header** carries no tappable debt figure: the section itself is on screen.
- **Search**: while a query is typed, Customers collapses into one flat list by name (customers.md); a customer who owes keeps their balance, "owes you since dd/mm" and "Collect" there.
- **Customers in credit** never appear in the section and count in no figure. In everyone A–Z they show "Credit $ X" in the neutral/blue treatment, never green or amber.

### On screen: the customer's card (`ClienteFicha`)

- It shows "Owes you $ X since dd/mm". For a credit it shows "Credit $ X" with no "since". With a balance of $0 it shows neither.
- "Record payment" shows only when the balance is above $0. Otherwise it is hidden.
- The account lists sales and payments in date order, with the running balance:
  - a sale paid on the spot: "Paid in cash" or "Paid by transfer", with no payment row of its own;
  - a sale left owing: "Left owing";
  - a later payment: one row per sale it reaches, "Payment · <method> · On account of the sale of dd/mm", with the amount applied to that sale;
  - any part beyond every debt: "Credit".
- **Running balance below zero**: between a payment and a later-dated sale it settles, the running balance goes below zero and that row reads "Credit $ X".
  - It is the running figure only, not a credit, and counts in no figure.
  - The card's own balance reads "Credit" only when the balance today is below zero.
- **"Delete payment"** exists only on later payments.
  - It is confirmed with "Delete the $ 15.000 payment (transfer) from 20/09?", "No, keep it / Yes, delete it". The confirmation names the payment, never the sales it covered.
  - Then the toast "Payment deleted", with no data, and the account and balance refresh from the API.
  - A payment that is gone follows accounts.md's "That is gone." rule.

### On screen: Record payment (`Payment`)

- **Opened from**: "Collect" on a debtor row of Customers (either section, or search results) or of Home's "Owed to you" block, and "Record payment" on the customer's card. Each opens it with that customer already chosen.
- **A sheet on the phone, a modal on the computer** (navigation.md):
  - On the phone it is a sheet over the screen it was opened from (the customer's card, Customers or Home), never a page of its own. That screen stays underneath.
  - On the computer it is a modal over the same screen.
  - No bar and no "+ New sale". "Close", with a confirmation when leaving with something typed.
  - Saving or "Close" lands the seller back on the screen it was opened from.
- **Back where you were**: on closing, by "Close" or by saving, the screen underneath is at the scroll position it had when "Collect" or "Record payment" was tapped, on the phone and on the computer.
  - The refresh after saving updates rows in place and never resets the scroll.
  - Focus returns to the "Collect" (or "Record payment") that was tapped.
  - When the payment settles the whole balance and the customer's row leaves "Owed to you", the list stays at the same offset and the rows close up; nothing jumps to the top. Focus goes to the "Owed to you" heading, or to "Nobody owes you" when the section is now empty.
  - This holds for this flow only; scroll restoration elsewhere in the app is not part of payments.
- **The sheet**:
  - "All: $ X" fills the amount with the whole balance in one tap;
  - the date comes filled with today;
  - Cash · Transfer, required.
- **Before saving**, the API's preview shows which sales the payment settles ("Taken from the oldest debt") and "They still owe $ X" when something remains.
- **After saving**:
  - "Payment saved · still owing $ X" when something remains;
  - "Payment saved" when nothing does.

  This is the second deliberate exception to accounts.md's no-data toast rule. The screen it was opened from refreshes from the API, so the lower balance is already there when the sheet closes.
- **Refusals** show inline and keep everything typed:
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
- The screens registry carries no key for "modal on the computer"; no registry check tells a sheet from a page. The design capture and the e2e run are the evidence.

## Metrics

- **Record time (criterion 1)**: a payment is recorded through the front from a phone viewport in under 60 s. From Customers and from Home, Record payment opens with the customer chosen in at most 2 taps. "All" fills the whole balance in one tap.
- **Settlement matrix (criteria 2, 3)**: 100% passing. It covers:
  - oldest first;
  - a partial payment;
  - a payment spanning several sales;
  - a payment dated before the sale it settles;
  - an on-the-spot payment staying with its sale;
  - independence from recording order;
  - working out again after a late record or a delete of a sale or a payment.
- **Balance identity (criterion 3)**: balance = bought and unpaid − payments, to the peso, after every create and delete of sales and payments.
- **Credit**: after a settled sale is deleted, the credit is shown as "Credit", kept out of the Owed to you section, the total owed and the count, and applied to the next sale left owing.
- **Who-owes totals (criterion 4)**: the total owed, the count of sales still owing, the Customers' "Owed to you" section, Home's block and the Sales mark equal a direct computation over sales and payments. 0 differences. The count line reads "1 sale owing" for one sale and "N sales owing" for two or more, both covered by the front tests.
- **Account (criterion 5)**: the rows and running balance match the settlement for every case of the matrix.
- **Dates kept (criterion 6)**: after any recompute, every payment's date, amount and method are unchanged.
- **Preview = stored (criteria 2, 8)**: Record payment's preview matches the settlement after saving. 0 differences.
- **Isolation (criterion 7)**: every payment route is in the sweep and answers 404 or empty from another business.
- **No echo (criterion 7)**: no refusal or log line contains an amount or a name. After a full front run, the console and browser storage hold none of them.
- **No curl (criterion 8)**: an end-to-end run through the front alone:
  - records a payment from "Collect" on Customers and from "Collect" on Home;
  - settles everything with "All";
  - records a partial payment;
  - deletes a payment;
  - reads the Customers' "Owed to you" section and its count line.
- **Sheet on the phone (criterion 9)**: an end-to-end run at a phone viewport opens Record payment from "Collect" on Customers, "Collect" on Home and the card's "Record payment". It checks four things:
  - it is a sheet with the screen underneath still mounted, not a navigation;
  - "Close" returns to that same screen;
  - a save returns there with the balance read lower;
  - at a computer viewport, the same entry points open a modal.
- **Place kept (criterion 9)**: an end-to-end run scrolls Customers and Home so the tapped debtor row is below the first screenful, then opens Record payment and closes it, once by "Close" and once by a partial save. Each time the scroll offset is unchanged and focus is on the tapped "Collect". After a save that settles the whole balance, the offset is unchanged and focus is on the "Owed to you" heading (or "Nobody owes you").
- **Design agreement (criterion 9)**: the design capture of Record payment on the phone shows the drawing and the built app both as a sheet. The evidence note leaves no open difference.

## Out of scope

- Refunds.
- A note on a payment.
- Assigning a payment to a sale by hand.
- Deleting an on-the-spot payment on its own; editing a payment.
- A separate Owed to you screen.
- Record payment as a full page on the phone.
- A screens-registry key or check telling a sheet from a page.
- Scroll restoration anywhere other than closing Record payment.
- Cash and profit: the results capability (#7).
- Live updates between partners.
