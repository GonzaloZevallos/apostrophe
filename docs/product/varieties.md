# Varieties

The varieties a business sells and the price history of each, seen only by that
business (ADR-0004). Every other capability reads prices from here: a sale takes the
current price of its day, the catalog shows today's. Variedades is the one screen for a
variety: its list and each variety's page hold the variety's prices (here), its stock,
entries and low-stock threshold (`stock.md`), and its catalog attributes (`catalog.md`).
It is a tab (navigation.md). It replaced the former Stock tab, the old Catálogo screen
and the old Variedades screens; their paths redirect (navigation.md).

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

**When** I run my business from my phone between orders or mid-chat with a customer,
several times a day, **I want** the app laid out around what I actually do and how often,
with everything about one variety in one place, **so I can** get back to the customer
instead of hunting through menus, and never wonder which of several screens holds what I
need. (The navigation job, navigation.md.)

**When** a customer asks me what I have or how much something costs, or flower comes in,
runs out or gets a new price, **I want** to open one variety and find everything about it
on its own page (its stock and entries, its prices, its low-stock warning and how it
shows in the catalog), the list to tell me at a glance what I have, what is running out
and what I can't sell, and today's catalog one tap from that list, ready to share from my
phone, **so I can** answer the customer, record what came in and send an up-to-date
catalog without moving between screens, and my customers never get a stale price or a
variety I can't sell.

This last one is the navigation job applied to varieties, stock and the catalog, not a
new job; its main situation is mid-chat, between orders. The stock and catalog jobs stay
in `stock.md` and `catalog.md`; the computer is the same job on two panes.

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
   is sold out or below its threshold (`stock.md`, criterion 4). The summary line is
   never blank.
6. **One variety, one page**: a variety's stock and entries, prices, low-stock warning and
   catalog attributes are seen and edited from its page, and from no other screen.
7. **Two taps at most**: from any tab root, the catalog screen ("Mandar catálogo") and
   the stock entry form ("+ Entrada de stock") open in at most 2 taps; a computer never
   takes more than the phone. An entry started from a variety's page has that variety
   chosen, with "Stock inicial" preselected only when it has no entries.
8. **Nothing lost, nothing invented**: everything a seller could do on the former Stock,
   Catálogo and Variedades screens is still reachable; every old path redirects
   permanently; no link points at a screen that does not exist.

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

### Routes

- The routes are those in `scripts/design/screens.json`: `/varieties`,
  `/varieties/{low}`, `/varieties/catalog`, `/varieties/entries`,
  `/varieties/entries/new`, `/varieties/{low}/prices`, `/varieties/{low}/prices/new` and
  `/varieties/new`.
- A reload on any of them opens the screen, never the API's answer (ADR-0024 governs
  paths shared with the API).
