# Varieties

The varieties a business sells and the price history of each, seen only by that
business (ADR-0004). Every other capability reads prices from here: a sale takes the
current price of its day, the catalog shows today's. Variedades is the one screen for a
variety: its list and each variety's page hold the variety's prices (here), its stock,
entries, withdrawals and low-stock threshold (`stock.md`), and its catalog attributes (`catalog.md`).
It is a tab (navigation.md). It replaced the former Stock tab, the old Catálogo screen
and the old Variedades screens; their paths redirect (navigation.md). It also covers the
end of a variety's life: a variety with no history can be deleted, and one with history
archived and later restored, with no past figure moving.

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
status, the variety's page, its low-stock warning and "+ Entrada de stock"; defined in
`stock.md`.)

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

**When** a customer asks me what I have or how much something costs, or flower comes in,
runs out or gets a new price, **I want** to open one variety and find everything about it
on its own page (its stock and entries, its prices, its low-stock warning and how it
shows in the catalog), the list to tell me at a glance what I have, what is running out
and what I can't sell, and today's catalog one tap from that list, ready to share from my
phone, **so I can** answer the customer, record what came in and send an up-to-date
catalog without moving between screens, and my customers never get a stale price or a
variety I can't sell.

This one is the navigation job applied to varieties, stock and the catalog, not a
new job; its main situation is mid-chat, between orders. The stock and catalog jobs stay
in `stock.md` and `catalog.md`; the computer is the same job on two panes.

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my
lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if
it never moved and archiving it if it has history, **so** my lists show only what I still
sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly
as it was if I start selling it again.

This last one is the varieties and navigation job applied to the end of a variety's life,
not a new job. Before it, a seller could only hide such a variety from the catalog and
live with it in the lists, rename it to something like "NO USAR" or leave it sold out.

Success criteria:

1. Asking for a variety's price on a day answers the entry in force that day: the latest
   entry effective on or before it. A day before the first entry has no price.
2. A price change never rewrites the past: it is a new entry from its own date. A typo is
   fixed by deleting the wrong entry, and the one before it applies again (ADR-0003).
3. Two varieties of a business never share a name, whatever the case or spacing; two
   businesses may each have a variety of the same name. An archived variety keeps its
   name.
4. Everything here, deleting a mistaken entry included, is done from the phone with no API
   call by hand.
5. Variedades says on its own, by shape and word and never by color alone, when a variety
   is sold out or below its threshold (`stock.md`, criterion 4). The summary line is
   never blank.
6. **One variety, one page**: a variety's stock and its movements (entries and
   withdrawals), prices, low-stock warning and
   catalog attributes are seen and edited from its page, and from no other screen. Every
   edit there ends in an explicit save, so the seller always knows a change was kept.
7. **Two taps at most**: from any tab root, the catalog screen ("Mandar catálogo") and
   the stock entry form ("+ Entrada de stock") open in at most 2 taps; a computer never
   takes more than the phone. An entry started from a variety's page has that variety
   chosen, with "Stock inicial" preselected only when it has no entries.
8. **Nothing lost, nothing invented**: everything a seller could do on the former Stock,
   Catálogo and Variedades screens is still reachable; every old path redirects
   permanently; no link points at a screen that does not exist.
9. **Out of the way in a few taps**: from a variety's own page, on phone and computer, the
   seller takes it out of every list and picker. The app offers Delete only when the
   variety has no history, and Archive otherwise. It never offers a delete that will be
   refused.
10. **The books don't move**: after archiving, every past sale and its lines, stock
    figure, cost of goods, stock shortfall, Ganancia, Caja, Análisis figure and customer
    balance reads exactly as before, to the peso and the hundredth of a gram.
11. **Comes back whole**: restoring brings the variety back with its prices, stock,
    entries, low-stock threshold, catalog attributes and hidden flag intact, and back in
    every list and picker it qualifies for.
12. **The domain decides**: a delete of a variety with history is refused by the domain
    itself, not only hidden in the UI.
13. **Archived varieties stay findable**: the seller can always see what they archived and
    restore it.
14. **Nothing new in the rules that already hold**: businesses stay isolated (ADR-0004);
    every state is told by word and shape, never by colour alone, in both themes; toasts
    carry no data.

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
  off per variety. Turned off means the variety has none; no former amount is kept. Its
  rules and the stock status are in `stock.md`.

### Deleting and archiving a variety

- **History** is any sale line of the variety (gifts and special prices included) or any
  stock entry of it (any origin: purchase, harvest, opening stock, or an adjustment of
  either sign), or any stock withdrawal line of it (promotion or own use). It is worked
  out live and never stored.
