# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, Más, Configuración, the one rule that gives every screen its chrome and its way back, which place is marked, the routes and their redirects, and the first run. It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

## Jobs

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often: record a sale, see who owes and collect, send the catalog, record incoming stock. Each should be one or two taps away. Everything about one variety should be in one place, every business setting in one other place, and expenses and analysis within reach for the weekly or monthly look. **So I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need.

This is the navigation job underneath every capability's own "from my phone" job (sales, payments, stock, catalog, expenses). It replaces none of them. The computer is the same job on a bigger screen. The protagonist is the seller; the operator's tools stay outside the app (accounts.md).

**When** I'm on my phone between orders or mid-chat with a customer, several times a day, **I want** every screen to sit in one fixed place, with the bar or sidebar showing where I am, the same way back everywhere, and my saved links and home-screen shortcut still working, **so I can** reach a sale, a payment, the catalog, a stock entry or an expense in one or two taps and get back to the customer without hunting through menus.

This refines the navigation job above for the structure itself (the bar, the sidebar, the chrome and back rule, the marks and the English routes with their redirects); it is not a new job. The computer is the same job through the sidebar, never with more taps than the phone.

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it.

Configuración is rare and deliberate; the daily jobs never need it. It refines the navigation job's "every business setting in one other place". Settings that belong to one variety live on its page and are not part of this job. Before it, settings were split across Negocio (name, partners, password), Catálogo (bot, header and footer) and Gastos → Categorías, and the dark theme could not be chosen in the app.

Before this structure:

- the bar was Inicio · Ventas · Clientes · Stock · Más;
- one variety was split across Stock, Variedades and Catálogo;
- collecting a debt took four taps from Clientes;
- settings were split across Negocio, Catálogo and Gastos → Categorías, and the bot was configured inside Catálogo;
- paths were in Spanish, and a computer had no sidebar.

Nothing of it is kept but the redirects from its paths.

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ Nueva venta");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Clientes → "Cobrar", or "Cobrar" on Inicio directly);
   - the catalog screen opens in at most 2 taps (Variedades → "Mandar catálogo");
   - a stock entry opens in at most 2 taps (Variedades → "+ Entrada de stock");
   - an expense opens in at most 2 taps (Más → "+ Cargar gasto").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.**
   - Name, users and join links, the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Configuración and nowhere else.
   - Configuración is reachable in at most 2 taps from any tab root: from the business avatar on Inicio and from Más on the phone, and from the sidebar's business row on a computer.
   - Settings that belong to one variety live on the variety, and nowhere else.
3. **One variety, one page.** A variety's stock and entries, prices, low-stock warning and catalog attributes are seen and edited from its page. No fact is edited in two places under two names.
4. **Nothing lost, nothing invented.**
   - Everything a seller could do before stays reachable. The one deliberate exception is the customer channel, which is removed.
   - No navigation entry or screen exists for something not yet built: no "coming soon", no promotions, automations or languages.
5. **One rule for chrome, back and marks.**
   - Every screen is one of three kinds: tab root, card or detail, form or sheet. Each kind gets its chrome by the rule.
   - Back follows history, and the named parent is the fallback.
   - Leaving a form or sheet with unsaved changes asks first, by any way out, and an untouched one closes at once.
   - A screen's mark and its "‹ <parent>" label come from its place in the structure, never from how it was reached.
6. **Readable and accessible.**
   - Tab labels are always visible.
   - The active tab and every state are marked by shape or word, never color alone, with `aria-current` on the active place.
   - The bar fits at 320 px with text at 130 %.
7. **One structure, said once.** The product docs, CONTEXT.md, the design (`docs/product/design-system/pantallas/`, phone and computer) and `scripts/design/screens.json` state the same structure and routes.
8. **Configuración, group by group.**
   - Each group is its own subscreen with "Cerrar"; leaving with unsaved changes asks first, and an untouched group closes at once.
   - All of these work from the phone: renaming, "Invitá a un socio", the bot (token, chats, Probarlo), the header and footer, categories (add, rename, remove, the refused removal included), Apariencia, changing the password and logging out.
   - The end-to-end front run goes through every group.
