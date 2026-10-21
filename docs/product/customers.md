# Customers

The people a business sells to, each identified within that business by their own record, and seen only by that business (ADR-0004). The name is how a user recognises a customer; the phone number is optional contact data.

Sales and payments build on this capability: every sale and every debt belongs to one customer here. A VIP customer pays a variety's VIP price when it has one and it is lower than what any other rule gives. This applies only in a business with Customers VIP switched on (pricing-settings.md, sales.md).

A customer's balance, owing since and account are defined in `payments.md` and shown on their card and in the Customers' "Owed to you" section.

## Jobs

**When** I hand over an order or take a payment, **I want** to find the customer by part of their name or number, or register them on the spot if they're new, **so that** every sale and every debt lands on one real person and I always know who owes me.

**When** I register a customer (from Customers, in the middle of a sale, or through the one-time spreadsheet import) and I don't have their phone number, **I want** to save them under their name anyway and add the number later if I ever get it, **so I can** record every sale and every debt against the person who actually owes it, without inventing a number or keeping that person outside the app.

VIP and fixing a customer's details serve the same jobs. In a business with VIP customers, a customer marked VIP once is charged their VIP price on every sale where it is the lowest, so the seller never has to remember who is a friend.

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has (a bulk price if I sell by quantity, and a VIP price I set per variety if I have VIP customers), **so I can** charge every customer exactly what I mean to without typing a special price by hand, without seeing fields that don't apply to me, and without anyone's price changing by surprise. (Served here by the VIP mark following Customers VIP; defined in pricing-settings.md.)

**When** I run my business from my phone, **I want to** keep my customers up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive.

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person. (Served here by the Customers' "Owed to you" section and its "Collect", and by the card's balance, account and Record payment; defined in `payments.md`.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by Customers opening on who owes, with "Collect" on every debtor row.)

**When** a customer pays me part or all of what they owe, or between orders I want to know who still owes me and since when, **I want** Customers to open on who owes me (the total, and each debtor oldest debt first with their balance and since when) and to collect from any of them in one tap, **so I can** keep every balance right and chase the oldest debts first, without opening cards one by one, doing arithmetic or filling in fields I never use.

This refines the payments job and the navigation job above for Customers (GH-46); it is not a new job. Its protagonist is the seller, on the phone; the computer, with two panes, is the same job on a bigger screen. It has two moments: collecting (the main one: a customer hands over money, mid-chat or at handover) and checking (between orders or at the end of the day). Before it, who owes lived on a separate Owed to you screen, collecting a debt took four taps from Customers, and the customer form asked for a channel (Telegram or WhatsApp) that nothing in the product used.

Success criteria:

1. From the phone, a seller finds an existing customer by part of the name or part of the number, or registers a new one with or without a number, fast enough that a sale with a new customer still takes under a minute.
2. One phone number is at most one customer in a business, however it is typed. Registering it again, or changing a customer's number to one already in use, is refused. The refusal says the number already belongs to a customer and never repeats the number or the name. Two customers without a number never collide.
3. A business's customers are visible only to that business. By id from another business they answer 404. Lists and searches from another business show none of them. The same number can be a customer in two businesses without either business knowing.
4. Everything here is done from the phone, with no API call by hand.
5. **A customer without a number is a normal customer, not a degraded one.**
   - They can be registered, edited, found by name, chosen for a sale, left owing, paid and listed in the Customers' "Owed to you" section like anyone else.
   - The card and the list show no empty label, no dash and no "No phone" where a number would go.
6. **Nothing regresses for customers who have a number.**
   - Normalisation, the malformed-number refusal, uniqueness (on registering and on editing), search by number and refusals that never echo the number or the name all stay as they are.
   - A number can be removed from a customer, and their sales, payments and balance stay with them.
7. **No channel.** A customer has no channel (Telegram or WhatsApp): not in the API, the forms, the card, the list, the export or the database. Removing it changes nothing else about any customer.
8. **VIP follows the switch and is never lost.**
   - While Customers VIP is off, no VIP mark or field shows on any customer screen.
   - Switched back on, every stored VIP mark is back as it was, including for customers edited while it was off.
