# Pricing settings

Which pricing rules a business uses: two independent switches, **Precio por cantidad** (bulk pricing) and **Customers VIP** (VIP customers). They are seen and changed only by the business they belong to (ADR-0004), in Settings → Prices (navigation.md).

What each rule does is defined by its owner, and every owner follows the switches:
- how a sale line is priced: sales.md;
- the bulk price and the VIP price on a price entry: varieties.md;
- the VIP mark: customers.md;
- the catalog's bulk line: catalog.md;
- the upkeep trigger: pinned-catalog.md;
- what the spreadsheet import switches on: import.md.

## Jobs

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has (a bulk price if I sell by quantity, and a VIP price I set per variety if I have VIP customers), **so I can** charge every customer exactly what I mean to without typing a special price by hand, without seeing fields that don't apply to me, and without anyone's price changing by surprise.

The protagonist is the seller. This refines the sales and varieties jobs; it is not a new job. The settings are rare and deliberate. The price form, the customer form and New sale follow them.

**When** I need to change how my business is set up, **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer. (The Settings job, navigation.md: served here by the Prices group.)

Without this, sellers leave the unused bulk and VIP fields blank, and type a special price by hand for any VIP price that isn't the bulk price.

Success criteria:

1. **Only my rules show.**
   - With a rule switched off, nothing about it appears in the price form, the variety page, the customer form's VIP mark, New sale or the catalog text.
   - A sale is priced as if the rule did not exist.
   - With both off, a sale is priced by list price alone. Gift and special price still work.
2. **My VIP price, never worse than regular.** A VIP customer is charged the lowest of the rules that apply to the line:
   - the list price;
   - the bulk price, when bulk is on and the line reaches the bulk minimum;
   - the variety's VIP price, when VIP is on and that day's price entry has one.

   A variety with no VIP price charges a VIP like anyone else. The live preview shows the same price before saving.
3. **Nobody's price moves by surprise.** After the change, every existing VIP customer is charged exactly what they were charged before, for the same variety, day and grams. No past sale's price, rule or total changes, whatever the switches do later.
4. **Switching loses nothing.** Turning a rule off and back on brings back every stored bulk price, VIP price and VIP mark. Only sales and price entries recorded while it was off go without it.
5. **Customers never see the VIP price.** The catalog never shows it. Its bulk line shows only while Precio por cantidad is on.
6. **Fast.** Each switch changes in a few taps from Settings → Prices. Recording a sale stays under a minute.
7. **Businesses never mix** (ADR-0004). One business's switches never affect another's prices, screens or catalog.

## Behaviour

### The switches

- **Two per business**, independent of each other: Precio por cantidad and Customers VIP.
- **Where they change**: only in Settings → Prices. Any user of the business may change them; there are no roles.
- **A rule switched off**:
  - it stops applying to new sales and is hidden on every screen that shows it;
  - it deletes nothing: past sales keep their price and rule (ADR-0003), and bulk prices, VIP prices and customers' VIP marks stay stored;
  - switched on again, every stored value is back as it was.
- **When a switch takes effect**: a sale is priced by the switches in force when it is saved. A change made while a sale form is open is neither refused nor announced (sales.md).
- **What the API answers**: stored values together with the switches. The screens hide what is off. The catalog text, built on the server, leaves the bulk line out itself (catalog.md).

### Starting values

- **Existing businesses** (at the migration): both switches on.
  - Every price entry with a bulk price gets VIP price = bulk price, so every VIP customer pays exactly what they paid before.
  - A bulk price is already below list, so the copied VIP price meets its own rule.
- **A new business**: both switches off, until the onboarding issue decides otherwise.
- **A business loaded by the spreadsheet import**: the import switches on what the sheet uses and never switches anything off (import.md).

### On screen: Settings → Prices

- **Place**: a group of Settings (navigation.md), after Users and before Integrations.
- **Route**: `/settings/prices`, fixed in `scripts/design/screens.json`. There is no other entry point: it is not reached from a variety's page or the price form.
- **A form**:
  - "Close", and a confirmation when leaving with unsaved changes; an untouched group closes at once;
  - two switches, "Bulk price" and "VIP customers", each marked on or off by word or shape and `aria-checked`, never by color alone;
  - the button "Save the prices";
  - on success, the toast "Prices saved", which carries no data.
- **A fixed line** says that past sales keep the price they were recorded with, and that switching a rule off deletes nothing.
- **A fixed help line under the VIP switch**, shown whether it is on or off: "Each variety needs its VIP price: without it, a VIP customer pays like anyone else." There is no count, no list and no warning anywhere else.
- **Upkeep**: a save that changes either switch triggers it (pinned-catalog.md), because the catalog's bulk line depends on Precio por cantidad.
- **Feedback**: a group that is gone, no network and server errors follow accounts.md.

### Export

The business export (accounts.md) holds the two switches as stored.

### Constraints

- The switches belong to the session's business (ADR-0004).
- Their routes join the isolation sweep and the gated-route test. Their storage joins the ownership migration test.
- No price goes to refusals, logs, the console or browser storage (ADR-0005).

## Metrics

- **Migration (criterion 3)**:
  - existing businesses end up with both switches on;
  - every price entry with a bulk price has VIP price = bulk price;
  - for every existing VIP customer, a sale's price, rule and total equal what they were before, for the same variety, day and grams: 0 differences.
- **Defaults**: a business opened through a new-business invitation has both switches off.
- **Switching loses nothing (criterion 4)**: after off and on again, every stored bulk price, VIP price and VIP mark reads as before, including a customer edited while VIP was off.
- **Stored price immutability (criterion 3)**: after any switch change, existing lines' price, rule and total are unchanged.
- **Screens follow the switches (criterion 1)**: front tests show, for each switch off, no trace of it in the price form, the variety page, the customer form, card and list, the Sales badge, New sale or the catalog. The recorded badges in a sale's detail remain.
- **Prices group (criterion 6)**:
  - front tests cover "Close", the unsaved-changes confirmation, an untouched close, "Save the prices", "Prices saved", both fixed lines, its place and route, and the absence of any other entry point;
  - Prices opens in at most 2 taps from any tab root;
  - the end-to-end Settings run switches each rule from a phone viewport.
- **Upkeep**: a save changing either switch triggers upkeep; a save changing neither sends nothing.
- **Isolation (criterion 7)**: the switches' routes are in the sweep and the gated-route test. One business's switches never change another's prices, screens or catalog.
- **No echo**: no refusal or log line contains a price.
- **Design**: `scripts/design/compare.sh` runs before and after for Prices, phone and computer, attached to the PR.

## Out of scope

- Other VIP rules, such as a percent off list.
- Price promotions by date.
- Onboarding, including what a new business starts with.
- Refusing or warning a sale because the switches changed mid-sale.
- A warning or count of varieties without a VIP price.
- Roles or permissions for changing the switches.
- Applying on tap, as Appearance does: the switches reprice every new sale for every partner, so they are saved explicitly.
