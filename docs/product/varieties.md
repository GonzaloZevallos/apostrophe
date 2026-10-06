# Varieties

The varieties a business sells and the price history of each, seen only by that
business (ADR-0004). Every other capability reads prices from here: a sale takes the
current price of its day, the catalog shows today's. Variedades is the one screen for a
variety: its list and each variety's page hold the variety's prices (here), its stock,
entries, withdrawals and low-stock threshold (`stock.md`), and its catalog attributes
(`catalog.md`). It is a tab (navigation.md).

## Jobs

**When** I start selling a new variety or change what I charge, **I want** to record the
variety once and each price with the date it starts to apply, **so I can** charge the
right price on any day without remembering when it changed.

**When** I run my business from my phone, **I want to** keep my prices up to date from the
phone, **so I can** stop keeping them in the spreadsheet and have real data in place when
sales arrive.

**When** I buy, harvest or count flower, **I want** to record it from my phone in a few
taps, **so I can** know what I have of each variety, see one running out before a customer
asks for it, and know what the grams I sell or gift cost me. (Served here by the list's
status, the variety's page and "+ Entrada de stock"; defined in `stock.md`.)

**When** I take grams out of my own stock without selling them (to share at a party so
people get to know the business, or for my own use), **I want** to record them from my
phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right
and see in Ganancia what promoting the business and my own consumption cost me, without
recording a sale nobody made or an adjustment that reads as lost flower. (Served here by
"Sacar del stock" on the list and on a variety's page, and the withdrawals in its "Stock y
entradas"; defined in `stock.md`.)

**When** I run my business from my phone between orders or mid-chat with a customer,
several times a day, **I want** the app laid out around what I actually do and how often,
with everything about one variety in one place, **so I can** get back to the customer
instead of hunting through menus, and never wonder which of several screens holds what I
need. (The navigation job, navigation.md.)

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
6. **One variety, one page**: a variety's stock and its movements (entries and
   withdrawals), prices, low-stock warning and catalog attributes are seen and edited from
   its page, and from no other screen.

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

### On screen: the Variedades list (`Variedades`)

- **A tab root** (navigation.md). On a computer it is two panes: the list on the left, the
  selected variety's page on the right.
- **Every variety**, hidden ones included, sorted by name, in a stable order.
- **Each row**:
  - the name;
  - its stock status mark (`MarcaEstado`: square = agotada as the inverted chip, filled
    circle = baja, empty circle = ok) and its word, with "Sin entradas" when it has none
    and its detail line (`stock.md`);
  - "Oculta" beside the status when the variety is hidden from the catalog. It never
    replaces the stock status: a hidden variety can still be sold, gifted, withdrawn and
    restocked;
  - grams and days left;
  - today's list price per gram, or "Sin precio: no se puede vender" when it has none.
- **The summary line**, above the list:
  - with no varieties at all: no summary line, and a fixed empty state inviting the seller
    to add the first variety;
  - with every variety ok: "N variedades · todo ok";
  - otherwise: every status that is not ok, counted by word, in stock-status order (e.g.
    "1 sin entradas · 1 agotada · 1 baja"). It is never blank.
  - The exact wording is design's, as long as each state is told by word.
- **"Mandar catálogo"** at the top, opening the catalog screen (`catalog.md`). It is
  disabled, with its reason in words, only while the first-run checklist shows and nothing
  qualifies (navigation.md).
- **"+ Entrada de stock"**, a secondary button above the list (not a floating button),
  opening the stock entry form (`stock.md`).
- **"Sacar del stock"**, a secondary button next to "+ Entrada de stock", on phone and
  computer, opening the stock withdrawal form with no variety chosen (`stock.md`).
- **"Nueva variedad"**: adds a variety (a form).
- **"Todas las entradas"** at the foot (`stock.md`). It lists entries only.

### On screen: a variety's page (`VariedadDetalle`)

- **A detail** (navigation.md): the bar or sidebar and "‹ Variedades", without
  "+ Nueva venta".
- **The summary line** at the top: grams, status, days left and today's list price (e.g.
  "64 g · ok · 21 días · $ 11.000 x g"), with "Oculta" when hidden.
- **Three actions**: "+ Entrada" (the stock entry form with this variety chosen,
  `stock.md`), "Nuevo precio" (the price entry form) and "Sacar del stock" (the stock
  withdrawal form with this variety chosen, `stock.md`). How the three sit together is
  design's call.
- **Sections**, each with its last 3 rows and "Ver todas" for the full list:
  - **Stock y entradas**: the variety's stock entries and the withdrawals that touch it,
    newest date first, then most recently recorded first; a withdrawal row shows its date,
    "Promoción" or "Consumo propio" and this variety's grams with a minus sign, and opens
    the withdrawal's detail (`stock.md`);
  - **Precios**: the price history with "Rige desde", newest first, each row with its
    delete action;
  - **Aviso de stock bajo**: the low-stock threshold, set or turned off here; its warning
    reads "Avisame abajo de 15 g", "Avisando: quedan 18,5 g" or "Aviso apagado". Toast:
    "Aviso guardado";
  - **En el catálogo**: the variety's catalog attributes (shown or hidden, emoji, indica
    share, aroma), edited here and nowhere else (`catalog.md`).
- **Renaming** the variety is done here.
- **Forms** opened from here (Nuevo precio, + Entrada, Sacar del stock, rename, the catalog
  attributes) have "Cerrar" and a confirmation when leaving with something typed.
- **Deleting a price entry**: confirmed with "Antes de borrar" ("¿Borrás…? / No, dejala /
  Sí, borrala"), and the copy says what takes the entry's place:
  - with an earlier entry, the price that applies again and its date, e.g. "Vuelve a regir
    $ 9.000 x g desde el 12/09";
  - for the first entry, that there is no price before the next entry's date;
  - for the only entry, that the variety is left "Sin precio: no se puede vender".

  The copy never mentions sales.
- **After deleting**, today's prices update at once on the page and the list. Inicio may
  show "Arrancá por las variedades" again.
- **Toasts**: "Variedad guardada", "Precio guardado" and "Precio eliminado", with no amounts
  in them.
- **Refusals**, such as a duplicate name or a duplicate date, show inline and keep what was
  typed.
- **A variety that is gone** follows accounts.md's "Eso ya no está." rule, with "Volver a
  Variedades".

## Metrics

- **Price in force (criterion 1)**: tests over the history answer the latest entry on or
  before a day, and none before the first. 100% passing.
- **Past untouched (criterion 2)**: deleting an entry makes the previous one current again,
  covered by tests through the API and the front.
- **Unique names (criterion 3)**: duplicates within a business, whatever the case or
  spacing, are 0.
- **No curl (criterion 4)**: the end-to-end front run adds a variety, adds a price from its
  page, renames the variety, deletes a price entry, sets and turns off a low-stock
  threshold, edits the variety's catalog attributes from its page, and records a
  withdrawal from its page.
- **Status shown (criterion 5)**: the list and the page show the status mark and word for
  each status, "Oculta" beside (never instead of) the status of a hidden variety, and the
  summary line for no varieties, all ok and a mix; never by color alone; covered by the
  front tests.
- **One page (criterion 6)**: no other screen offers an edit of a variety's prices,
  entries' variety-level view, threshold or catalog attributes; checked against the docs
  and the design. Withdrawal rows on the page are told apart from entries by word and
  sign, covered by front tests.

## Out of scope

- The rules of catalog attributes: the catalog capability (they are edited here).
- The rules of stock withdrawals: the stock capability (they are started and seen here).
- Deleting a variety.
