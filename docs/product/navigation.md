# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, Más, Configuración, the one rule that gives every screen its chrome and its way back, the routes, and the first run. It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

## Jobs

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often: record a sale, see who owes and collect, send the catalog, record incoming stock. Each should be one or two taps away. Everything about one variety should be in one place, every business setting in one other place, and expenses and analysis within reach for the weekly or monthly look. **So I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need.

This is the navigation job underneath every capability's own "from my phone" job (sales, payments, stock, catalog, expenses). It replaces none of them. The computer is the same job on a bigger screen. The protagonist is the seller; the operator's tools stay outside the app (accounts.md).

Before this structure: the bar was Inicio · Ventas · Clientes · Stock · Más; one variety was split across Stock, Variedades and Catálogo; collecting a debt took four taps from Clientes; settings were split across Negocio, Catálogo and Gastos → Categorías, and the bot was configured inside Catálogo. Nothing of it is kept but the redirects from its paths.

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ Nueva venta");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Clientes → "Cobrar", or "Cobrar" on Inicio directly);
   - the catalog screen opens in at most 2 taps (Variedades → "Mandar catálogo");
   - a stock entry opens in at most 2 taps (Variedades → "+ Entrada de stock");
   - an expense opens in at most 2 taps (Más → "+ Cargar gasto").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.** Name, users and join links, the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Configuración and nowhere else. Configuración is reachable in at most 2 taps from any tab root. Settings that belong to one variety live on the variety, and nowhere else.
3. **One variety, one page.** A variety's stock and entries, prices, low-stock warning and catalog attributes are seen and edited from its page. No fact is edited in two places under two names.
4. **Nothing lost, nothing invented.** Everything a seller could do before stays reachable. The one deliberate exception is the customer channel, which is removed. No navigation entry or screen exists for something not yet built: no "coming soon", no promotions, automations or languages.
5. **One rule for chrome and back.** Every screen is one of three kinds: tab root, card or detail, form or sheet. Each kind gets its chrome by the rule. Back follows history, and the parent screen is the fallback.
6. **Readable and accessible.** Tab labels are always visible. The active tab and every state are marked by shape or word, never color alone. The bar fits at 320 px with text at 130 %.
7. **One structure, said once.** The product docs, CONTEXT.md, the design (`docs/product/design-system/pantallas/`, phone and computer) and `scripts/design/screens.json` state the same structure and routes.

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
- **Two panes**: Clientes and Variedades show the list on the left and the selected customer's card or variety's page on the right.

### Más (phone)