9. **Every address opens its screen.**
   - On a browser navigation (reload, saved link, home-screen shortcut), every English path opens the app on that screen, details with an id included. It never shows JSON or a 401. Signed out, it goes to Entrar.
   - Every old Spanish path redirects permanently to its English route, keeping ids and query, tested one by one.
   - An unknown address goes to Inicio.

## Behaviour

### Tabs (phone)

- **The bar**: Inicio · Ventas · Clientes · Variedades · Más, in that order. Tabs are objects, chosen by how often they are used.
- **The fixed "+ Nueva venta"** button sits apart from the tabs and opens the sale form directly (sales.md). It is not a tab.
- **Labels** are always visible; no tab is an icon alone.
- **The active tab** is marked by more than color (a filled icon or an underline) and carries `aria-current` on the element.
- **Fit**: the bar, "Variedades" included, fits at 320 px viewport width with text at 130 %.

### Sidebar (computer)

- From the top: "+ Nueva venta"; Inicio, Ventas, Clientes, Variedades; a divider; Gastos, Análisis.
- At the bottom: the business's name with its avatar, which opens Configuración (as `InicioCompu` draws it).
- There is no Más on a computer.
- **Two panes**: Clientes and Variedades show the list on the left and the selected customer's card or variety's page on the right.

### Más (phone)