- **Not history**: price entries, the low-stock threshold and catalog attributes. A
  deleted variety takes them with it.
- **History decides which action is offered**, worked out when the page is read: Delete
  with no history, Archive with history. Only Delete is guarded by the domain.
- **Delete**: only for a variety with no history. The variety disappears for good.
  - Once the seller deletes the variety's last sale or last stock entry, Delete is offered
    again.
  - A delete with history is refused by the domain with its own coded refusal in
    `contract.json` (ADR-0008), repeating no name or amount (ADR-0005).
  - The check and the delete are one guarded write: a sale or entry a partner records at
    the same moment either blocks the delete or is refused as "Eso ya no está". Nothing is
    ever orphaned.
  - A variety already gone answers 404 and follows accounts.md: "Eso ya no está. La lista
    ya está al día."
- **Archive**: offered for a variety with history. It leaves every list and picker but
  stays in the books.
  - Archive is never refused for having or lacking history. If the variety's last sale or
    entry was deleted after the page loaded, tapping "Archivar variedad" still archives
    it; it can be deleted later by restoring it first. An archived variety may also lose
    all its history while archived (its last entry or sale deleted); the same path
    applies.
  - Archiving a variety already archived changes nothing; one already gone answers "Eso ya
    no está".
  - Allowed with stock above, at or below zero, always after a confirmation.
  - Archiving and restoring never create a stock entry and never change stock, lots, cost
    of goods, pending cost, prices or any other figure.
  - Archive and hide are independent: archiving keeps the hidden flag, and restoring
    brings it back as it was.
  - Archiving and restoring are upkeep triggers for the pinned catalog
    (pinned-catalog.md).
- **An archived variety is left out of**:
  - Variedades' list and its summary line;
  - Inicio's Lo que te queda, and the "Arrancá por las variedades" rule (results.md);
  - Nueva venta's variety picker (`sales.md`);
  - the stock entry form's variety picker (`stock.md`);
  - the price entry form;
  - the catalog text and the catalog screen's "what does not go out" list (`catalog.md`);
  - the pinned catalog.
- **Past records keep it, by its plain name, with no "archivada" tag and no figure
  changed**: Ventas and a sale's detail, the customer's account, Todas las entradas,
  Análisis' variety rows and every week, month and since-the-start figure, Results'
  Ganancia and Caja, and the business export (which holds the archived flag as a stored
  fact).
- **Existing records stay workable** (ADR-0009): a stock entry of an archived variety can
  be edited or deleted from Todas las entradas; a sale containing one can be deleted,
  Deshacer included; Asignar cliente still works. An entry edit can keep the archived
  variety it already has, but can never move the entry onto a different archived one.
- **Nothing new is recorded against an archived variety**: no sale line, stock entry or
  price entry; such a reference answers as gone. A form left open while a partner
  archives the variety is refused on save with accounts.md's "Eso ya no está" rule and
  keeps the rest of what was typed where the screen allows. In Nueva venta the line shows
  the generic gone message and the form stays open (sales.md's rule for a variety not
  found).
- **Names**: an archived variety keeps its name reserved under the uniqueness rule (case
  and spacing ignored).
  - Adding or renaming a variety to that name is refused inline with its own fixed
    refusal: the name belongs to an archived variety, look in Archivadas. It repeats
    nothing typed.
  - An archived variety can be renamed only after it is restored, so restore never
    collides.
  - A deleted variety's name is free at once.

### Routes

- The routes are those in `scripts/design/screens.json`: `/varieties`,
  `/varieties/{low}`, `/varieties/catalog`, `/varieties/entries`,
  `/varieties/entries/new`, `/varieties/entries/{id}` (editing a stock entry),
  `/varieties/{low}/entries` (a variety's "Ver todas" of entries and withdrawals),
  `/varieties/{low}/prices`, `/varieties/{low}/prices/new`, `/varieties/new` and
  `/varieties/archived` (the Archivadas card). An archived variety's page is the same
  `/varieties/{low}`, read-only.
- A reload on any of them opens the screen, never the API's answer (ADR-0024 and
  ADR-0030 govern paths shared with the API).
- Old paths (`/variedades`, `/mi-stock`, `/mi-stock/nueva-entrada`,
  `/mi-stock/entradas/{id}`, `/catalogo` and every other former Stock, Variedades or
  Catálogo path) redirect permanently (navigation.md).

### On screen: the Variedades list (`Variedades`)

