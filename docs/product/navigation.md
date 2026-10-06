# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, Más, Configuración, the one rule that gives every screen its chrome and its way back, the routes, and the first run. It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

## Jobs

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often: record a sale, see who owes and collect, send the catalog, record incoming stock. Each should be one or two taps away. Everything about one variety should be in one place, every business setting in one other place, and expenses and analysis within reach for the weekly or monthly look. **So I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need.

This is the navigation job underneath every capability's own "from my phone" job (sales, payments, stock, catalog, expenses). It replaces none of them. The computer is the same job on a bigger screen. The protagonist is the seller; the operator's tools stay outside the app (accounts.md).

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page, the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell.

This refines the navigation job for varieties, stock and the catalog (varieties.md); it is not a new job.

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it.

Configuración is rare and deliberate; the daily jobs never need it. It refines the navigation job's "every business setting in one other place". Settings that belong to one variety live on its page and are not part of this job. Before it, settings were split across Negocio (name, partners, password), Catálogo (bot, header and footer) and Gastos → Categorías, and the dark theme could not be chosen in the app.

Before this structure: the bar was Inicio · Ventas · Clientes · Stock · Más; one variety was split across Stock, Variedades and Catálogo; collecting a debt took four taps from Clientes; settings were split across Negocio, Catálogo and Gastos → Categorías, and the bot was configured inside Catálogo. Nothing of it is kept but the redirects from its paths, and, until Configuración's Integraciones and Mensaje del catálogo exist, the temporary place for the bot and the header and footer reached from the catalog screen (catalog.md).

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ Nueva venta");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Clientes → "Cobrar", or "Cobrar" on Inicio directly);
   - the catalog screen opens in at most 2 taps (Variedades → "Mandar catálogo");
   - a stock entry opens in at most 2 taps (Variedades → "+ Entrada de stock");
   - an expense opens in at most 2 taps (Más → "+ Cargar gasto").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.** Name, users and join links, the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Configuración and nowhere else. Configuración is reachable in at most 2 taps from any tab root: from the business avatar on Inicio and from Más on the phone, from the sidebar's business row on a computer. Settings that belong to one variety live on the variety, and nowhere else. The one temporary exception is the bot and the header and footer, reached from the catalog screen until their Configuración groups exist.
3. **One variety, one page.** A variety's stock and entries, prices, low-stock warning and catalog attributes are seen and edited from its page. No fact is edited in two places under two names.
4. **Nothing lost, nothing invented.** Everything a seller could do before stays reachable. The one deliberate exception is the customer channel, which is removed. No navigation entry or screen exists for something not yet built: no "coming soon", no promotions, automations or languages. No link points at a screen that does not exist.
5. **One rule for chrome and back.** Every screen is one of three kinds: tab root, card or detail, form or sheet. Each kind gets its chrome by the rule. Back follows history, and the parent screen is the fallback.
6. **Readable and accessible.** Tab labels are always visible. The active tab and every state are marked by shape or word, never color alone. The bar fits at 320 px with text at 130 %.
7. **One structure, said once.** The product docs, CONTEXT.md, the design (`docs/product/design-system/pantallas/`, phone and computer) and `scripts/design/screens.json` state the same structure and routes.
8. **Configuración, group by group.** Each group is its own subscreen with "Cerrar"; leaving with unsaved changes asks first, an untouched group closes at once. Renaming, "Invitá a un socio", the bot (token, chats, Probarlo), the header and footer, categories (add, rename, remove, the refused removal included), Apariencia, changing the password and logging out all work from the phone, and the end-to-end front run goes through every group.

## Behaviour

### Tabs (phone)

- **The bar**: Inicio · Ventas · Clientes · Variedades · Más, in that order. Tabs are objects, chosen by how often they are used.
- **The fixed "+ Nueva venta"** button sits apart from the tabs and opens the sale form directly (sales.md). It is not a tab.
- **Labels** are always visible; no tab is an icon alone.
- **The active tab** is marked by more than color: a filled icon or an underline, and `aria-current` on the element.
- **Fit**: the bar, "Variedades" included, fits at 320 px viewport width with text at 130 %.