- In order: "+ Cargar gasto" (it opens the expense form with today's date, expenses.md), Gastos, Análisis, Configuración.
- "+ Cargar gasto" is on top because it is the only load with no shorter path.
- Nothing else: an entry appears only once what it opens exists.

### Configuración

- **One screen holding every business-wide setting, in groups, and nothing else.** The groups, in this order (each group's behaviour belongs to its owner):
  - **Negocio**: the business's name (accounts.md). Toast "Negocio renombrado".
  - **Usuarios**: the partners by email, sorted by email, the signed-in one marked "vos", and "Invitá a un socio", which creates one fresh join link per tap, to copy or share (accounts.md). No list of invitations, no revoking, no roles.
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
- **Reached from**: the business avatar at the top of Inicio; Más on the phone; the sidebar's business row on a computer.
- **The list of groups** is a card: the bar or sidebar and a back arrow, no "+ Nueva venta". Its parent is Más on the phone ("‹ Más") and Inicio on a computer ("‹ Inicio"). Back follows history, and with none goes to that parent.
- **Each group** is its own subscreen, a form: "Cerrar", no bar, no "+ Nueva venta". Unsaved changes ask before discarding, and an untouched group closes at once. Apariencia never has unsaved changes, so it always closes at once.
- **Empty business**: every group works.
  - Usuarios lists at least the signed-in user.
  - Categorías de gastos with none shows an empty list and the add action.
  - Integraciones with nothing saved shows empty fields and no "Guardado" line.
- **Never here**:
  - a variety's own settings (catalog attributes, low-stock threshold), which live only on its page (varieties.md);
  - anything for the operator (ADR-0002);
  - a group or placeholder for anything not built.
- **Nowhere else**:
  - the old Negocio screen is gone;
  - the catalog screen edits no header or footer: its "Editar encabezado y pie" opens Mensaje del catálogo;
  - Gastos has no categories entry, apart from creating one inside the expense form (expenses.md).

### Chrome and back: one rule

Every screen is exactly one of three kinds, and gets its chrome only from its kind.

- **Tab root**: Inicio, Ventas, Clientes, Variedades, Gastos, Análisis and Más.
  - It shows the bar (or the sidebar) and "+ Nueva venta".
  - Gastos and Análisis are reached from Más on the phone and from the sidebar on a computer.
- **Card or detail**: a customer's card, a variety's page, a sale's detail, an expense, a stock entry, the catalog screen, "Todas las entradas", every "Ver todas" list of a variety's page, and Configuración's list of groups.
  - It shows the bar (or the sidebar) and a "‹ <parent>" back arrow.
  - **The arrow names the screen's parent**, fixed by the screen's place in the structure, whatever screen opened it. A customer's card reads "‹ Clientes" even when opened from Inicio's teaser, and the catalog screen reads "‹ Variedades" even when opened from Inicio's notice. A reload or a saved link shows the same label.
  - **Tapping the arrow, like the device's back, follows the app's history**: from a customer's card opened on Inicio, it returns to Inicio. Only with no history (a link opened directly, a reload with nothing before it) does it go to the parent the arrow names.
  - It never shows "+ Nueva venta". A customer's card carries only "Nueva venta a <name>".
- **Form or sheet**: Nueva venta and Elegir cliente, Registrar cobro, the stock entry form, the price entry form, the expense form, a variety's add and rename, and every Configuración group.
  - It shows neither the bar nor "+ Nueva venta". It closes with "Cerrar".
  - **Leaving it with unsaved changes asks before discarding**, by every way out: "Cerrar", the browser or phone back button and the swipe all ask the same fixed question.
    - Nueva venta keeps its own "¿Descartás la venta?" ("No, seguí cargando" / "Sí, descartala"), sales.md.
    - Every other form or sheet asks with its own fixed wording.
  - An untouched form or sheet leaves at once.
  - With no history (a direct link), a form leaves to the fallback its capability defines (the expense form goes to Gastos on the current month), or to its parent.
- **Back**, from any card, detail, form or sheet, follows the app's history. With no history, it goes to the parent: the one named by "‹", or the form's own fallback.

### Which place is marked

- **A tab root** marks its own tab on the phone, or its own sidebar entry on a computer.
- **A card or detail** marks the tab of its parent (the one its "‹ <parent>" names), whatever screen opened it:
  - a customer's card marks Clientes, even when opened from Inicio's teaser;
  - a sale's detail marks Ventas;
  - the catalog screen and a variety's page mark Variedades, even when the catalog screen opens from Inicio's notice.

  The mark never depends on history, so a reload or a saved link keeps it.
- **A form or sheet** shows no bar, so it marks nothing.
- **On the phone**: Gastos, Análisis and Configuración (its list, and as parent of its groups) mark Más. `/settings` marks Más.
- **On a computer**: Gastos and Análisis mark their own sidebar entries. Configuración marks the sidebar's business row.
- **Every mark** is shown by more than color and carries `aria-current`.

### Routes

- **Every screen's route is in English**: `/sales`, `/sales/new`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/more`, and the same for every other screen.
  - The exact path of each screen, each Configuración group included, is fixed in the `path` column of `scripts/design/screens.json`.
  - The catalog screen's route is under Variedades (`/varieties/catalog`, as `screens.json` fixes it). It keeps its preview, Compartir, Copiar, the pin's status and Publicar.
- **Every path opens the app.** On a browser navigation (reload, saved link, home-screen shortcut), every path in the `path` column opens the app on that screen, details with an id included (`/sales/{id}`, `/customers/{id}`, `/varieties/{id}`).
  - It never shows JSON or a 401 page.
  - A signed-out navigation goes to Entrar.
  - How the front and the API share those first segments is governed by ADR-0024.
- **Old Spanish paths redirect permanently** to their new route, each tested one by one.
  - The whole path is mapped, ids and sub-screens included, and the query string is kept: for example `/ventas/nueva` → `/sales/new`, `/ventas/{id}` → `/sales/{id}`, `/mi-stock/nueva-entrada` → `/varieties/entries/new`.
  - The redirects cover exactly the old paths listed here and in `screens.json`:
    - `/ventas`, `/clientes`, `/mi-stock`, `/variedades`, `/analisis`, `/gastos`, `/mas` and `/catalogo`, with their sub-paths;
    - `/negocio` → Configuración;
    - `/gastos/categorias` → Configuración → Categorías de gastos;
    - the old Te deben screen's path → Clientes.
  - The old Catálogo had no separate paths for the bot or the header and footer, so nothing redirects to Integraciones or Mensaje del catálogo.
  - An old link to a record that is gone, or that belongs to another business, lands on the English route and shows "Eso ya no está." with its "Volver a …" button (accounts.md).
- **Unknown addresses**: an unknown or mistyped address goes to Inicio (`/`), as it always has. A later task that removes a path with no counterpart decides where that path goes.
- **Routes kept out of this structure**:
  - no route carries a business (ADR-0004);
  - `/invitation/{token}` and `/reset/{token}` stay as they are (accounts.md).
- Screen text stays in Rioplatense Spanish; only the routes change.

### Routes for screens still to be rebuilt

This covers Configuración and its groups, the catalog screen and a variety's page, whose screens their own issues rebuild.

- A route shows the existing screen or content that holds that function today, inside the new chrome. For example, `/settings/users` shows today's users list and "Invitá a un socio".
- A route with nothing existing behind it is not registered. The issue that builds that screen adds it.
- No route renders an empty page, a placeholder or "coming soon".
- Every function a seller reaches today stays reachable from some registered route. If a function would lose its only way in, its route is registered with today's content.

### First-run checklist

- **The steps**, each worked out from the business's data at the moment, never from a stored tick:
  1. a variety with a current price today (required);
  2. any stock entry (required);
  3. the pinned catalog published at least once (optional);
  4. a second user in the business (optional).
- A met step shows its box checked and the word "Hecho", never color alone.
- **Who sees it**: a business that has not yet met both required steps. The optional steps never hold it on screen; they stay reachable in Configuración (Integraciones, Usuarios).
- **When it goes**: for good, the first time steps 1 and 2 are both met.
  - It never comes back, even if a required step's condition later becomes false again (say, the only price entry is deleted).
  - Ongoing gaps are told by the standing notices: "Arrancá por las variedades" and the pinned catalog's out-of-date notice.
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
- Serving a front path to a browser navigation never widens what the API answers to a JSON request, and adds no API route (ADR-0024).
- Whatever decides the checklist and the after-import notice is answered by the server for the session's business only.
- No business id in a URL; no personal data or money in the console or browser storage (accounts.md). The theme choice is the only thing kept on the device.
- Feedback follows accounts.md, in Configuración as everywhere:
  - no network shows "Sin conexión";
  - a server error shows a generic retry;
  - a record that is gone follows the "Eso ya no está." rule.

## Metrics

- **Tap budget (criterion 1)**: through the front, the end-to-end run counts the taps to open each of these, from each tab root at phone and computer viewports. 100% within budget.
  - the sale form: 1;
  - Registrar cobro with the customer chosen, from Clientes and from Inicio: ≤2;
  - the catalog screen: ≤2;
  - the stock entry form: ≤2;
  - the expense form: ≤2.
- **Settings in one place (criterion 2)**:
  - every business-wide setting named in the product docs sits in exactly one Configuración group and on no other screen;
  - the catalog screen edits no header or footer, Gastos has no categories entry, and the old Negocio screen does not exist;
  - every per-variety setting sits only on the variety's page;
  - Configuración opens in ≤2 taps from every tab root, phone and computer.
- **One fact, one place (criterion 3)**: no price, stock entry, threshold or catalog attribute is editable from two screens, checked against the docs and the design.
- **Nothing lost, nothing invented (criterion 4)**:
  - every action a seller had before the redesign maps to a place in the new structure, except the customer channel;
  - the bar, the sidebar, Más and Configuración show exactly the entries listed above, with no placeholder group;
  - no registered route renders an empty page or "coming soon".
- **Chrome (criterion 5)**: every screen in the docs and in `scripts/design/screens.json` is classified as exactly one kind. Front tests check its chrome:
  - tab roots: the bar and "+ Nueva venta";
  - cards: "‹ <parent>" and no "+ Nueva venta";
  - forms and sheets: neither, and a confirmation on an unsaved leave.

  Back with no history goes to the parent; from Configuración's list, to Más on the phone and to Inicio on a computer.
- **Back by history, label by parent (criterion 5)**: front tests show:
  - a customer's card opened from Inicio's teaser reads "‹ Clientes", and its arrow and the device's back both return to Inicio;
  - the catalog screen opened from Inicio's notice reads "‹ Variedades" and returns to Inicio;
  - the same card opened directly by its address reads "‹ Clientes" and goes to Clientes.
- **Leaving (criterion 5)**: on a form with unsaved changes, "Cerrar", browser back and the swipe give the same question. An untouched form leaves at once. With no history, forms go to their capability's fallback or their parent.
- **Marks (criteria 5, 6)**: front tests show:
  - a detail marks its parent's tab when opened from another screen, after a reload and from a saved link;
  - Gastos, Análisis and Configuración mark Más on the phone;
  - on a computer, Gastos and Análisis mark their own entries and Configuración marks the business row;
  - every mark carries `aria-current` and a non-color mark.
- **Accessible bar (criterion 6)**: a front test at 320 px with text at 130 % shows every tab label whole. The active tab carries `aria-current` and a non-color mark, and no state is told by color alone.
- **Configuración (criterion 8)**:
  - front tests:
    - every group has "Cerrar" and no bar;
    - unsaved changes ask, and an untouched group closes at once;
    - Apariencia shows no save, toast or warning;
  - Integraciones shows the link to the catalog screen, no pin status and no Publicar, and the "desfijalo vos en Telegram" line after a token or channel change;
  - one end-to-end front run from a phone viewport:
    - renames the business and creates a join link;
    - runs Probarlo and follows the link to the catalog screen;
    - edits the header and footer;
    - adds, renames and removes a category, a refused removal included;
    - switches Apariencia, changes the password and logs out.
- **First-run matrix**: 100% passing, phone and computer:
  - a new business sees the checklist, and each met step shows "Hecho";
  - it goes the first time steps 1 and 2 are both met, whatever 3 and 4;
  - deleting the only price entry afterwards never brings it back;
  - an imported business never sees it, and sees the after-import notice until dismissed or published;
  - "Mandar catálogo" is disabled only while the checklist shows and nothing qualifies.
- **Redirects (criterion 9)**: every old Spanish path answers a permanent redirect to its English route, keeping ids and query, tested one by one. That includes `/negocio`, `/gastos/categorias`, the old Te deben path and `/catalogo`, which goes to the catalog screen with its preview, Compartir, Copiar, status and Publicar. A gone or foreign id shows "Eso ya no está.", and an unknown address goes to Inicio.
- **Reload (criterion 9)**: for every path in `screens.json`, a browser navigation opens the app on that screen, never JSON or a 401; signed out, it goes to Entrar. A JSON request to the same path still reaches the API unchanged.
- **Look**: `scripts/design/compare.sh` runs before and after the structure is built, with the comparisons attached to the PR and judged by eye against `pantallas/`.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes, and the e2e specs use the English routes. Zeta approves the pull request that states them.

## Out of scope

- English screen texts (#53); a language entry.
- Rebuilding each area's screens (#45–#49, Configuración's groups): their routes show today's content until then.
- Any operator or admin surface in the app; roles; listing or revoking invitations.
- A tour or welcome screen.
- Promotions, automations, languages, and any entry for them before they exist.
- A "follow the system" theme.
- The pin's status or Publicar in Integraciones.
- Per-variety settings in Configuración (#47).
- A redirect rule for removed paths with no counterpart; changing where unknown addresses go.
- Marks or "‹ <parent>" labels that depend on how a screen was reached.
- A back arrow that ignores history.
- Changing the copy of any existing unsaved-changes question.
- Live updates between partners.
