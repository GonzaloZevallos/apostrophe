# Customers

The people a business sells to, each identified within that business by their phone
number, and seen only by that business (ADR-0004). Sales and payments build on this
capability: every sale and every debt belongs to one customer here, and a VIP customer gets
the bulk price on each sale.

## Jobs

**When** I hand over an order or take a payment, **I want** to find the customer by part of
their name or number, or register them on the spot with their phone number if they're new,
**so that** every sale and every debt lands on one real person and I always know who owes
me.

VIP and fixing a customer's details serve the same job. A customer marked VIP once gets the
bulk price on every sale, so the seller never has to remember who is a friend.

**When** I run my business from my phone, **I want to** keep my customers up to date from
the phone, **so I can** stop keeping them in the spreadsheet and have real data in place
when sales arrive.

Success criteria:

1. From the phone, a seller finds an existing customer by part of the name or part of the
   number, or registers a new one, fast enough that a sale with a new customer still takes
   under a minute.
2. One phone number is one customer in a business, however it is typed. Registering it
   again, or changing a customer's number to one already in use, is refused. The refusal
   says the number already belongs to a customer and never repeats the number or the name.
3. A business's customers are visible only to that business. By id from another business
   they answer 404. Lists and searches from another business show none of them. The same
   number can be a customer in two businesses without either business knowing.
4. Everything here is done from the phone, with no API call by hand.

## Behaviour

- **Customer**: a name, a phone number, a channel and VIP, and nothing else yet.
- **Name**: required. Trimmed, with inner spaces collapsed, up to 60 characters. Not unique.
- **Channel**: optional; Telegram or WhatsApp when present. It can be set or cleared
  later. It is recorded only; nothing uses it yet.
- **VIP**: yes or no, `false` by default. It can be edited. A change applies to sales
  recorded from then on; sales already recorded keep their stored prices (ADR-0003). In
  the Ventas list, a sale's VIP badge shows the customer's current status, not how that
  sale was priced (sales.md).
- **Phone number**: required, unique within the business, stored in one international
  form.
  - **With `+` and a country code other than 54**: a foreign number. It is stored as `+`
    and its digits, and must be 8 to 15 digits long.
  - **With `+54`, or a bare `54`**: if it is followed by 10 digits, or by `9` and 10
    digits, it is an Argentine number with its country code. It is stored as `+549` and
    the 10 digits.
  - **Anything else without `+`**: a local Argentine number. A leading `0` and the `15`
    are dropped, and exactly 10 digits, area code included, must remain. It is stored as
    `+549` and those 10 digits.
  - **Landlines** are not refused: every Argentine number is treated as a mobile.
  - **Refused**: anything that fits none of these rules, such as too short, too long, or
    without an area code. The refusal reads like "that doesn't look like a phone number
    with its area code" and never repeats what was typed.
  - `11 2345-6789`, `011 15 2345-6789`, `+54 9 11 2345 6789`, `5491123456789` and
    `541123456789` all become `+5491123456789`.
- **Uniqueness**: a number already used by another customer of the same business is
  refused, both on register and on edit. The refusal never repeats the number or the name.
  Numbers in other businesses never collide and are never revealed.
- **Edit**: name, phone number, channel and VIP. The phone number goes through the same
  normalisation, uniqueness check and refusal as when registering. Sales, payments and
  balance belong to the customer, not to the number, so they stay attached when it
  changes.
- **List and search**: one query.
  - The name matches the query anywhere, ignoring case and accents.
  - The number matches the digits of the query, with a leading 0 dropped, anywhere in the
    stored number's digits.
  - A customer matches if either the name or the number matches.
  - An empty query returns every customer.
  - Results are sorted by name.
  - There is no paging, no minimum query length and no VIP filter.
- **Isolation (ADR-0004)**:
  - The business comes from the session.
  - Another business's customer answers 404 for both reading and editing.
  - Lists and searches show none of another business's customers.
  - The customer routes are in `tests/test_business_isolation.py`.

### On screen (Clientes)

- **The list** (`Clientes`): search by part of the name or of the phone number.
- **A customer's card** (`ClienteFicha`):
  - phone, channel and VIP, with no balance, account or payment yet;
  - **"Nueva venta a <name>"**, which opens Nueva venta with that customer already
    chosen (sales.md).
- **Add and edit**: the "Nuevo cliente" form of `NuevaVentaCliente`. Name and phone are
  both marked required.
  - The same form registers a customer from inside a sale, through the "Elegir cliente"
    sheet, and that customer is used for the sale.
- **On success**, the toast "Cliente guardado". It never carries a name or a number.
- **Refusals** show inline on the field, with the domain's fixed string, and keep what was
  typed. They never repeat the number or the name.

## Metrics

- **Duplicate numbers**: customers sharing one stored number within a business, 0. A
  database constraint enforces it and a test covers it. (Criterion 2)
- **Normalisation matrix**: every equivalent form resolves to one number, and every invalid
  form is refused. 100% passing. (Criterion 2)
- **No echo**: no refusal body or toast contains the submitted number, any of its digit
  runs, or a customer's name. (Criterion 2)
- **Isolation coverage**: every customer route sits in the isolation sweep and answers 404
  or empty from another business. (Criterion 3)
- **Find-or-register time**: registering a new customer from the phone takes under 60 s
  through the front, and a search answers in under 300 ms with a few dozen customers. A
  sale with a new customer, registered from "Elegir cliente", is recorded in under 60 s
  through the front. (Criterion 1)
- **No curl**: the end-to-end front run adds, finds and edits a customer, and opens
  "Nueva venta a <name>" with that customer chosen. (Criterion 4)

## Out of scope

- Deleting a customer: they will have sales and payments.
- Merging duplicates; importing from the spreadsheet.
- A VIP filter.
- Balance, owing since and "Registrar cobro": they come with payments (#4).
- Using the channel.