### Sidebar (computer)

- From the top: "+ Nueva venta"; Inicio, Ventas, Clientes, Variedades; a divider; Gastos, Análisis.
- At the bottom: the business's name with its avatar, which opens Configuración (as `InicioCompu` draws it).
- There is no Más on a computer.
- **Two panes**: Clientes and Variedades show the list on the left and the selected customer's card or variety's page on the right. Variedades opened with nothing selected selects the first variety by name (varieties.md); that counts as no tap.

### Más (phone)

- In order: "+ Cargar gasto" (it opens the expense form with today's date, expenses.md), Gastos, Análisis, Configuración.
- "+ Cargar gasto" is on top because it is the only load with no shorter path.
- Nothing else: an entry appears only once what it opens exists.

### Configuración

- **One screen holding every business-wide setting, in groups, and nothing else.** The groups, in this order (each group's behaviour belongs to its owner):
  - **Negocio**: the business's name (accounts.md). Toast "Negocio renombrado".
  - **Usuarios**: the partners by email, sorted by email, the signed-in one marked "vos", and "Invitá a un socio", which creates one fresh join link per tap, to copy or share (accounts.md). No list of invitations, no revoking, no roles.
  - **Integraciones**: the Telegram bot: token, channel chat, own chat, and Probarlo, the only way they are saved (pinned-catalog.md). After a token or channel change, "El mensaje fijado anterior queda como está; desfijalo vos en Telegram." A plain link to the catalog screen, for publishing, carrying no status. Publicar and the pin's status are only on the catalog screen.
  - **Mensaje del catálogo**: the catalog's header and footer (catalog.md). Toast "Catálogo guardado".
  - **Categorías de gastos**: add, rename and remove, the refused removal included (expenses.md).
  - **Apariencia**: the theme, Claro or Oscuro (accounts.md's theme rule: Oscuro sets `data-tema="oscuro"`, Claro removes it). A tap applies and remembers the choice on the device at once: no save, no toast, no unsaved-changes warning. The current choice is marked by word or shape and `aria-checked`, never color alone. Language has no entry until it exists.
  - **Tu cuenta**: "Cambiar contraseña" above "Cerrar sesión" (accounts.md). Nothing new.
- **Reached from**: the business avatar at the top of Inicio; Más on the phone; the sidebar's business row on a computer. `/settings` marks Más as the active tab on the phone.
- **The list of groups** is a card: the bar or sidebar and a back arrow, no "+ Nueva venta". Back follows history; with none, it goes to "‹ Más" on the phone and "‹ Inicio" on a computer.
- **Each group** is its own subscreen, a form: "Cerrar", no bar, no "+ Nueva venta"; unsaved changes ask before discarding, an untouched group closes at once. Apariencia never has unsaved changes, so it always closes at once.
- **Empty business**: every group works. Usuarios lists at least the signed-in user; Categorías de gastos with none shows an empty list and the add action; Integraciones with nothing saved shows empty fields and no "Guardado" line.
- **Never here**: a variety's own settings (catalog attributes, low-stock threshold), which live only on its page (varieties.md); anything for the operator (ADR-0002); a group or placeholder for anything not built.
- **Nowhere else**: the old Negocio screen is gone; the catalog screen edits no header or footer (its "Editar encabezado y pie" opens Mensaje del catálogo); Gastos has no categories entry, apart from creating one inside the expense form (expenses.md).
- **Temporary exception, until Integraciones and Mensaje del catálogo exist**: the bot settings and the header and footer stay editable, exactly as before, in one temporary place reached only from the catalog screen ("Editar encabezado y pie" and Publicar's "unavailable" link). It is a form ("Cerrar" back by history, else to the catalog screen; confirmation on unsaved leave), with no tab, Más entry, Configuración group or "coming soon" mark, and no pin status or Publicar. The catalog screen itself still edits nothing; it links out. Configuración's own issue retargets both links and removes the temporary place.

### Chrome and back: one rule

Every screen is exactly one of three kinds, and gets its chrome only from its kind.

- **Tab root**: Inicio, Ventas, Clientes, Variedades, Gastos, Análisis and Más. It shows the bar (or the sidebar) and "+ Nueva venta". Gastos and Análisis are reached from Más on the phone and from the sidebar on a computer.
- **Card or detail**: a customer's card, a variety's page, a sale's detail, an expense, a stock entry, the catalog screen, "Todas las entradas", every "Ver todas" list of a variety's page, and Configuración's list of groups.
  - It shows the bar (or the sidebar) and a "‹ <parent>" back arrow naming the screen it returns to.
  - It never shows "+ Nueva venta". A customer's card carries only "Nueva venta a <name>".
- **Form or sheet**: Nueva venta and Elegir cliente, Registrar cobro, the stock entry form, the price entry form, the expense form, a variety's add and rename, every Configuración group, and the temporary place for the bot and the header and footer while it exists.
  - It shows neither the bar nor "+ Nueva venta". It closes with "Cerrar".
  - Leaving it with unsaved changes asks before discarding. Nueva venta keeps its own "¿Descartás la venta?" (sales.md); every other form or sheet asks the same way with its own fixed wording.
  - An untouched form or sheet closes at once.
- **Back** follows the app's history. With no history (a link opened directly), it goes to the parent named by "‹".

### Routes

- Every screen's route is in English: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/more`, and the same for every other screen. The exact path of each screen, each Configuración group included, is fixed in `scripts/design/screens.json`.
- **Variedades** and its screens: `/varieties`, `/varieties/{low}`, `/varieties/catalog` (the catalog screen), `/varieties/entries`, `/varieties/entries/new`, `/varieties/{low}/prices`, `/varieties/{low}/prices/new` and `/varieties/new`. A reload on any of them opens the screen, never the API's answer; paths that share their first segment with the API are served under ADR-0024.
- Every old Spanish path redirects permanently to its new route, each tested one by one:
  - `/ventas`, `/clientes`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/variedades`, `/catalogo`, `/gastos`, `/mas`, and every other one, including the old Te deben screen's path, which goes to Clientes;
  - `/negocio` goes to Configuración;
  - the old Gastos → Categorías path (`/gastos/categorias`) goes to Configuración → Categorías de gastos.
- The old Catálogo had no separate paths for the bot or the header and footer, so nothing redirects to Integraciones or Mensaje del catálogo.
- An unknown or mistyped address goes to Inicio (`/`), as it always has. A later task that removes a path with no counterpart decides where that path goes.
- No route carries a business (ADR-0004). `/invitation/{token}` and `/reset/{token}` stay as they are (accounts.md).
- Screen text stays in Rioplatense Spanish; only the routes change.

### First-run checklist

- **The steps**, each worked out from the business's data at the moment, never from a stored tick:
  1. a variety with a current price today (required);
  2. any stock entry (required);
  3. the pinned catalog published at least once (optional);
  4. a second user in the business (optional).
- A met step shows its box checked and the word "Hecho", never color alone.
- **Who sees it**: a business that has not yet met both required steps. The optional steps never hold it on screen; they stay reachable in Configuración (Integraciones, Usuarios).
- **When it goes**: for good, the first time steps 1 and 2 are both met. It never comes back, even if a required step's condition later becomes false again (say, the only price entry is deleted). Ongoing gaps are told by the standing notices: "Arrancá por las variedades" and the pinned catalog's out-of-date notice.
- **Where**: at the top of Inicio, on the phone and on `InicioCompu` alike (results.md gives Inicio's order).
- **While it shows**:
  - with no variety priced today, "+ Nueva venta" stays visible and says in words what is missing;
  - while nothing qualifies for the catalog, "Mandar catálogo" is disabled with its reason in words (e.g. "Cargá una variedad con precio y su stock"). This is the only time it is ever disabled (catalog.md). Integraciones' link to the catalog screen is never disabled.
- **An imported business** arrives with prices and stock, so it never sees the checklist.
- The checklist and the after-import notice are the only first-run elements: no tour, no welcome screen.

### After-import notice

- A business loaded by the spreadsheet import (import.md) shows, on Inicio, "Conectá el bot para que el catálogo fijado se actualice solo".
- It shows until the seller dismisses it or the pinned catalog is first published, whichever comes first, and then never again.

### Constraints

- Nothing here adds a route that answers business data; each screen reads its owner's routes, already in the isolation sweep and the gated-route test.
- Whatever decides the checklist and the after-import notice is answered by the server for the session's business only.
- No business id in a URL; no personal data or money in the console or browser storage (accounts.md). The theme choice is the only thing kept on the device.
- No network shows "Sin conexión", a server error a generic retry, and a record that is gone follows accounts.md's "Eso ya no está." rule, in Configuración as everywhere.

## Metrics

- **Tap budget (criterion 1)**: through the front, from each tab root, phone and computer viewports, the end-to-end run counts the taps to open: the sale form (1), Registrar cobro with the customer chosen from Clientes and from Inicio (≤2), the catalog screen (≤2), the stock entry form (≤2) and the expense form (≤2). 100% within budget.
- **Settings in one place (criterion 2)**: every business-wide setting named in the product docs sits in exactly one Configuración group and on no other screen; the catalog screen edits no header or footer, Gastos has no categories entry, and the old Negocio screen does not exist; every per-variety setting sits only on the variety's page. Configuración opens in ≤2 taps from every tab root, phone and computer. While the temporary place stands in for Integraciones and Mensaje del catálogo, it is reached only from the catalog screen and from no tab, Más or Configuración entry.
- **One fact, one place (criterion 3)**: no price, stock entry, threshold or catalog attribute is editable from two screens, checked against the docs and the design.
- **Nothing lost, nothing invented (criterion 4)**: every action a seller had before the redesign maps to a place in the new structure, except the customer channel; the bar, the sidebar, Más and Configuración show exactly the entries listed above, with no placeholder group; no link points at a missing screen.
- **Chrome (criterion 5)**: every screen in the docs and in `scripts/design/screens.json` is classified as exactly one kind, and front tests check its chrome: tab roots with the bar and "+ Nueva venta", cards with "‹ <parent>" and no "+ Nueva venta", forms and sheets with neither and a confirmation on unsaved leave. Back with no history goes to the parent; from Configuración's list, to Más on the phone and Inicio on a computer.
- **Accessible bar (criterion 6)**: a front test at 320 px with text at 130 % shows every tab label whole; the active tab carries `aria-current` and a non-color mark; no state is told by color alone.
- **Configuración (criterion 8)**:
  - front tests: every group has "Cerrar" and no bar; unsaved changes ask; an untouched group closes at once; Apariencia shows no save, toast or warning;
  - Integraciones shows the link to the catalog screen, no pin status and no Publicar, and the "desfijalo vos en Telegram" line after a token or channel change;
  - one end-to-end front run from a phone viewport renames the business, creates a join link, runs Probarlo and follows the link to the catalog screen, edits the header and footer, adds, renames and removes a category (a refused removal included), switches Apariencia, changes the password and logs out.
- **First-run matrix**: 100% passing, phone and computer:
  - a new business sees the checklist; each met step shows "Hecho";
  - it goes the first time steps 1 and 2 are both met, whatever 3 and 4;
  - deleting the only price entry afterwards never brings it back;
  - an imported business never sees it and sees the after-import notice until dismissed or published;
  - "Mandar catálogo" is disabled only while the checklist shows and nothing qualifies.
- **Redirects**: every old Spanish path that has moved answers a permanent redirect to its English route, tested one by one, including `/negocio`, `/gastos/categorias`, `/catalogo` and `/mi-stock/nueva-entrada`.
- **Reloads under `/varieties`**: a browser navigation to each Variedades route, parameterised ones included, opens the screen, never the API's answer; the front's own API calls still reach the API.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes; Zeta approves the pull request that states them.

## Out of scope

- English screen texts (#53); a language entry.
- Any operator or admin surface in the app; roles; listing or revoking invitations.
- A tour or welcome screen.
- Promotions, automations, languages, and any entry for them before they exist.
- A "follow the system" theme.
- The pin's status or Publicar in Integraciones.
- Per-variety settings in Configuración (#47).
- A redirect rule for removed paths with no counterpart; changing where unknown addresses go.
- Live updates between partners.
