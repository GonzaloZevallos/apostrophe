# Customers

The people a business sells to, each identified within that business by their own record, and seen only by that business (ADR-0004). The name is how a user recognises a customer; the phone number is optional contact data. Sales and payments build on this capability: every sale and every debt belongs to one customer here, and a VIP customer gets the bulk price on each sale. A customer's balance, owing since and account are defined in `payments.md` and shown on their card and in Clientes' Te deben section.

## Jobs

**When** I hand over an order or take a payment, **I want** to find the customer by part of their name or number, or register them on the spot if they're new, **so that** every sale and every debt lands on one real person and I always know who owes me.

**When** I register a customer (from Clientes, in the middle of a sale, or through the one-time spreadsheet import) and I don't have their phone number, **I want** to save them under their name anyway and add the number later if I ever get it, **so I can** record every sale and every debt against the person who actually owes it, without inventing a number or keeping that person outside the app.

VIP and fixing a customer's details serve the same jobs. A customer marked VIP once gets the bulk price on every sale, so the seller never has to remember who is a friend.

**When** I run my business from my phone, **I want to** keep my customers up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive.

**When** a customer pays me part or all of what they owe, in cash or by transfer, on the day or weeks later, **I want** to record it from my phone in a few taps and see their balance and "owing since" drop right away, **so I** always know who owes me what and since when, and nothing they paid or still owe gets lost or lands on the wrong person. (Served here by Clientes' Te deben section and its "Cobrar", and by the card's balance, account and Registrar cobro; defined in `payments.md`.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by Clientes opening on who owes, with "Cobrar" on every debtor row.)

Success criteria:

1. From the phone, a seller finds an existing customer by part of the name or part of the number, or registers a new one with or without a number, fast enough that a sale with a new customer still takes under a minute.
2. One phone number is at most one customer in a business, however it is typed. Registering it again, or changing a customer's number to one already in use, is refused. The refusal says the number already belongs to a customer and never repeats the number or the name. Two customers without a number never collide.
3. A business's customers are visible only to that business. By id from another business they answer 404. Lists and searches from another business show none of them. The same number can be a customer in two businesses without either business knowing.
4. Everything here is done from the phone, with no API call by hand.
5. **A customer without a number is a normal customer, not a degraded one.**
   - They can be registered, edited, found by name, chosen for a sale, left owing, paid and listed in Clientes' Te deben section like anyone else.
   - The card and the list show no empty label, no dash and no "Sin teléfono" where a number would go.
6. **Nothing regresses for customers who have a number.**
   - Normalisation, the malformed-number refusal, uniqueness (on registering and on editing), search by number and refusals that never echo the number or the name all stay as they are.
   - A number can be removed from a customer, and their sales, payments and balance stay with them.
7. **No channel.** A customer has no channel (Telegram or WhatsApp): not in the API, the forms, the card or the database. Removing it changes nothing else about any customer.

## Behaviour

- **Customer**: a name, an optional phone number and VIP. A customer is identified by their own record (their id), never by their number. Their balance and owing since are worked out from their sales and payments (`payments.md`) and never stored on the customer.
- **Name**: required. Trimmed, with inner spaces collapsed, up to 60 characters. Not unique.
- **No channel**: the former channel (Telegram or WhatsApp) is removed from the domain, the API and the database. A request that still sends one is not a reason to refuse it; the field is simply not part of a customer.
- **VIP**: yes or no, `false` by default. It can be edited.
  - A change applies to sales recorded from then on; sales already recorded keep their stored prices (ADR-0003).
  - In the Ventas list, a sale's VIP badge shows the customer's current status, not how that sale was priced (sales.md).