- Old paths (`/variedades`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/catalogo` and every
  other former Stock, Variedades or Catálogo path) redirect permanently (navigation.md).

### On screen: the Variedades list (`Variedades`)

- **A tab root** (navigation.md). On a computer it is two panes: the list on the left, the
  selected variety's page on the right.
  - **On a computer**, opening Variedades with nothing selected selects the first variety
    by name automatically, so a figure is always in view; this counts as no tap, and
    picking another variety replaces it. With no varieties, the right pane holds nothing
    that could be read as data.
  - **On the phone**, the list is the screen; it never opens a variety on its own.
  - A selected variety that is gone follows accounts.md's "Eso ya no está." rule.
- **Every variety**, hidden ones included, sorted by name, in a stable order.
- **Each row**:
  - the name;
  - its stock status mark (`MarcaEstado`: square = agotada as the inverted chip, filled
    circle = baja, empty circle = ok) and its word, with "Sin entradas" when it has none
    and its detail line (`stock.md`);
  - "Oculta" beside the status when the variety is hidden from the catalog. It never
    replaces the stock status: a hidden variety can still be sold, gifted and restocked;
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
  opening the stock entry form with the variety to be chosen (`stock.md`).
- **"Nueva variedad"**: adds a variety (a form).
- **"Todas las entradas"** at the foot (`stock.md`).

### On screen: a variety's page (`VariedadDetalle`)

- **A detail** (navigation.md): the bar or sidebar and "‹ Variedades", without
  "+ Nueva venta".
- **The summary line** at the top: grams, status, days left and today's list price (e.g.
  "64 g · ok · 21 días · $ 11.000 x g"), with "Oculta" when hidden.
- **Two equal buttons**: "+ Entrada" (the stock entry form with this variety chosen, and
  "Stock inicial" preselected only when it has no entries, `stock.md`) and "Nuevo precio"
  (the price entry form).
- **Sections**:
  - **Stock y entradas**: the variety's last 3 stock entries and "Ver todas" for all of
    them (`stock.md`);
  - **Precios**: the last 3 price entries with "Rige desde", newest first, each row with
    its delete action, and "Ver todas" for the full history;
  - **Aviso de stock bajo**: the low-stock threshold and its edit action, nothing else
    (no "Ver todas"); its warning reads "Avisame abajo de 15 g", "Avisando: quedan
    18,5 g" or "Aviso apagado". Toast: "Aviso guardado";
  - **En el catálogo**: the variety's catalog attributes (shown or hidden, emoji, indica
    share, aroma) and their edit action, nothing else (no "Ver todas"), edited here and
    nowhere else (`catalog.md`).
- **"Ver todas" lists** are cards (navigation.md): the bar or sidebar and "‹ <variety>",
  without "+ Nueva venta".
- **Renaming** the variety is done here.
- **Forms** opened from here (Nuevo precio, + Entrada, rename, the catalog attributes) have
  "Cerrar" and a confirmation when leaving with something typed.
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
  in them (plus "Aviso guardado", "Catálogo guardado" and the entry form's "Entrada
  guardada").
- **Refusals**, such as a duplicate name or a duplicate date, show inline and keep what was
  typed.
- **A variety that is gone**, or another business's variety opened by id, follows
  accounts.md's "Eso ya no está." rule, with "Volver a Variedades".
- No network shows "Sin conexión"; a server error shows the generic retry (accounts.md).

## Metrics

- **Price in force (criterion 1)**: tests over the history answer the latest entry on or
  before a day, and none before the first. 100% passing.
- **Past untouched (criterion 2)**: deleting an entry makes the previous one current again,
  covered by tests through the API and the front.
- **Unique names (criterion 3)**: duplicates within a business, whatever the case or
  spacing, are 0.
- **No curl (criterion 4)**: the end-to-end front run adds a variety, adds a price from its
  page, renames the variety, deletes a price entry, sets and turns off a low-stock
  threshold, and edits the variety's catalog attributes from its page.
- **Status shown (criterion 5)**: the list and the page show the status mark and word for
  each status, "Oculta" beside (never instead of) the status of a hidden variety, and the
  summary line for no varieties, all ok and a mix; never by color alone; covered by the
  front tests and checked by eye in both themes.
- **One page (criterion 6)**: no other screen offers an edit of a variety's prices,
  entries' variety-level view, threshold or catalog attributes; checked against the docs
  and the design. Front tests show only Stock y entradas and Precios carry their last 3
  rows and "Ver todas".
- **Two taps (criterion 7)**: the end-to-end run, phone and computer viewports, counts the
  taps from every tab root to the catalog screen and to the stock entry form: 100% within
  2, a computer never more than the phone; an entry from a variety's page has the variety
  chosen and "Stock inicial" preselected only with no entries.
- **Two panes**: on a computer viewport, nothing selected shows the first variety by name;
  no varieties leaves the right pane with no figure; on the phone the list never opens a
  variety.
- **Nothing lost (criterion 8)**: every old Stock, Variedades and Catálogo path answers a
  permanent redirect, tested one by one; every old action maps to a place in the new
  screens; no link points at a missing screen.
- **Isolation**: another business's variety opened by id shows "Eso ya no está."; after a
  full front run, the console and browser storage hold no names or amounts.
- **Design**: `scripts/design/compare.sh` runs before and after for the list and the
  page, phone and computer, attached to the PR and judged by eye.
- **Speed**: Variedades answers in under 300 ms with a few dozen varieties.

## Out of scope

- The rules of catalog attributes: the catalog capability (they are edited here).
- Deleting a variety.
- Configuración and its groups.
