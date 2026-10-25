# Sale bill

The facts about one recorded sale that a seller may share with that sale's customer. They are worked out live from settlement when the sale's detail is read, and never stored or logged. A bill is facts only, with no text: the server sends a closed structure and the front works out the shareable text (ADR-0053). The sale and its lines are defined in `sales.md`. Settlement, payments and balances are defined in `payments.md`. GH-322 part 1 delivers the facts. Part 2 delivers the text, the unit wording, and the share and copy actions.

## Jobs

**When** I have handed over a sale, or a customer asks what they owe, **I want** to send them that sale's lines, total, how it was paid and where their account stands, taken from the sale I already recorded, **so I can** share it without retyping or miscalculating.

The main progress is that the customer sees exactly the figures the seller sees, so nobody argues about the amount. Speed comes second. Reminding debtors is not a job of its own: a bill may carry a balance owed, but the product sends no reminders, schedules nothing and writes no wording that presses for payment. Before this feature the seller copied the figures by hand into Telegram or WhatsApp, mostly for debtors and delivered orders. Customers also ask for a confirmation of a sale paid on the spot, so every sale gets a bill.

## Behaviour

`GET /sales/{sale_id}` answers a field `bill`. It holds a sale bill, or null. The sales list does not carry it.

### Live figures

- The payment state, the amount still owed and the balance are read when the detail is read. They come from the same single settlement pass (`OwingSales.settlement_of`) as the detail's "still owing".
- The balance is the customer's whole current account. It is never the balance on the sale's date.
- A sale owed last week and paid since reads "paid" today.
- Nothing in sales or in the front recomputes settlement.

### Contents

- **Business name:** always the current name of the session's business, so a rename shows on the next read.
- **Date:** the sale's own date.
- **Shipping charged:** apart from the lines.
- **Total:** the sale's total, shipping included.
- **Lines:** in recorded order. Each line has the variety's name, its quantity (to the hundredth, as recorded) and its amount.
  - A bulk line adds its unit price and the rule "bulk".
  - A gift line carries the rule "gift" and an amount of $0.
  - List, VIP and special lines carry only the amount, with no rule and no unit price.
  - An archived variety keeps its plain name.
- **Payment state:** the first check that fits wins.
  1. Total $0 (gifts only): none.
  2. Paid on the spot: cash or transfer, by the recorded method. If settlement also reports an amount still owed for it, the sale is inconsistent.
  3. No customer and none of the above: inconsistent.
  4. Something still owing: owed, with the amount still owed.
  5. Nothing owing (settled by a later payment or a credit): paid.
  6. A customer's sale above $0, not paid on the spot and missing from settlement: inconsistent.
- **Amount still owed:** present only when the state is owed.
- **Balance:**
  - None when the sale has no customer or the balance is exactly $0.
  - Otherwise signed. A credit is negative ("In your favor").
  - It also shows on cash, transfer and $0 sales when the customer owes from elsewhere or holds a credit.
- **Closed shape:** business name, date, shipping charged, total, lines (product, quantity, amount, rule, unit price), payment (state, amount still owed), balance. Nothing else can appear.

### Coverage

- Every sale gets a bill, whatever its age or state.
- A sale with no customer gets one when it was paid on the spot or is a $0 gift-only sale, and it never has a balance.
- A customer assigned later makes it an ordinary customer's sale, balance included.
- Another business's sale stays a 404.
- No setting and no cutoff date. Nothing depends on a business's units, currency or payment methods: the bill reports the method the sale recorded. Customizable payment methods belong to #330 and #318.

### When the facts disagree

- In the inconsistent cases (2, 3 and 6 above), `bill` is null.
- The rest of the detail answers 200 unchanged, with no error and no notice.
- A bill is never wrong or partial.
- The error names only the rule broken, never a sale, customer, amount or name. Nothing is logged.
- Part 2 simply does not offer share or copy for such a sale.

### What the bill never carries

The note, the customer's name or id, the sale id or any line id, the VIP flag, any pricing rule other than bulk or gift, cost, pending cost or margin, any link, or anything of another customer or business.

### Invariants

1. The payment state, still-owed amount and balance come from the one settlement pass, in the same response as the detail's "still owing".
2. The bill's shape is closed. The business comes from the session's current business only.
3. Failing to derive a bill makes it null and never fails the rest of the detail.
4. No fixed word of the bill is a literal outside the copy module. The unit is read from its one keyed copy entry (part 2).
5. A bill quantity is formatted from integer hundredths, never from a float.
6. The expected bill texts are written by hand against this definition, never generated by the renderer.
7. Nothing of the bill is stored, logged, or written to the console or browser storage. The share or copy call runs synchronously in the click handler (part 2).

### Out of scope

Reminders or wording that presses for payment, taking orders or messaging through a bot, invoices, taxes and accounting exports, and customizable payment methods.

## Success criteria and metrics

1. **Reach (judged across GH-322):** on the phone, from a recorded sale's detail, the share or copy step is reached in at most two taps.
2. **Same figures:** every figure on the bill equals what the sale detail and the customer's balance show in the same moment: total, payment state, amount still owed, and balance (a credit counts). Measured by:
   - every state-table row agreeing between the pure domain test and the API test with real settlement;
   - one settlement read per detail request, and none for a sale with no customer.

   If the facts disagree, there is no bill.
3. **Nothing internal:** the leak test (a sale with a note, a VIP customer, special and VIP lines, and pending cost) finds exactly the closed shape and no note, customer name or id, sale id, "vip", "special" or "list". Another business's sale stays a 404.
4. **Nothing kept:** nothing of the bill is stored or logged. A forced mismatch answers 200 with `bill` null and every other field unchanged.