9. **Collect fast.** Record payment opens with the customer chosen in at most 2 taps from any tab root ("Collect" on a Customers row or an Home row). A payment is recorded in under a minute, and "All" settles the whole balance in one tap. On a computer it takes no more taps than on the phone.
10. **Who owes, at a glance.** Customers opens on "Owed to you": the total owed, the count line ("1 sale owing" or "N sales owing") and every debtor oldest owing-since first, each with balance and "since dd/mm". Everyone A–Z sits below. Every figure comes from the API and equals Home's "Owed to you" block and a direct computation. No scrolling through the A–Z list and no sums.
11. **The card closes the loop.** From a customer's card the seller sees their balance and account, "Record payment" (when they owe) and "New sale to <name>", with that customer already chosen.

## Behaviour

- **Customer**: a name, an optional phone number and VIP. A customer is identified by their own record (their id), never by their number. Their balance and owing since are worked out from their sales and payments (`payments.md`) and never stored on the customer.
- **Name**: required. Trimmed, with inner spaces collapsed, up to 60 characters. Not unique.
- **No channel**: the former channel (Telegram or WhatsApp) is removed from the domain, the API, the forms, the card, the list, the export and the database.
  - A request that still sends one succeeds: the channel is ignored, never stored, and no answer carries it. The seller sees no difference, because no form offers the field.
  - **The stored values are dropped for good.** The migration that drops the column keeps no copy anywhere; the product cannot bring them back, and the drop cannot be undone from inside it.
  - **Assumption**: no seller will need the old channel values back; anyone who does can still find the customer by name or number.
- **VIP**: yes or no, `false` by default. It can be edited.
  - A change applies to sales recorded from then on; sales already recorded keep their stored prices (ADR-0003).
  - In the Sales list, a sale's VIP badge shows the customer's current status, not how that sale was priced (sales.md).
  - It counts only while Customers VIP is on (pricing-settings.md). How a VIP's line is priced is sales.md's.
  - **While Customers VIP is off**:
    - the mark stays stored;
    - saving a customer never changes it, whatever the request sends;
    - a customer created then is not VIP.
