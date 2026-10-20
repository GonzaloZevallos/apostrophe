# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, Más, Configuración, the one rule that gives every screen its chrome and its way back, which place is marked, the routes and their redirects, and the first run (the Onboarding for a brand-new business, the first-run checklist for a business that existed before it, the after-import notice for an imported one). It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

## Jobs

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often: record a sale, see who owes and collect, send the catalog, record incoming stock. Each should be one or two taps away. Everything about one variety should be in one place, every business setting in one other place, and expenses and analysis within reach for the weekly or monthly look. **So I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need.

This is the navigation job underneath every capability's own "from my phone" job (sales, payments, stock, catalog, expenses). It replaces none of them. The computer is the same job on a bigger screen. The protagonist is the seller; the operator's tools stay outside the app (accounts.md).

**When** I open the app between orders or at the end of the day, **I want** to see what I sold today, who owes me and what is running out, and act on it at once (collect from a debtor, open a variety that is running low, fix what a notice tells me), **so I can** get back to the customer without going through Clientes and Variedades one by one or doing any arithmetic.

This refines the navigation job and results.md's panel job for Inicio (GH-45); it is not a new job. Served here by "Collect" on Inicio's debtor rows, the first-run checklist and the after-import notice, each leading to its fix.

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page, the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell.

This refines the navigation job for varieties, stock and the catalog (varieties.md); it is not a new job.

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again.

This refines the varieties and navigation job for the end of a variety's life (varieties.md); it is not a new job. Served here by the Archivadas card and the archived variety's page.

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it.

Configuración is rare and deliberate; the daily jobs never need it. It refines the navigation job's "every business setting in one other place". Settings that belong to one variety live on its page and are not part of this job.

**When** I move between screens between orders or mid-chat with a customer (Variedades and a variety's page, its prices and entries, a stock entry, a customer's card, Registrar cobro), **I want** every screen to give me the same way out and back, and my old links to still open the right screen, **so I can** get back to the customer without hunting, losing my place or tapping back twice.

This refines the navigation job and criterion 5; it is not a new job. Its protagonist is the seller, on the phone or a computer. Before it, the stock entry form said "Volver" where every other form said "Close", a record that was gone left its parent twice in history so back took two taps, and Variedades and old paths behaved differently from the rest of the app on reload and redirect. The seller tapped back again or used the bar.