- In order: "+ Cargar gasto" (it opens the expense form with today's date, expenses.md), Gastos, Análisis, Configuración.
- "+ Cargar gasto" is on top because it is the only load with no shorter path.
- Nothing else: an entry appears only once what it opens exists.

### Configuración

- **One screen holding every business-wide setting, in groups, and nothing else.** Each group's behaviour belongs to its owner:
  - **Negocio**: the business's name (accounts.md).
  - **Usuarios**: the partners by email, the signed-in one marked "vos", and "Invitá a un socio", which creates one fresh join link per tap (accounts.md). No list of invitations, no revoking, no roles.
  - **Integraciones**: the Telegram bot: token, channel chat, own chat, and Probarlo (pinned-catalog.md). Publicar and the pin's status are on the catalog screen.
  - **Mensaje del catálogo**: the catalog's header and footer (catalog.md).
  - **Categorías de gastos**: add, rename and remove (expenses.md).
  - **Apariencia**: the theme, Claro or Oscuro (accounts.md's theme rule: Oscuro sets `data-tema="oscuro"`). Language has no entry until it exists.
  - **Tu cuenta**: "Cambiar contraseña" and "Cerrar sesión" (accounts.md). Nothing new.
- **Reached from**: the business avatar at the top of Inicio; Más on the phone; the sidebar's business row on a computer. `/settings` marks Más as the active tab on the phone.
- **Never here**: a variety's own settings (catalog attributes, low-stock threshold), which live only on its page (varieties.md); anything for the operator (ADR-0002); a group or placeholder for anything not built.

### Chrome and back: one rule

Every screen is exactly one of three kinds, and gets its chrome only from its kind.

- **Tab root**: Inicio, Ventas, Clientes, Variedades, Gastos, Análisis and Más. It shows the bar (or the sidebar) and "+ Nueva venta". Gastos and Análisis are reached from Más on the phone and from the sidebar on a computer.
- **Card or detail**: a customer's card, a variety's page, a sale's detail, an expense, a stock entry, the catalog screen, "Todas las entradas", every "Ver todas" list of a variety's page, and Configuración's list of groups.
  - It shows the bar (or the sidebar) and a "‹ <parent>" back arrow naming the screen it returns to.
  - It never shows "+ Nueva venta". A customer's card carries only "Nueva venta a <name>".
- **Form or sheet**: Nueva venta and Elegir cliente, Registrar cobro, the stock entry form, the price entry form, the expense form, a variety's add and rename, and every Configuración group.
  - It shows neither the bar nor "+ Nueva venta". It closes with "Cerrar".
  - Leaving it with unsaved changes asks before discarding. Nueva venta keeps its own "¿Descartás la venta?" (sales.md); every other form or sheet asks the same way with its own fixed wording.
  - An untouched form or sheet closes at once.
- **Back** follows the app's history. With no history (a link opened directly), it goes to the parent named by "‹".

### Routes

- Every screen's route is in English: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/more`, and the same for every other screen. The exact path of each screen is fixed in `scripts/design/screens.json`.
- Every old Spanish path redirects permanently to its new route: `/ventas`, `/clientes`, `/mi-stock`, `/variedades`, `/catalogo`, `/negocio`, `/gastos`, `/mas`, and every other one, including the old Te deben screen's path, which goes to Clientes.
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
  - while nothing qualifies for the catalog, "Mandar catálogo" is disabled with its reason in words (e.g. "Cargá una variedad con precio y su stock"). This is the only time it is ever disabled (catalog.md).
- **An imported business** arrives with prices and stock, so it never sees the checklist.
- The checklist and the after-import notice are the only first-run elements: no tour, no welcome screen.

### After-import notice

- A business loaded by the spreadsheet import (import.md) shows, on Inicio, "Conectá el bot para que el catálogo fijado se actualice solo".
- It shows until the seller dismisses it or the pinned catalog is first published, whichever comes first, and then never again.

### Constraints

- Nothing here adds a route that answers business data; each screen reads its owner's routes, already in the isolation sweep and the gated-route test.
- Whatever decides the checklist and the after-import notice is answered by the server for the session's business only.
- No business id in a URL; no personal data or money in the console or browser storage (accounts.md).

## Metrics

- **Tap budget (criterion 1)**: through the front, from each tab root, phone and computer viewports, the end-to-end run counts the taps to open: the sale form (1), Registrar cobro with the customer chosen from Clientes and from Inicio (≤2), the catalog screen (≤2), the stock entry form (≤2) and the expense form (≤2). 100% within budget.
- **Settings in one place (criterion 2)**: every business-wide setting named in the product docs sits in exactly one Configuración group and on no other screen; every per-variety setting sits only on the variety's page. Configuración opens in ≤2 taps from every tab root.
- **One fact, one place (criterion 3)**: no price, stock entry, threshold or catalog attribute is editable from two screens, checked against the docs and the design.
- **Nothing lost, nothing invented (criterion 4)**: every action a seller had before the redesign maps to a place in the new structure, except the customer channel; the bar, the sidebar, Más and Configuración show exactly the entries listed above.
- **Chrome (criterion 5)**: every screen in the docs and in `scripts/design/screens.json` is classified as exactly one kind, and front tests check its chrome: tab roots with the bar and "+ Nueva venta", cards with "‹ <parent>" and no "+ Nueva venta", forms and sheets with neither and a confirmation on unsaved leave. Back with no history goes to the parent.
- **Accessible bar (criterion 6)**: a front test at 320 px with text at 130 % shows every tab label whole; the active tab carries `aria-current` and a non-color mark; no state is told by color alone.
- **First-run matrix**: 100% passing, phone and computer:
  - a new business sees the checklist; each met step shows "Hecho";
  - it goes the first time steps 1 and 2 are both met, whatever 3 and 4;
  - deleting the only price entry afterwards never brings it back;
  - an imported business never sees it and sees the after-import notice until dismissed or published;
  - "Mandar catálogo" is disabled only while the checklist shows and nothing qualifies.
- **Redirects**: every old Spanish path answers a redirect to its English route, tested one by one.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes; Zeta approves the pull request that states them.

## Out of scope

- English screen texts (#53).
- Any operator or admin surface in the app; roles; listing or revoking invitations.
- A tour or welcome screen.
- Promotions, automations, languages, and any entry for them before they exist.
- A "follow the system" theme.
- Live updates between partners.