- **Phone number**: optional, unique within the business among customers who have one, stored in one international form.
  - **None**: a missing value, `null`, or one blank after trimming means the customer has no number. It is stored as no number, never as an empty string.
  - **With `+` and a country code other than 54**: a foreign number. It is stored as `+` and its digits, and must be 8 to 15 digits long.
  - **With `+54`, or a bare `54`**: if it is followed by 10 digits, or by `9` and 10 digits, it is an Argentine number with its country code. It is stored as `+549` and the 10 digits.
  - **Anything else without `+`**: a local Argentine number. A leading `0` and the `15` are dropped, and exactly 10 digits, area code included, must remain. It is stored as `+549` and those 10 digits.
  - **Landlines** are not refused: every Argentine number is treated as a mobile.
  - **Refused**: a non-blank value that fits none of these rules, such as too short, too long, or without an area code. The refusal reads like "that doesn't look like a phone number with its area code" and never repeats what was typed.
  - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` and `541123456789` all become `+5491123456789`.
- **Uniqueness**: a number already used by another customer of the same business is refused, both on register and on edit. The refusal never repeats the number or the name. Any number of customers may have no number. Numbers in other businesses never collide and are never revealed.
- **Edit**: name, phone number and VIP.
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
- **Storage**: the phone column is nullable; uniqueness within a business applies only to stored numbers. Customers who existed before the number became optional kept their numbers. The channel column is dropped; every other column and every customer's sales, payments and balance stay as they were.
- **Isolation (ADR-0004)**:
  - The business comes from the session.
  - Another business's customer answers 404 for both reading and editing.
  - Lists and searches show none of another business's customers.
  - The customer routes are in `tests/test_business_isolation.py`.

### On screen (Clientes)

- **Clientes** is a tab root (navigation.md). On a computer it is two panes: the list on the left, the selected customer's card on the right.
- **The screen opens with two sections**, with no tappable debt figure in its header:
  1. **"Te deben"**, on top: the total owed, the count line, and every customer whose balance is above $0, oldest owing-since first, each row with "Cobrar" (`payments.md`). With nobody owing it reads "Nadie te debe".
  2. **Everyone, A–Z**, below, sorted by name.
- **Every row of a customer who owes**, in either section and in search results, shows the amount in amber with "te debe desde dd/mm" under it, never as a chip, and a "Cobrar" button (accessible name "Cobrar a <name>") that opens Registrar cobro with that customer already chosen. Tapping the rest of the row opens the customer's card.
- **A customer in credit** shows "A favor $ X" in the neutral/blue treatment.
- **A customer without a number** shows nothing in the number's place: no dash, no empty label, no "Sin teléfono".
- **Search** by part of the name or of the phone number: while a query is typed, both sections collapse into one flat list sorted by name, matched as above. Clearing the query brings the two sections back.
- **A customer's card** (`ClienteFicha`), a card with "‹ Clientes":
  - phone (only when there is one; with none, the line is left out entirely) and VIP;
  - "Te debe $ X desde dd/mm" or "A favor $ X", the account, "Registrar cobro" when the balance is above $0, and "Borrar cobro" on later payments (`payments.md`);
  - **"Nueva venta a <name>"**, which opens Nueva venta with that customer already chosen (sales.md). The card shows no "+ Nueva venta".
  - Adding a number later is the card's ordinary edit; there is no prompt to fill it in.
- **Add and edit**: the one "Nuevo cliente" form of `NuevaVentaCliente`, the same from Clientes and from "Elegir cliente" in Nueva venta. Its fields are "Nombre" (the only one marked required), the phone (optional, and it can be cleared when editing) and VIP. There is no channel field.
  - The same form registers a customer from inside a sale, through the "Elegir cliente" sheet, and that customer is used for the sale.
  - It is a form: "Cerrar", and a confirmation when leaving with unsaved changes.
- **On success**, the toast "Cliente guardado". It never carries a name or a number.
- **Refusals** show inline on the field, with the domain's fixed string, and keep what was typed. They never repeat the number or the name.

## Metrics

- **Duplicate numbers**: customers sharing one stored number within a business, 0. A database constraint enforces it and a test covers it. (Criterion 2)
- **No collision without a number**: two or more customers with no number coexist in a business, tested. (Criteria 2, 5)
- **Normalisation matrix**: every equivalent form resolves to one number, every invalid non-blank form is refused, and a blank value is stored as no number. 100% passing. (Criteria 2, 6)
- **No echo**: no refusal body or toast contains the submitted number, any of its digit runs, or a customer's name. (Criteria 2, 6)
- **Isolation coverage**: every customer route sits in the isolation sweep and answers 404 or empty from another business. (Criterion 3)
- **Find-or-register time**:
  - registering a new customer from the phone takes under 60 s through the front;
  - a search answers in under 300 ms with a few dozen customers;
  - a sale with a new customer, registered from "Elegir cliente" with or without a number, is recorded in under 60 s through the front.

  (Criterion 1)
- **No-number lifecycle**: through the API and the end-to-end front run, a customer without a number is registered, edited, found by name, chosen for a sale left owing, paid and shown in Clientes' Te deben section. 100% passing. (Criterion 5)
- **No placeholder**: front tests show no phone line, no dash, no empty label and no "Sin teléfono" on the card and the list for a customer without a number. (Criterion 5)
- **Number removed**: clearing a customer's number keeps their sales, payments and balance unchanged, tested. (Criterion 6)
- **Migration**: every customer's number is unchanged after the migration that made it optional, tested. (Criterion 6)
- **No channel (criterion 7)**: after the migration that drops it, no customer answer, form, card or export carries a channel; every customer's name, number, VIP, sales, payments and balance are unchanged, tested.
- **Clientes' layout**: front tests show Te deben above everyone A–Z, "Nadie te debe" with nobody owing, "Cobrar" with its accessible name on every debtor row (sections and search results), the search collapsing into one list and the sections returning when it is cleared.
- **No curl**: the end-to-end front run adds, finds and edits a customer, adds one without a number, opens Registrar cobro from "Cobrar" with the customer chosen, and opens "Nueva venta a <name>" with that customer chosen. (Criterion 4)
- Balance, account and Te deben figure metrics live in `payments.md`.

## Out of scope

- Deleting a customer: they will have sales and payments.
- Merging duplicates; importing from the spreadsheet (import.md).
- A new unique key for customers.
- A VIP filter; a filter, list, badge, sort or prompt for customers without a number.
- A customer channel, or any replacement for it.
