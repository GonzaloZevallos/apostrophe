# Varieties

The varieties a business sells and the price history of each, seen only by that
business (ADR-0004). Every other capability reads prices from here: a sale takes the
current price of its day, the catalog shows today's. Variedades also shows each variety's
low-stock warning and stock status, whose rules belong to stock (`stock.md`).

## Jobs

**When** I start selling a new variety or change what I charge, **I want** to record the
variety once and each price with the date it starts to apply, **so I can** charge the
right price on any day without remembering when it changed.

**When** I run my business from my phone, **I want to** keep my prices up to date from the
phone, **so I can** stop keeping them in the spreadsheet and have real data in place when
sales arrive.

**When** I buy, harvest or count flower, **I want** to record it from my phone in a few
taps, **so I can** know what I have of each variety, see one running out before a customer
asks for it, and know what the grams I sell or gift cost me. (Served here by the
low-stock warning and status on Variedades; defined in `stock.md`.)

Success criteria:

1. Asking for a variety's price on a day answers the entry in force that day: the latest
   entry effective on or before it. A day before the first entry has no price.
2. A price change never rewrites the past: it is a new entry from its own date. A typo is
   fixed by deleting the wrong entry, and the one before it applies again (ADR-0003).
3. Two varieties of a business never share a name, whatever the case or spacing; two
   businesses may each have a variety of the same name.
4. Everything here, deleting a mistaken entry included, is done from the phone with no API
   call by hand.
5. Variedades says on its own, by shape and word and never by color alone, when a variety
   is sold out or below its threshold (`stock.md`, criterion 4).

## Behaviour

- **Variety**: a name, trimmed, inner spaces collapsed, up to 60 characters. Renaming
  keeps its prices. Varieties are listed by name.
- **Price entry**: an effective date, a list price per gram in whole pesos, and optionally
  a bulk price per gram with its bulk minimum in grams (up to two decimals). The bulk price
  and the bulk minimum come together or not at all; the bulk price is lower than the list
  price; every amount is above zero.
- One entry per variety per effective date; a second one on the same date is refused.
- **Deleting a price entry** (`DELETE /varieties/{id}/prices/{entry_id}`, ADR-0003): any
  entry may be deleted, the one in force today included. The entry before it applies
  again.
- A variety's own representation carries its current price **today**, `null` when it has
  none. Today is the business day in Argentina time.
- The price history lists the newest entry first.
- **Low-stock threshold**: optional grams, above zero, up to two decimals, set or turned
  off per variety. Its rules and the stock status are in `stock.md`.

### On screen (Variedades)

- **The list** (`Variedades`):
  - each variety with today's list price, bulk price and bulk minimum;
  - its stock status mark (`MarcaEstado`: square = agotada as the inverted chip, filled
    circle = baja, empty circle = ok);
  - its warning: "Avisame abajo de 15 g", "Avisando: quedan 18,5 g" or "Aviso apagado".
  - A variety with no price today shows "Sin precio: no se puede vender".
- **A variety's detail** (`VariedadDetalle`): the price history with "Rige desde", and a new
  price entry. The low-stock threshold is set or turned off from the variety. Toast:
  "Aviso guardado".
- Add and rename a variety.
- **Deleting an entry**: every history row has a delete action. It is confirmed with "Antes
  de borrar" ("¿Borrás…? / No, dejala / Sí, borrala"), and the copy says what takes the
  entry's place:
  - with an earlier entry, the price that applies again and its date, e.g. "Vuelve a regir
    $ 9.000 x g desde el 12/09";
  - for the first entry, that there is no price before the next entry's date;
  - for the only entry, that the variety is left "Sin precio: no se puede vender".

  The copy never mentions sales.
- **After deleting**, today's prices update at once on the detail and the list. Inicio may
  show "Arrancá por las variedades" again.
- **Toasts**: "Variedad guardada", "Precio guardado" and "Precio eliminado", with no amounts
  in them.
- **Refusals**, such as a duplicate name or a duplicate date, show inline and keep what was
  typed.

## Metrics

- **Price in force (criterion 1)**: tests over the history answer the latest entry on or
  before a day, and none before the first. 100% passing.
- **Past untouched (criterion 2)**: deleting an entry makes the previous one current again,
  covered by tests through the API and the front.
- **Unique names (criterion 3)**: duplicates within a business, whatever the case or
  spacing, are 0.
- **No curl (criterion 4)**: the end-to-end front run adds a variety, adds a price, renames
  the variety, deletes a price entry, and sets and turns off a low-stock threshold.
- **Status shown (criterion 5)**: Variedades shows the status mark and warning for each
  status, never by color alone; covered by the front tests.

## Out of scope

- Catalog attributes (shown or hidden, emoji, indica share, aroma): the catalog capability.
- Deleting a variety.