**When** I take grams out of my own stock without selling them (to share at a party so people get to know the business, or for my own use), **I want** to record them from my phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right and see in Profit what promoting the business and my own consumption cost me, without recording a sale nobody made or an adjustment that reads as lost flower. (Served here by "Sacar del stock" in Más, on Variedades and on a variety's page, at most 2 taps from any tab root; defined in stock.md.)

**When** I have just opened my business and it is still empty, **I want** to be walked through what it needs, one short step at a time, with defaults already filled in, **so I can** record my first sale the same day without hunting through Configuración, Variedades and the catalog screen. (Served here by the Onboarding as a brand-new business's one first-run element, opened on accepting the invitation and from Inicio's notice; defined in onboarding.md.)

Choosing which pricing rules the business uses (pricing-settings.md) belongs in Configuración too, as the Precios group.

Before this structure: the bar was Inicio · Ventas · Clientes · Stock · Más; one variety was split across Stock, Variedades and Catálogo; collecting a debt took four taps from Clientes; settings were split across Negocio, Catálogo and Gastos → Categorías, and the bot was configured inside Catálogo. Nothing of it is kept but the redirects from its paths, and, until Configuración's Integraciones and Mensaje del catálogo exist, the temporary place for the bot and the header and footer reached from the catalog screen (catalog.md).

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ New sale");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Clientes → "Collect", or "Collect" on Inicio directly);
   - the catalog screen opens in at most 2 taps (Variedades → "Send catalog");
   - a stock entry opens in at most 2 taps (Variedades → "+ Entrada de stock");
   - a stock withdrawal opens in at most 2 taps (Más → "Sacar del stock", or Variedades → "Sacar del stock");
   - an expense opens in at most 2 taps (Más → "+ Add expense").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.** Name, users and join links, the pricing rules (Precio por cantidad and Clientes VIP), the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Configuración and nowhere else. Configuración is reachable in at most 2 taps from any tab root: from the business avatar on Inicio and from Más on the phone, from the sidebar's business row on a computer. Settings that belong to one variety live on the variety, and nowhere else. The one temporary exception is the bot and the header and footer, reached from the catalog screen until their Configuración groups exist. The Onboarding's steps save these same settings through their owners and are not a second place for them (onboarding.md).
3. **One variety, one page.** A variety's stock and its movements (entries and withdrawals), prices, low-stock warning and catalog attributes are seen and edited from its page. No fact is edited in two places under two names.
4. **Nothing lost, nothing invented.** Everything a seller could do before stays reachable. The one deliberate exception is the customer channel, which is removed. No navigation entry or screen exists for something not yet built: no "coming soon", no promotions, automations or languages. No link points at a screen that does not exist.
5. **One rule for chrome and back.** Every screen is one of three kinds: tab root, card or detail, form or sheet. Each kind gets its chrome by the rule. Back follows history, and the parent screen is the fallback.
6. **Readable and accessible.** Tab labels are always visible. The active tab and every state are marked by shape or word, never color alone. The bar fits at 320 px with text at 130 %, measured in a real browser.
7. **One structure, said once.** The product docs, CONTEXT.md, the design (`docs/product/design-system/pantallas/`, phone and computer) and `scripts/design/screens.json` state the same structure and routes.
8. **Configuración, group by group.** Each group is its own subscreen with "Close"; leaving with unsaved changes asks first, an untouched group closes at once. Renaming, "Invite a partner", the pricing switches, the bot (token, chats, Probarlo), the header and footer, categories (add, rename, remove, the refused removal included), Apariencia, changing the password and logging out all work from the phone, and the end-to-end front run goes through every group.
9. **Chrome by kind, everywhere.** Every screen, the Variedades screens included (the two-pane list, a variety's page, its "Ver todas" lists of prices and entries, Nuevo precio, Nueva variedad, "Todas las entradas" and the stock entry form), is exactly one kind with a parent. The stock entry form reads "Close", never "Volver".
10. **One move back.** Back or "Close" leaves a screen in one tap and never lands on the same screen twice in history, the "That's gone." exits and Registrar cobro included. With no history, back goes to the screen the form, sheet or card belongs to.
11. **Every address opens its screen.** A reload on any Variedades route, parameterised ones included, opens the screen and never the API's answer. Every old Spanish path, `/variedades/{id}` and `/mi-stock/entradas/{id}` included, answers a permanent redirect to its new route with the id carried across.
12. **First run, one element at a time.** A brand-new business gets the Onboarding notice; only a business that existed before the Onboarding shipped sees the first-run checklist; an imported business sees the dismissable after-import notice; never two first-run elements at once, and each leads to its fix.

## Behaviour

### Tabs (phone)

- **The bar**: Inicio · Ventas · Clientes · Variedades · Más, in that order. Tabs are objects, chosen by how often they are used.
- **The fixed "+ New sale"** button sits apart from the tabs and opens the sale form directly (sales.md). It is not a tab.
- **Labels** are always visible; no tab is an icon alone.
- **The active tab** is marked by more than color: a filled icon or an underline, and `aria-current` on the element.
- **Fit**: the bar, "Variedades" included, fits at 320 px viewport width with text at 130 %, measured in a real browser.

### Sidebar (computer)

- From the top: "+ New sale"; Inicio, Ventas, Clientes, Variedades; a divider; Gastos, Análisis.
- At the bottom: the business's name with its avatar, which opens Configuración (as `InicioCompu` draws it).
- There is no Más on a computer. The withdrawal form is reached from Variedades' secondary "Sacar del stock" and from a variety's page.
- **Two panes**: Clientes and Variedades show the list on the left and the selected customer's card or variety's page on the right. Variedades opened with nothing selected selects the first unarchived variety by name (varieties.md); that counts as no tap. Archivadas uses the same two panes, selecting the first archived variety by name. Clientes selects nothing on its own.
- **Two panes and history**: on a computer, picking a row in the left pane replaces the current history entry, and so does Variedades' automatic selection of its first variety. Back from either screen leaves it in one step, never once per row looked at. On the phone, opening a variety or a customer pushes an entry, and back returns to the list.

### Más (phone)

- In order: "+ Add expense" (it opens the expense form with today's date, expenses.md), "Sacar del stock" (it opens the stock withdrawal form with today's date and no variety chosen, stock.md), Gastos, Análisis, Configuración.
- "+ Add expense" and "Sacar del stock" are on top because they are the loads with no shorter path from every tab root.
- Nothing else: an entry appears only once what it opens exists. There is no entry for the Onboarding.

### Configuración

- **One screen holding every business-wide setting, in groups, and nothing else.** The groups, in this order (each group's behaviour belongs to its owner):
  - **Negocio**: the business's name (accounts.md). Toast "Negocio renombrado".
  - **Usuarios**: the partners by email, sorted by email, the signed-in one marked "vos", and "Invite a partner", which creates one fresh join link per tap, to copy or share (accounts.md). No list of invitations, no revoking, no roles.
  - **Precios** (pricing-settings.md), at `/settings/prices`:
    - the two switches, Precio por cantidad and Clientes VIP;
    - "Guardá los precios", and the toast "Precios guardados";
    - the fixed line that past sales keep their price and switching off deletes nothing, and the fixed help line under the VIP switch.
  - **Integraciones**: the Telegram bot (pinned-catalog.md):
    - the token, the channel chat, the own chat, and Probarlo, the only way they are saved;
    - after a token or channel change, "El mensaje fijado anterior queda como está; desfijalo vos en Telegram.";
    - a plain link to the catalog screen, for publishing, carrying no status. Publicar and the pin's status are only on the catalog screen.
  - **Mensaje del catálogo**: the catalog's header and footer (catalog.md). Toast "Catálogo guardado".
  - **Categorías de gastos**: add, rename and remove, the refused removal included (expenses.md).
  - **Apariencia**: the theme, Claro or Oscuro, under accounts.md's theme rule (Oscuro sets `data-tema="oscuro"`, Claro removes it).
    - A tap applies and remembers the choice on the device at once: no save, no toast, no unsaved-changes warning.
    - The current choice is marked by word or shape and `aria-checked`, never color alone.
    - Language has no entry until it exists.
  - **Tu cuenta**: "Cambiar contraseña" above "Cerrar sesión" (accounts.md). Nothing new.
- **Reached from**: the business avatar at the top of Inicio; Más on the phone; the sidebar's business row on a computer. `/settings` marks Más as the active tab on the phone.
- **The list of groups** is a card: the bar or sidebar and a back arrow, no "+ New sale". Back follows history; with none, it goes to "‹ More" on the phone and "‹ Home" on a computer.
- **Each group** is its own subscreen, a form: "Close", no bar, no "+ New sale"; unsaved changes ask before discarding, an untouched group closes at once. Apariencia never has unsaved changes, so it always closes at once.
- **Empty business**: every group works. Usuarios lists at least the signed-in user; Precios shows both switches as they stand (off for a new business); Categorías de gastos with none shows an empty list and the add action; Integraciones with nothing saved shows empty fields and no "Guardado" line.
- **Never here**: a variety's own settings (catalog attributes, low-stock threshold, its prices, its VIP price included) or its archiving, which live only on its page and in Archivadas (varieties.md); anything for the operator (ADR-0002); a group or placeholder for anything not built; an entry to run the Onboarding again.
- **Nowhere else**: the old Negocio screen is gone; the catalog screen edits no header or footer (its "Editar encabezado y pie" opens Mensaje del catálogo); Gastos has no categories entry, apart from creating one inside the expense form (expenses.md); the pricing switches are reached from no variety page, price form or customer form. The Onboarding's steps save the same settings through their owners, never a copy (onboarding.md).
- **Temporary exception, until Integraciones and Mensaje del catálogo exist**: the bot settings and the header and footer stay editable, exactly as before, in one temporary place reached only from the catalog screen ("Editar encabezado y pie" and Publicar's "unavailable" link). It is a form ("Close" back by history, else to the catalog screen; confirmation on unsaved leave), with no tab, Más entry, Configuración group or "coming soon" mark, and no pin status or Publicar. The catalog screen itself still edits nothing; it links out. Configuración's own issue retargets both links and removes the temporary place.

### Chrome and back: one rule

Every screen is exactly one of three kinds, has one parent, and gets its chrome only from its kind.

- **Tab root**: Inicio, Ventas, Clientes, Variedades, Gastos, Análisis and Más. It shows the bar (or the sidebar) and "+ New sale". Gastos and Análisis are reached from Más on the phone and from the sidebar on a computer.
- **Card or detail**: a customer's card, a variety's page, an archived variety's page ("‹ Archivadas"), the Archivadas card ("‹ Variedades"), a sale's detail, an expense, a stock withdrawal's detail, the catalog screen, "Todas las entradas", every "Ver todas" list of a variety's page (its entries and withdrawals, and its prices), and Configuración's list of groups.
  - It shows the bar (or the sidebar) and a "‹ <parent>" back arrow naming the screen it returns to. A withdrawal's detail returns to the screen it was opened from, and to Variedades with no history.
  - It never shows "+ New sale". A customer's card carries only "Nueva venta a <name>".
- **Form or sheet**: Nueva venta and Elegir cliente, Registrar cobro, the customer form (new, `/customers/new`, and editing, `/customers/{id}/edit`), the stock entry form (new or editing, `/varieties/entries/{id}`), the stock withdrawal form ("Sacar del stock", new or editing), the price entry form, the expense form, a variety's add and rename, a variety's low-stock warning form and catalog attributes form, every Configuración group, every Onboarding step and its closing screen "All set", and the temporary place for the bot and the header and footer while it exists.
  - It shows neither the bar nor "+ New sale". It closes with "Close", never another word such as "Volver".
  - Leaving it with unsaved changes asks before discarding. Nueva venta keeps its own "¿Descartás la venta?" (sales.md); every other form or sheet asks the same way with its own fixed wording.
  - An untouched form or sheet closes at once.
  - The Onboarding's "Close" lands on Inicio and keeps its resume point; Nueva venta opened from "All set" goes back to Inicio, never to "All set" or the Onboarding (onboarding.md).
- **Back** follows the app's history and leaves in one move; it never lands on the same screen twice. With no history (a link opened directly), it goes to the parent named by "‹", or for a form or sheet to the screen it belongs to:

| Screen | Back with no history goes to |
|---|---|
| Nueva variedad | Variedades |
| Nuevo precio | that variety's page |
| Stock entry form, new | Variedades |
| Stock entry form, editing | "Todas las entradas" |
| Customer form, new | Clientes |
| Customer form, editing | that customer's card |
| Registrar cobro | Clientes |
| A variety's "Ver todas" of prices or entries | the variety's page |
| "Todas las entradas" | Variedades |
| Stock withdrawal form, new | Variedades |
| Stock withdrawal form, editing | that withdrawal's detail |
| A withdrawal's detail | Variedades |
| Archivadas | Variedades |
| An archived variety's page | Archivadas |
| An Onboarding step or "All set" | Inicio |

- **A gone exit is the same move as "Close".** When saving, deleting or undoing in the stock entry form, the customer form or Registrar cobro hits a record that no longer exists, the screen goes back one step in history when it was opened from inside the app, or to its parent when it was opened by a direct link. The list refreshes and "That's gone. The list is up to date." shows, as accounts.md defines it. No history entry is ever duplicated.
- **"Collect from <name>"** on a debtor row (Clientes or Inicio) opens Registrar cobro with that customer chosen, as an entry in the app's history; back or "Close" closes it in one move, back to the screen it came from.

### Routes

- Every screen's route is in English: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/settings/prices`, `/more`, and the same for every other screen. The stock withdrawal form is `/withdrawals/new` (and `/withdrawals/{id}/edit`), a withdrawal's detail `/withdrawals/{id}`. Every screen is registered once, with its kind and its parent, in `scripts/design/screens.json`, which fixes its exact path; each Configuración group, each Onboarding step and "All set" are included, as are `/customers/new`, `/customers/{id}/edit` and `/varieties/entries/{id}`.
- **Variedades** and its screens: `/varieties`, `/varieties/{id}`, `/varieties/catalog` (the catalog screen), `/varieties/entries` ("Todas las entradas"), `/varieties/entries/new`, `/varieties/entries/{id}` (editing a stock entry), `/varieties/{id}/entries` (a variety's entries, the same list filtered to it, with the withdrawals that touch it, "‹ <variety>"), `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/new` and `/varieties/archived` (the Archivadas card). A variety's page is read-only when the variety is archived. `{id}` is the variety's or entry's own id. A reload on any of them opens the screen, never the API's answer, and the front's own API calls still reach the API.
- Every old Spanish path redirects permanently to its new route, each tested one by one, with a record's id carried across:
  - `/ventas`, `/clientes`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/mi-stock/entradas/{id}` (to `/varieties/entries/{id}`), `/variedades`, `/variedades/{id}` (to `/varieties/{id}`), `/catalogo`, `/gastos`, `/mas`, and every other one, including the old Te deben screen's path, which goes to Clientes;
  - `/negocio` goes to Configuración;
  - the old Gastos → Categorías path (`/gastos/categorias`) goes to Configuración → Categorías de gastos.
- Every redirect target is a registered screen. The server answers every old path through one redirect mechanism; the front has no redirects of its own.
- The old Catálogo had no separate paths for the bot or the header and footer, so nothing redirects to Integraciones or Mensaje del catálogo. Precios is new, so nothing redirects to it.
- An unknown or mistyped address goes to Inicio (`/`), as it always has. An Onboarding path opened for a business whose Onboarding is over, or that never had one, goes to Inicio too. A later task that removes a path with no counterpart decides where that path goes.
- No route carries a business (ADR-0004); a record's own id in a path is allowed. `/invitation/{token}` and `/reset/{token}` stay as they are (accounts.md).
- Screen text is English (`app-text.md`); the routes are English too, and the old Spanish paths redirect.

### Routes for screens still to be rebuilt

This covers Configuración and its groups, the catalog screen and a variety's page, whose screens their own issues rebuild.

- A route shows the existing screen or content that holds that function today, inside the new chrome. For example, `/settings/users` shows today's users list and "Invite a partner".
- A route with nothing existing behind it is not registered. The issue that builds that screen adds it.
- No route renders an empty page, a placeholder or "coming soon".
- Every function a seller reaches today stays reachable from some registered route. If a function would lose its only way in, its route is registered with today's content.

### First run

- **Three first-run elements, each for its own business, never two at once**:
  - **the Onboarding**, for a business opened by a new-business invitation after it shipped (onboarding.md);
  - **the first-run checklist**, for a business that existed before the Onboarding shipped;
  - **the after-import notice**, for a business loaded by the spreadsheet import. Once the import loads a business, its Onboarding is over.
- There is no tour and no welcome screen beyond these.
- **First-run state belongs to the business.** Every user of it sees the same element: a user who joined by a join invitation sees whatever the business they joined has, or none. A join invitation never opens a business, so it never starts a first run of its own.
- **What is stored**: the Onboarding's own state (ADR-0036) is never copied. Beyond it, only three facts of the business are kept:
  1. that the business was loaded by the spreadsheet import, and when. Only the import writes it, inside its single commit, and it is never cleared or moved (import.md). A business imported before this fact existed has none, and is not backfilled;
  2. that the checklist has gone for good;
  3. that the after-import notice was dismissed.

  None of them holds personal data. No checklist step is ever stored as ticked.
- Which element shows, and each checklist step, is answered by the server for the session's business.

### The Onboarding (first run of a brand-new business)

- **Entry**: accepting a new-business invitation lands in the Onboarding instead of Inicio. That is the only time it opens by itself.
- **The Inicio notice**: while it is not over, "Keep going with setup" sits at the top of Inicio, on the phone and on `InicioCompu`, in the checklist's place (results.md gives Inicio's order). It shows "N of 6 steps" and what is next, opens the Onboarding at its resume step, and cannot be dismissed.
- **While it is not over**, the checklist and "Start with varieties" do not show.
- **It adds no side rule**: "+ New sale" and "Send catalog" behave as for any business. What is missing is told by the notice, by Nueva venta's own no-price line before saving and by the catalog screen's empty state.
- **Once it is over** ("All set" reached, or the import loaded the business), it never shows again; ongoing gaps are told by the standing notices.
- Its steps, passes, resume and closing screen are onboarding.md.

### First-run checklist (businesses that existed before the Onboarding)

- **The steps**, each worked out from the business's data at the moment, never from a stored tick:
  1. a variety with a current price today (required);
  2. any stock entry (required);
  3. the pinned catalog published at least once (optional);
  4. a second user in the business (optional).
- A met step shows its box checked and the word "Done", never color alone. The step labels are design's wording, within the icon and text rule's length limits; the checklist carries no attention icon.
- **Who sees it**: a business that existed before the Onboarding shipped and has not yet met both required steps, and every user of it. A brand-new business gets the Onboarding instead and never sees the checklist. The optional steps never hold it on screen; they stay reachable in Configuración (Integraciones, Usuarios).
- **When it goes**: for good, the first time steps 1 and 2 are both met.
  - It never comes back, even if a required step's condition later becomes false again (say, the only price entry is deleted).
  - Ongoing gaps are told by the standing notices: "Start with varieties" and the pinned catalog's out-of-date notice.
- **Where**: at the top of Inicio, on the phone and on `InicioCompu` alike (results.md gives Inicio's order). While it applies, it takes the first-run slot, and "Start with varieties" does not show.
- **While it shows**:
  - "+ New sale" stays visible and, with no variety priced today, says in words what is missing;
  - while nothing qualifies for the catalog, "Send catalog" is disabled with its reason in words (e.g. "Cargá una variedad con precio y su stock"). This is the only time it is ever disabled (catalog.md). Integraciones' link to the catalog screen is never disabled.
- **An imported business** arrives with prices and stock, so it never sees the checklist.

### After-import notice

- A business the spreadsheet import loaded (import.md), as recorded by the import itself, shows on Inicio "Connect the bot so the pinned catalog updates itself", with the attention icon (icon-and-text-rule.md).
- It can be dismissed. It shows until it is dismissed or the pinned catalog is first published, whichever comes first, and then never again. A dismissal is for the business: no partner sees it afterwards.
- A business imported before the import recorded it never sees the notice.

### Constraints

- Nothing here adds a route that answers business data beyond what Inicio's panel and the first-run state need; each screen reads its owner's routes, already in the isolation sweep and the gated-route test. The Onboarding's own routes, and any route for the first-run state (the import fact, the checklist's end, the after-import notice's dismissal), join both, and that state carries `business_id` and is exported and deleted by business removal (ADR-0015).
- Serving a front path to a browser navigation never widens what the API answers to a JSON request, and adds no API route (ADR-0024).
- Whatever decides the Onboarding notice, the checklist and the after-import notice is answered by the server for the session's business only.
- No business id in a URL; no personal data or money in the console or browser storage (accounts.md). The theme choice is the only thing kept on the device; the first-run facts are kept on the server, never in the browser.
- Feedback follows accounts.md, in Configuración, the Onboarding and Inicio as everywhere:
  - no network shows "No connection: check your internet and try again.";
  - a server error shows a generic retry;
  - a record that is gone follows the "That's gone." rule.

## Metrics

- **Tap budget (criterion 1)**: through the front, from each tab root, phone and computer viewports, the end-to-end run counts the taps to open: the sale form (1), Registrar cobro with the customer chosen from Clientes and from Inicio (≤2), the catalog screen (≤2), the stock entry form (≤2), the stock withdrawal form (≤2) and the expense form (≤2). 100% within budget.
- **Settings in one place (criterion 2)**: every business-wide setting named in the product docs sits in exactly one Configuración group and on no other screen, the pricing switches included; the catalog screen edits no header or footer, Gastos has no categories entry, and the old Negocio screen does not exist; every per-variety setting sits only on the variety's page. Configuración and Precios open in ≤2 taps from every tab root, phone and computer. While the temporary place stands in for Integraciones and Mensaje del catálogo, it is reached only from the catalog screen and from no tab, Más or Configuración entry. The Onboarding's steps write through the owners' routes, and a value saved there reads the same in Configuración.
- **One fact, one place (criterion 3)**: no price, stock entry, withdrawal, threshold or catalog attribute is editable from two screens, checked against the docs and the design. A stock entry is edited through its one form, `/varieties/entries/{id}`, whichever list it was opened from.
- **Nothing lost, nothing invented (criterion 4)**: every action a seller had before the redesign, and everything reachable on master or on #59, maps to a place in the new structure, except the customer channel; the bar, the sidebar, Más and Configuración show exactly the entries listed above, with no placeholder group and no Onboarding entry; no link points at a missing screen. #47's end-to-end specs and #118's test waits pass without being edited to fit.
- **Chrome (criteria 5, 9)**: every screen in the docs and in `scripts/design/screens.json` is classified as exactly one kind with a parent, the Onboarding's steps and "All set" included, and front tests check its chrome: tab roots with the bar and "+ New sale", cards with "‹ <parent>" and no "+ New sale", forms and sheets with neither, "Close" and a confirmation on unsaved leave. The stock entry form reads "Close", never "Volver"; the customer form shows "Close".
- **One move back (criterion 10)**:
  - each gone exit (stock entry form, customer form, Registrar cobro), opened from its parent, leaves history holding the parent once, and one back leaves; opened by a direct link, it goes to the named parent;
  - each row of the back-with-no-history table is tested one by one; back with no history from Configuración's list goes to Más on the phone and Inicio on a computer; from a withdrawal's detail, to Variedades; from an archived variety's page, to Archivadas; from Archivadas, to Variedades; from the Onboarding, to Inicio;
  - on a computer, picking rows in Variedades' and Clientes' two panes, and Variedades' auto-selected first variety, leave back at one step; on the phone, opening a record pushes an entry;
  - tapping "Collect from <name>" on a Clientes row and on an Inicio row opens Registrar cobro with the customer chosen, carries the in-app history state, and back closes it in one move.
- **Accessible bar (criterion 6)**: a Playwright test at 320 px with text at 130 % shows every tab label whole; the active tab carries `aria-current` and a non-color mark; no state is told by color alone.
- **Configuración (criterion 8)**:
  - front tests:
    - every group has "Close" and no bar;
    - unsaved changes ask, and an untouched group closes at once;
    - Apariencia shows no save, toast or warning;
  - Precios sits after Usuarios and before Integraciones, at `/settings/prices`;
  - Integraciones shows the link to the catalog screen, no pin status and no Publicar, and the "desfijalo vos en Telegram" line after a token or channel change;
  - one end-to-end front run from a phone viewport:
    - renames the business and creates a join link;
    - switches and saves Precios;
    - runs Probarlo and follows the link to the catalog screen;
    - edits the header and footer;
    - adds, renames and removes a category, a refused removal included;
    - switches Apariencia, changes the password and logs out.
- **First-run matrix, the Onboarding**: 100% passing, phone and computer:
  - a brand-new business lands in the Onboarding on accepting its invitation and sees "Keep going with setup" while it is not over, never with "Start with varieties";
  - while it runs, "+ New sale" and "Send catalog" behave as for any business;
  - a pre-existing business and an imported business (including one that landed in the Onboarding before the import) never see it; a user who joins a business mid-Onboarding sees the same notice.
- **First-run matrix, the checklist and the after-import notice (criterion 12)**: 100% passing, phone and computer:
  - a business that existed before the Onboarding sees the checklist, and each met step shows "Done";
  - it goes the first time steps 1 and 2 are both met, whatever 3 and 4;
  - deleting the only price entry afterwards never brings it back;
  - an imported business never sees it, and sees the after-import notice until dismissed or published; once dismissed, no partner sees it;
  - a business that finished the Onboarding through "All set" never sees the after-import notice, and neither does a business imported before the import fact existed;
  - a joined user sees their business's element, or none;
  - two first-run elements never show at once;
  - "Send catalog" is disabled only while the checklist shows and nothing qualifies.
- **First-run state isolated**: its routes are in the sweep and the gated-route test; business removal leaves 0 rows of it and exported count = deleted count.
- **Redirects (criterion 11)**: every old Spanish path that has moved answers a permanent redirect to its English route, tested one by one, including `/negocio`, `/gastos/categorias`, `/catalogo`, `/mi-stock/nueva-entrada`, and `/variedades/{id}` and `/mi-stock/entradas/{id}` with the id carried across. A test shows every redirect target is a `screens.json` path, with no exemption. There is one redirect mechanism, on the server, and none in the front.
- **Reloads under `/varieties` (criterion 11)**: a browser navigation to each Variedades route, parameterised ones included (`/varieties/{id}`, `/varieties/{id}/entries`, `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/entries/{id}`) and `/varieties/archived`, opens the screen, never the API's answer; the front's own API calls still reach the API.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes, the withdrawal form and detail, the Archivadas card, the archived variety's page, Precios, the Onboarding's screens and Inicio's first-run states included; Zeta approves the pull request that states them.
- **Design**: `scripts/design/compare.sh` runs before and after for the stock entry form, the customer form, Nueva venta and Inicio (phone and computer, both themes), attached to the PR and judged by eye; `NuevaVentaCompu` comes out unchanged; any difference from the design is listed in the PR.

## Out of scope

- English screen texts (#53); a language entry.
- Rebuilding each area's screens (#45–#49, Configuración's groups): their routes show today's content until then.
- Any operator or admin surface in the app; roles; listing or revoking invitations.
- A tour or welcome screen beyond the Onboarding.
- An entry to run the Onboarding again.
- Side rules on "+ New sale" or "Send catalog" tied to the Onboarding.
- A checklist for a brand-new business; storing a checklist step as ticked.
- Backfilling the import fact for a business imported before it existed.
- Promotions (as campaigns or offers), automations, languages, and any entry for them before they exist. A stock withdrawal for promotion is a stock record, not this.
- A "follow the system" theme.
- The pin's status or Publicar in Integraciones.
- Per-variety settings in Configuración (#47).
- An Archivadas entry in the bar, the sidebar, Más or Configuración: it is reached only from Variedades.
- A redirect rule for removed paths with no counterpart; changing where unknown addresses go.
- Marks or "‹ <parent>" labels that depend on how a screen was reached.
- A back arrow that ignores history.
- Changing the copy of any existing unsaved-changes question.
- Live updates between partners.
- A way into Precios from a variety's page, the price form or the customer form.
- Redirects in the front; a second redirect mechanism.
- Auto-selecting a customer on Clientes' two panes.
- Any token, wording or layout change to a screen beyond what the chrome rule gives it.
- A business-wide list of stock withdrawals.