- **A tab root** (navigation.md). On a computer it is two panes: the list on the left, the
  selected variety's page on the right.
  - **On a computer**, opening Variedades with nothing selected selects the first
    unarchived variety by name automatically, so a figure is always in view; this counts
    as no tap, and picking another variety replaces it. With no varieties, the right pane
    holds nothing that could be read as data.
  - Archiving or deleting the selected variety selects the next one by name, else the
    previous one, else the empty state.
  - **On the phone**, the list is the screen; it never opens a variety on its own.
  - A selected variety that is gone follows accounts.md's "Eso ya no está." rule.
- **Every unarchived variety**, hidden ones included, sorted by name, in a stable order.
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
- **The summary line**, above the list, counting unarchived varieties only:
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
- **"Sacar del stock"**, a secondary button next to "+ Entrada de stock", on phone and
  computer, opening the stock withdrawal form with no variety chosen (`stock.md`).
- **"Nueva variedad"**: adds a variety (a form).
- **"Todas las entradas"** at the foot (`stock.md`), at `/varieties/entries`. It lists entries only.
- **"Archivadas (N)"** at the foot, next to "Todas las entradas", opening the Archivadas
  card. It is left out when there are none.

### On screen: Archivadas

- **A card** (navigation.md) at `/varieties/archived`: the bar or sidebar and
  "‹ Variedades", without "+ Nueva venta".
- It lists every archived variety by name, each marked "Archivada" in words, each with
  "Restaurar".
- On a computer it uses the same two panes; opened with nothing selected, it selects the
  first archived variety by name.
- **Restaurar** is one tap with no confirmation, shows the toast "Variedad restaurada",
  and the variety returns to Variedades' list exactly as it was: hidden flag, prices,
  stock, entries, threshold and catalog attributes.

### On screen: a variety's page (`VariedadDetalle`)

- **A detail** (navigation.md): the bar or sidebar and "‹ Variedades", without
  "+ Nueva venta".
- **The summary line** at the top: grams, status, days left and today's list price (e.g.
  "64 g · ok · 21 días · $ 11.000 x g"), with "Oculta" when hidden.
- **Three actions**: "+ Entrada" (the stock entry form with this variety chosen, and
  "Stock inicial" preselected only when it has no entries, `stock.md`), "Nuevo precio"
  (the price entry form) and "Sacar del stock" (the stock withdrawal form with this
  variety chosen, `stock.md`).