- **Phone number**: optional, unique within the business among customers who have one, stored in one international form.
  - **None**: a missing value, `null`, or one blank after trimming means the customer has no number. It is stored as no number, never as an empty string.
  - **With `+` and a country code other than 54**: a foreign number. It is stored as `+` and its digits, and must be 8 to 15 digits long.
  - **With `+54`, or a bare `54`**: if it is followed by 10 digits, or by `9` and 10 digits, it is an Argentine number with its country code. It is stored as `+549` and the 10 digits.
  - **Anything else without `+`**: a local Argentine number. A leading `0` and the `15` are dropped, and exactly 10 digits, area code included, must remain. It is stored as `+549` and those 10 digits.
  - **Landlines** are not refused: every Argentine number is treated as a mobile.
  - **Refused**: a non-blank value that fits none of these rules, such as too short, too long, or without an area code. The refusal reads like "that doesn't look like a phone number with its area code" and never repeats what was typed.
  - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` and `541123456789` all become `+5491123456789`.
- **Uniqueness**: a number already used by another customer of the same business is refused, both on register and on edit. The refusal never repeats the number or the name. Any number of customers may have no number. Numbers in other businesses never collide and are never revealed.
- **Edit**: name, phone number and VIP (VIP only while Customers VIP is on).
  - The phone number goes through the same normalisation, uniqueness check and refusal as when registering.
  - It can be cleared, leaving the customer with no number.
  - Sales, payments and balance belong to the customer, not to the number, so they stay attached when it changes or is removed.
- **List and search**: one query.
  - The name matches the query anywhere, ignoring case and accents.
  - The number matches the digits of the query, with a leading 0 dropped, anywhere in the stored number's digits. A customer without a number never matches by number, and a query with no digits matches no number.
  - A customer matches if either the name or the number matches; a customer without a number is found by name.
  - An empty query returns every customer.
  - Results are sorted by name.
  - There is no paging, no minimum query length, no VIP filter and no filter for customers without a number.
- **Storage**: the phone column is nullable; uniqueness within a business applies only to stored numbers. Customers who existed before the number became optional kept their numbers. The channel column is dropped by a migration in the single Alembic chain; every other column and every customer's name, number, VIP, sales, payments and balance stay exactly as they were.
- **Business export** (accounts.md, ADR-0015): it follows the schema, so new exports and the removal's table and column registry carry no channel. Exports written before the change keep what they held; nothing imports an export back. Exported counts still equal deleted counts.
- **Isolation (ADR-0004)**:
  - The business comes from the session.
  - Another business's customer answers 404 for both reading and editing.
  - Lists and searches show none of another business's customers.
  - The customer routes are in `tests/test_business_isolation.py`.

### On screen (Customers)

- **Clientes** is a tab root (navigation.md). On a computer it is two panes: the list on the left, the selected customer's card on the right. Customers selects nothing on its own.
- **The screen opens with two sections**, with no tappable debt figure in its header:
  1. **"Owed to you"**, on top: the total owed, the count line ("1 sale owing" or "N sales owing"), and every customer whose balance is above $0, oldest owing-since first, ties by name, each row with "Collect" (`payments.md`). With nobody owing it reads a fixed "Nobody owes you", with nothing to tap, above the full A–Z list.
  2. **Everyone, A–Z**, below, sorted by name.
- Every figure of Owed to you comes from the API and equals Home's "Owed to you" block; the browser computes nothing.
- **Every row of a customer who owes**, in either section and in search results, shows the amount in amber with "owes you since dd/mm" under it, never as a chip, and a "Collect" button (accessible name "Collect from <name>") that opens Record payment with that customer already chosen, as an entry in the app's history; back or "Close" leaves it in one move. Tapping the rest of the row opens the customer's card.
- **A customer in credit** never appears in Owed to you and counts in no figure. In everyone A–Z they show "Credit $ X" in the neutral/blue treatment, never green or amber.
- **A customer with a $0 balance** shows nothing about money.
- **A customer without a number** shows nothing in the number's place: no dash, no empty label, no "No phone".
- **The VIP mark** shows on the list and the card only while Customers VIP is on. While it is off, nothing shows in its place.
- **Search** by part of the name or of the phone number: while a query is typed, both sections collapse into one flat list sorted by name, matched as above; a customer who owes keeps their balance, "owes you since dd/mm" and "Collect". Clearing the query brings the two sections back.
- **A customer's card** (`ClienteFicha`), a card with "‹ Customers":
  - phone (only when there is one; with none, the line is left out entirely) and VIP (only while Customers VIP is on);
  - "Owes you $ X since dd/mm" or "Credit $ X" (neither for a $0 balance), the account, "Record payment" only when the balance is above $0, and "Delete payment" on later payments (`payments.md`);
  - **"New sale to <name>"**, which opens New sale with that customer already chosen (sales.md). The card shows no "+ New sale".
  - Adding a number later is the card's ordinary edit; there is no prompt to fill it in.
- **Registrar cobro** (`Payment`) follows payments.md unchanged and its design, `Cobro.dc.html`, opened with the customer chosen from a debtor row or from the card.
- **Add and edit**: the one "New customer" form of `NuevaVentaCliente`, the same from Customers and from "Pick a customer" in New sale.
  - Its fields are "Name" (the only one marked required), the phone (optional, and it can be cleared when editing) and VIP. VIP shows only while Customers VIP is on. There is no channel field.
  - The same form registers a customer from inside a sale, through the "Pick a customer" sheet, and that customer is used for the sale.
  - It is a form: "Close", and a confirmation when leaving with unsaved changes.
- **On success**, the toast "Customer saved". It never carries a name or a number.
- **Refusals** show inline on the field, with the domain's fixed string, and keep what was typed. They never repeat the number or the name.
- **Design**: Customers, `ClienteFicha`, `Payment` and `NuevaVentaCliente` match `docs/product/design-system/pantallas/` on phone and computer, in both themes. Where the design's wording differs from the docs, the docs win and the difference is listed in the PR. No state is told by colour alone.
- **Feedback**: no network shows "No connection", a server error the generic retry, and a customer that is gone follows accounts.md's "That is gone." rule.

## Metrics

- **Duplicate numbers**: customers sharing one stored number within a business, 0. A database constraint enforces it and a test covers it. (Criterion 2)
- **No collision without a number**: two or more customers with no number coexist in a business, tested. (Criteria 2, 5)
- **Normalisation matrix**: every equivalent form resolves to one number, every invalid non-blank form is refused, and a blank value is stored as no number. 100% passing. (Criteria 2, 6)
- **No echo**: no refusal body or toast contains the submitted number, any of its digit runs, or a customer's name. After a full front run, the console and browser storage hold no name, number or amount. (Criteria 2, 6)
- **Isolation coverage**: every customer route sits in the isolation sweep and the gated-route test, and answers 404 or empty from another business. (Criterion 3)
- **Find-or-register time**:
  - registering a new customer from the phone is run through the front (`web/e2e/customers.spec.ts`) and the tap budget holds (`web/e2e/tapBudget.spec.ts`); its duration is not measured by any test;
  - a search answers in under 300 ms with a few dozen customers;
  - a sale with a new customer, registered from "Pick a customer" with or without a number, is recorded by the same front run (`web/e2e/customers.spec.ts`); its duration is not measured by any test.

  (Criterion 1)
- **No-number lifecycle**: through the API and the end-to-end front run, a customer without a number is registered, edited, found by name, chosen for a sale left owing, paid and shown in the Customers' "Owed to you" section. 100% passing. (Criterion 5)
- **No placeholder**: front tests show no phone line, no dash, no empty label and no "No phone" on the card and the list for a customer without a number. (Criterion 5)
- **Number removed**: clearing a customer's number keeps their sales, payments and balance unchanged, tested. (Criterion 6)
- **Migration**: every customer's number is unchanged after the migration that made it optional, tested. (Criterion 6)
- **No channel (criterion 7)**:
  - after the migration that drops it, no customer answer, form, card, list or export carries a channel;
  - every customer's name, number, VIP, sales, payments and balance are unchanged before and after it: 0 differences, tested on the single Alembic chain;
  - a request that still sends a channel succeeds and stores nothing;
  - channel fields on screen and in the API go from 1 to 0 (the business measure of "one field less");
  - the business-removal suite passes after the migration: exported count equals deleted count for every kind, every stored field accounts.md lists is present, and no channel is in the file.
- **VIP follows the switch (criterion 8)**:
  - front tests show no VIP mark on the list or the card, and no VIP field in the form, while Customers VIP is off;
  - an edit or a request sending VIP while it is off leaves the stored mark unchanged, and a customer created then is not VIP;
  - switching it back on shows every stored mark as before.
- **Collect fast (criterion 9)**: the end-to-end front run, phone and computer viewports, taps "Collect from <name>" from a Customers row and from an Home row; Record payment opens with the customer chosen in at most 2 taps from every tab root, never more on the computer; "All" fills the whole balance in one tap; a payment is recorded from a phone viewport, and one back move returns to the screen it came from. No test measures duration.
- **Who owes, at a glance (criterion 10)**:
  - front tests show Owed to you above everyone A–Z, the count line in both forms, debtors oldest first with ties by name, and "Nobody owes you" above a full A–Z list when nobody owes;
  - the total, the count and each debtor's balance and date equal Home's block and a direct computation over sales and payments: 0 differences;
  - customers in credit are in no section and no figure, and show "Credit" only in A–Z.
- **Customers' layout**: front tests show "Collect" with its accessible name on every debtor row (both sections and search results), the search collapsing into one list sorted by name and the sections returning when it is cleared.
- **The card (criterion 11)**: front tests and the end-to-end run show "Record payment" only with a balance above $0, and "New sale to <name>" opening New sale with that customer chosen; the card shows no "+ New sale".
- **No regression**: the existing customers, payments and navigation suites pass with no assertion loosened.
- **No curl**: the end-to-end front run adds, finds and edits a customer, adds one without a number, opens Record payment from "Collect" with the customer chosen, and opens "New sale to <name>" with that customer chosen. (Criterion 4)
- **Design**: `scripts/design/compare.sh` runs before and after for Customers, `ClienteFicha`, `Payment` and `NuevaVentaCliente`, phone and computer, light and dark where the registry has both, attached to the PR and judged by eye, with every difference from the design listed.
- Balance, account and Owed to you figure metrics live in `payments.md`.

## Out of scope

- Deleting a customer: they will have sales and payments.
- Merging duplicates; importing from the spreadsheet (import.md).
- A new unique key for customers.
- A VIP filter; a filter, list, badge, sort or prompt for customers without a number.
- A customer channel, or any replacement for it; keeping a copy of the old channel values anywhere.
- A separate Owed to you screen; a tappable debt figure in Customers' header; any filter or sort of Customers beyond what is defined here.
- Importing an old business export back.
- Other VIP rules (a percent off list); turning Customers VIP on or off (pricing-settings.md).