- **Sections**:
  - **Stock y entradas**: the variety's last 3 movements (its stock entries and the
    withdrawals that touch it, newest date first, then most recently recorded first) and
    "Ver todas", which opens `/varieties/{low}/entries`: the same list as "Todas las
    entradas", filtered to this variety, with its withdrawals, where each entry can be
    edited or deleted (`stock.md`). A withdrawal row shows its date, "Promoción" or
    "Consumo propio" and this variety's grams with a minus sign, and opens the
    withdrawal's detail;
  - **Precios**: the last 3 price entries with "Rige desde", newest first, each row with
    its delete action, and "Ver todas" (`/varieties/{low}/prices`) for the full history;
  - **Aviso de stock bajo**: the current warning, read-only, with an on/off switch and an
    "Editar" link, and nothing else (no "Ver todas"):
    - it reads "Avisame abajo de 15 g", "Avisando: quedan 18,5 g" or "Aviso apagado";
    - "Editar" opens a small form: "Avisar con menos de" in grams, "Guardá el aviso" and
      "Cerrar". A refused amount shows under the field and keeps what was typed;
    - turning the switch on opens that same form (an off warning keeps no amount); closing
      it without saving leaves the warning off;
    - turning the switch off saves at once;
    - every save, the switch-off included, shows the toast "Aviso guardado";
  - **En el catálogo**: the variety's catalog attributes, read-only (shown or hidden,
    emoji, % índica, aroma/sabor), with an "Editar" link, and nothing else (no "Ver
    todas"). It is the only place they are edited (`catalog.md`):
    - "Editar" opens one form with "Mostrar en el catálogo", Emoji, % índica and
      Aroma/sabor, ending in "Guardá el catálogo";
    - each refusal (for example an aroma over 200 characters) shows under its own field
      and keeps everything typed;
    - leaving with something typed and not saved asks before discarding;
    - a save shows the toast "Catálogo guardado".
- **One removal action**, worked out from history when the page is read:
  - with no history: "Eliminar variedad", through a destructive ConfirmDialog, then the
    toast "Variedad eliminada" and back to Variedades;
  - with history: "Archivar variedad", through a confirmation that names the grams on hand
    when stock is not zero (e.g. "Te quedan 12 g. Si la archivás, dejan de verse en Inicio
    y en las listas, pero el stock queda guardado.") and simply asks with zero stock (the
    exact wording is design's), then the toast "Variedad archivada".
  - **Stale page, delete**: if history appeared after the page loaded, the delete is
    refused with its coded refusal and the page refreshes to show "Archivar variedad". The
    UI never offers a delete it knows will be refused.
  - **Stale page, archive**: if the history went away after the page loaded, "Archivar
    variedad" still archives it, with no refusal.
- **An archived variety's page** is the same page, read-only, with the back arrow
  "‹ Archivadas" (with no history, back goes to Archivadas):
  - its summary line and sections show read-only, with "Archivada" in words;
  - no "+ Entrada", "Sacar del stock", "Nuevo precio", price delete, threshold switch,
    rename, Editar forms or removal action; its one action is "Restaurar";
  - to delete an archived variety that has no history, the seller restores it first, then
    deletes it. There is no second path.
- **"Ver todas" lists** are cards (navigation.md): the bar or sidebar and "‹ <variety>",
  without "+ Nueva venta"; back with no history goes to the variety's page.
- **Renaming** the variety is done here.
- **Forms** opened from here (Nuevo precio, + Entrada, Sacar del stock, rename, the low-stock warning, the
  catalog attributes) have "Cerrar" and a confirmation when leaving with something typed;
  an untouched one closes at once.
- **Deleting a price entry**: confirmed with "Antes de borrar" ("¿Borrás…? / No, dejala /
  Sí, borrala"), and the copy says what takes the entry's place:
  - with an earlier entry, the price that applies again and its date, e.g. "Vuelve a regir
    $ 9.000 x g desde el 12/09";
  - for the first entry, that there is no price before the next entry's date;
  - for the only entry, that the variety is left "Sin precio: no se puede vender".

  The copy never mentions sales.
- **After deleting**, today's prices update at once on the page and the list. Inicio may
  show "Arrancá por las variedades" again.
- **Toasts**: "Variedad guardada", "Precio guardado", "Precio eliminado", "Variedad
  eliminada", "Variedad archivada" and "Variedad restaurada", with no names or amounts in
  them (plus "Aviso guardado", "Catálogo guardado" and the entry form's "Entrada
  guardada").
- **Refusals**, such as a duplicate name, a name held by an archived variety or a
  duplicate date, show inline and keep what was typed.
- **A variety that is gone**, or another business's variety (archived or not) opened by
  id, follows accounts.md's "Eso ya no está." rule, with "Volver a Variedades".
- No network shows "Sin conexión"; a server error shows the generic retry (accounts.md).
- Everything works on phone and computer, light and dark; no state is told by colour
  alone.

### Constraints

- Every route, the delete, archive and restore routes included, joins the isolation sweep
  and the gated-route test (ADR-0004).
- Refusal codes in `contract.json` (ADR-0008): a delete with history; a name held by an
  archived variety; an archived variety referenced for a new record (gone). Archive has no
  refusal of its own. None repeats a name or an amount (ADR-0005).

## Metrics

- **Price in force (criterion 1)**: tests over the history answer the latest entry on or
  before a day, and none before the first. 100% passing.
- **Past untouched (criterion 2)**: deleting an entry makes the previous one current again,
  covered by tests through the API and the front.
- **Unique names (criterion 3)**: duplicates within a business, whatever the case or
  spacing, are 0, archived varieties included.
- **No curl (criterion 4)**: the end-to-end front run adds a variety, adds a price from its
  page, renames the variety, deletes a price entry, sets a low-stock threshold through
  "Editar", turns it off and on again through the switch, and edits the variety's catalog
  attributes through "Editar" and "Guardá el catálogo", all from its page, and records a
  withdrawal from its page. It also deletes a fresh variety, archives one with a sale,
  finds it in Archivadas, opens its read-only page and restores it.
- **Status shown (criterion 5)**: the list and the page show the status mark and word for
  each status, "Oculta" beside (never instead of) the status of a hidden variety, and the
  summary line for no varieties, all ok and a mix; never by color alone; covered by the
  front tests and checked by eye in both themes.
- **One page (criterion 6)**: no other screen offers an edit of a variety's prices,
  entries' variety-level view, threshold or catalog attributes; checked against the docs
  and the design. Front tests show only Stock y entradas and Precios carry their last 3
  rows and "Ver todas". Withdrawal rows on the page are told apart from entries by word and
  sign, covered by front tests.
- **Saved, never guessed (criterion 6)**: front tests show:
  - Aviso de stock bajo and En el catálogo read-only until "Editar";
  - switching the warning on opens the threshold form, and "Cerrar" leaves it off;
  - switching it off saves at once with "Aviso guardado";
  - a too-long aroma refused under its field, everything typed kept;
  - leaving the catalog form with unsaved text asks first, and an untouched form closes at
    once.
- **Two taps (criterion 7)**: the end-to-end run, phone and computer viewports, counts the
  taps from every tab root to the catalog screen and to the stock entry form: 100% within
  2, a computer never more than the phone; an entry from a variety's page has the variety
  chosen and "Stock inicial" preselected only with no entries.
- **Two panes**: on a computer viewport, nothing selected shows the first unarchived
  variety by name; no varieties leaves the right pane with no figure; archiving or
  deleting the selected variety selects the next, else the previous, else the empty
  state; on the phone the list never opens a variety.
- **Nothing lost (criterion 8)**: every old Stock, Variedades and Catálogo path answers a
  permanent redirect, tested one by one, `/mi-stock/entradas/{id}` included; every old
  action maps to a place in the new screens; no link points at a missing screen; a reload
  on `/varieties/{low}/entries`, `/varieties/entries/{id}` and `/varieties/archived`
  opens the screen.
- **Offered action (criteria 9, 12)**: a matrix, 100% passing. The page offers "Eliminar
  variedad" exactly when the variety has no history and "Archivar variedad" otherwise,
  with history from each source alone (a list line, a gift, a special price, an entry of
  each origin, both adjustment signs). Price entries, a threshold and catalog attributes
  alone leave Delete offered. Deleting the last sale or entry offers Delete again. The
  domain refuses a delete with history with its code through the API, whatever the UI
  showed. Archiving a variety whose history was deleted after the page loaded succeeds;
  after restoring it, its page offers Delete.
- **No orphan (criterion 12)**: a repository test over real SQLite races a delete with a
  sale line and with a stock entry: either the delete is refused or the record is refused
  as gone; 0 rows reference a missing variety.
- **Books unchanged (criterion 10)**: over a seeded history, `GET /analysis` for every
  week, month and the all-time window, `GET /panel`'s period figures, every sale's
  detail, every customer's balance and account, and stock, cost of goods and pending
  grams per variety, captured before archiving, after archiving and after restoring: 0
  differences.
- **Out of every list and picker (criterion 9)**: front and API tests show an archived
  variety absent from Variedades' list and summary line, Lo que te queda, Nueva venta's,
  the stock entry form's and the price form's choices, the catalog text, its "what does
  not go out" list and the pinned catalog's text; upkeep edits the pin on archive and
  restore exactly when the text changes. 100% passing.
- **Comes back whole (criterion 11)**: after restoring, prices, stock, entries,
  threshold, catalog attributes and the hidden flag (tested hidden and shown) equal what
  they were before archiving. 100% passing.
- **Names**: an archived variety's name, in any case or spacing, is refused on add and on
  rename with its own code; a deleted variety's name is accepted at once.
- **Nothing new**: a new sale line, stock entry or price entry against an archived variety
  is refused as gone; an entry edit keeps its own archived variety and is refused moving
  onto another archived one; editing and deleting that entry, deleting a sale containing
  it (Deshacer included) and Asignar cliente still work.
- **Findable (criterion 13)**: "Archivadas (N)" shows the right count and is absent with
  none; restore takes 1 tap from the card and from the archived page; the archived page
  offers no action but "Restaurar".
- **Taps (criterion 9)**: through the front on a phone viewport, archiving or deleting
  takes the action plus its confirmation from the variety's page; a computer takes no
  more.
- **Isolation (criterion 14)**: another business's variety or entry, archived or not,
  opened by id shows "Eso ya no está."; every route, delete, archive and restore
  included, is in the sweep and the gated-route test; after a full front run, the console
  and browser storage hold no names or amounts, and no refusal or toast carries a name or
  an amount.
- **Design**: `scripts/design/compare.sh` runs before and after for the list, the page,
  Archivadas and the archived page, phone and computer, both themes, attached to the PR
  and judged by eye. The PR lists the two agreed departures from the drawing (the
  "Editar" forms of Aviso de stock bajo and En el catálogo).
- **Speed**: Variedades answers in under 300 ms with a few dozen varieties.

## Out of scope

- The rules of catalog attributes: the catalog capability (they are edited here).
- The rules of stock withdrawals: the stock capability (they are started and seen here).
- Deleting a variety with history, by any path.
- Deleting an archived variety without restoring it first.
- Refusing an archive because the variety has no history.
- Merging varieties, or taking over an archived variety's name.
- Deleting, archiving or restoring several varieties at once; archiving or deleting from
  the list itself.
- An "archivada" tag on past records.
- Moving a stock entry onto an archived variety.
- Live updates between partners while a screen is open.
- Configuración and its groups.
- Editing catalog attributes or the threshold in place, without a form and a save.
