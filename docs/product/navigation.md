# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, More, Settings, the one rule that gives every screen its chrome and its way back, which place is marked, the routes and their redirects, and the first run (the Onboarding for a brand-new business, the first-run checklist for a business that existed before it, the after-import notice for an imported one). It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

## Jobs

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often: record a sale, see who owes and collect, send the catalog, record incoming stock. Each should be one or two taps away. Everything about one variety should be in one place, every business setting in one other place, and expenses and analysis within reach for the weekly or monthly look. **So I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need.

This is the navigation job underneath every capability's own "from my phone" job (sales, payments, stock, catalog, expenses). It replaces none of them. The computer is the same job on a bigger screen. The protagonist is the seller; the operator's tools stay outside the app (accounts.md).

**When** I open the app between orders or at the end of the day, **I want** to see what I sold today, who owes me and what is running out, and act on it at once (collect from a debtor, open a variety that is running low, fix what a notice tells me), **so I can** get back to the customer without going through Customers and Varieties one by one or doing any arithmetic.

This refines the navigation job and results.md's panel job for Home (GH-45); it is not a new job. Served here by "Collect" on Home's debtor rows, the first-run checklist and the after-import notice, each leading to its fix.

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page, the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell.

This refines the navigation job for varieties, stock and the catalog (varieties.md); it is not a new job.

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again.

This refines the varieties and navigation job for the end of a variety's life (varieties.md); it is not a new job. Served here by the Archived card and the archived variety's page.

**When** I need to change how my business is set up (rename it, bring in a partner, connect or switch the Telegram bot, edit the catalog's header and footer, manage my expense categories, switch to dark, change my password or log out), **I want** every business-wide setting in one place, each in its own short screen, **so I can** change it in a few taps from my phone and get back to the customer, without wondering which screen holds it.

Settings is rare and deliberate; the daily jobs never need it. It refines the navigation job's "every business setting in one other place". Settings that belong to one variety live on its page and are not part of this job.

**When** I move between screens between orders or mid-chat with a customer (Varieties and a variety's page, its prices and entries, a stock entry, a customer's card, Record payment), **I want** every screen to give me the same way out and back, and my old links to still open the right screen, **so I can** get back to the customer without hunting, losing my place or tapping back twice.

This refines the navigation job and criterion 5; it is not a new job. Its protagonist is the seller, on the phone or a computer. Before it, the stock entry form said "Back" where every other form said "Close", a record that was gone left its parent twice in history so back took two taps, and Varieties and old paths behaved differently from the rest of the app on reload and redirect. The seller tapped back again or used the bar.

**When** I take grams out of my own stock without selling them (to share at a party so people get to know the business, or for my own use), **I want** to record them from my phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right and see in Profit what promoting the business and my own consumption cost me, without recording a sale nobody made or an adjustment that reads as lost flower. (Served here by "Take from stock" in More, on Varieties and on a variety's page, at most 2 taps from any tab root; defined in stock.md.)

**When** I have just opened my business and it is still empty, **I want** to be walked through what it needs, one short step at a time, with defaults already filled in, **so I can** record my first sale the same day without hunting through Settings, Varieties and the catalog screen. (Served here by the Onboarding as a brand-new business's one first-run element, opened on accepting the invitation and from Home's notice; defined in onboarding.md.)

Choosing which pricing rules the business uses (pricing-settings.md) belongs in Settings too, as the Prices group.

Before this structure: the bar was Home · Sales · Customers · Stock · More; one variety was split across Stock, Varieties and Catalog; collecting a debt took four taps from Customers; settings were split across Business, Catalog and Expenses → Categorías, and the bot was configured inside Catalog. Nothing of it is kept but the redirects from its paths, and, until Settings's Integrations and Catalog message exist, the temporary place for the bot and the header and footer reached from the catalog screen (catalog.md).

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ New sale");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Customers → "Collect", or "Collect" on Home directly);
   - the catalog screen opens in at most 2 taps (Varieties → "Send catalog");
   - a stock entry opens in at most 2 taps (Varieties → "+ Stock entry");
   - a stock withdrawal opens in at most 2 taps (More → "Take from stock", or Varieties → "Take from stock");
   - an expense opens in at most 2 taps (More → "+ Add expense").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.** Name, users and join links, the pricing rules (Precio por cantidad and Customers VIP), the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Settings and nowhere else. Settings is reachable in at most 2 taps from any tab root: from the business avatar on Home and from More on the phone, from the sidebar's business row on a computer. Settings that belong to one variety live on the variety, and nowhere else. The one temporary exception is the bot and the header and footer, reached from the catalog screen until their Settings groups exist. The Onboarding's steps save these same settings through their owners and are not a second place for them (onboarding.md).
3. **One variety, one page.** A variety's stock and its movements (entries and withdrawals), prices, low-stock warning and catalog attributes are seen and edited from its page. No fact is edited in two places under two names.
4. **Nothing lost, nothing invented.** Everything a seller could do before stays reachable. The one deliberate exception is the customer channel, which is removed. No navigation entry or screen exists for something not yet built: no "coming soon", no promotions, automations or languages. No link points at a screen that does not exist.
5. **One rule for chrome and back.** Every screen is one of three kinds: tab root, card or detail, form or sheet. Each kind gets its chrome by the rule. Back follows history, and the parent screen is the fallback.
6. **Readable and accessible.** Tab labels are always visible. The active tab and every state are marked by shape or word, never color alone. The bar fits at 320 px with text at 130 %, measured in a real browser.
7. **One structure, said once.** The product docs, CONTEXT.md, the design (`docs/product/design-system/pantallas/`, phone and computer) and `scripts/design/screens.json` state the same structure and routes.
8. **Settings, group by group.** Each group is its own subscreen with "Close"; leaving with unsaved changes asks first, an untouched group closes at once. Renaming, "Invite a partner", the pricing switches, the bot (token, chats, Test it), the header and footer, categories (add, rename, remove, the refused removal included), Appearance, changing the password and logging out all work from the phone, and the end-to-end front run goes through every group.
9. **Chrome by kind, everywhere.** Every screen, the Varieties screens included (the two-pane list, a variety's page, its "See all" lists of prices and entries, New price, New variety, "All entries" and the stock entry form), is exactly one kind with a parent. The stock entry form reads "Close", never "Back".
10. **One move back.** Back or "Close" leaves a screen in one tap and never lands on the same screen twice in history, the "That is gone." exits and Record payment included. With no history, back goes to the screen the form, sheet or card belongs to.
11. **Every address opens its screen.** A reload on any Varieties route, parameterised ones included, opens the screen and never the API's answer. Every old Spanish path, `/variedades/{id}` and `/mi-stock/entradas/{id}` included, answers a permanent redirect to its new route with the id carried across.
12. **First run, one element at a time.** A brand-new business gets the Onboarding notice; only a business that existed before the Onboarding shipped sees the first-run checklist; an imported business sees the dismissable after-import notice; never two first-run elements at once, and each leads to its fix.

## Behaviour

### Tabs (phone)

- **The bar**: Home · Sales · Customers · Varieties · More, in that order. Tabs are objects, chosen by how often they are used.
- **The fixed "+ New sale"** button sits apart from the tabs and opens the sale form directly (sales.md). It is not a tab.
- **Labels** are always visible; no tab is an icon alone.
- **The active tab** is marked by more than color: a filled icon or an underline, and `aria-current` on the element.
- **Fit**: the bar, "Varieties" included, fits at 320 px viewport width with text at 130 %, measured in a real browser.

### Sidebar (computer)

- From the top: "+ New sale"; Home, Sales, Customers, Varieties; a divider; Expenses, Analysis.
- At the bottom: the business's name with its avatar, which opens Settings (as `InicioCompu` draws it).
- There is no More on a computer. The withdrawal form is reached from Varieties' secondary "Take from stock" and from a variety's page.
- **Two panes**: Customers and Varieties show the list on the left and the selected customer's card or variety's page on the right. Varieties opened with nothing selected selects the first unarchived variety by name (varieties.md); that counts as no tap. Archived uses the same two panes, selecting the first archived variety by name. Customers selects nothing on its own.
- **Two panes and history**: on a computer, picking a row in the left pane replaces the current history entry, and so does Varieties' automatic selection of its first variety. Back from either screen leaves it in one step, never once per row looked at. On the phone, opening a variety or a customer pushes an entry, and back returns to the list.

### More (phone)

- In order: "+ Add expense" (it opens the expense form with today's date, expenses.md), "Take from stock" (it opens the stock withdrawal form with today's date and no variety chosen, stock.md), Expenses, Analysis, Settings.
- "+ Add expense" and "Take from stock" are on top because they are the loads with no shorter path from every tab root.
- Nothing else: an entry appears only once what it opens exists. There is no entry for the Onboarding.

### Settings

- **One screen holding every business-wide setting, in groups, and nothing else.** The groups, in this order (each group's behaviour belongs to its owner):
  - **Negocio**: the business's name (accounts.md). Toast "Business renamed".
  - **Users**: the partners by email, sorted by email, the signed-in one marked "you", and "Invite a partner", which creates one fresh join link per tap, to copy or share (accounts.md). No list of invitations, no revoking, no roles.
  - **Prices** (pricing-settings.md), at `/settings/prices`:
    - the two switches, Precio por cantidad and Customers VIP;
    - "Save the prices", and the toast "Prices saved";
    - the fixed line that past sales keep their price and switching off deletes nothing, and the fixed help line under the VIP switch.
  - **Integraciones**: the Telegram bot (pinned-catalog.md):
    - the token, the channel chat, the own chat, and Test it, the only way they are saved;
    - after a token or channel change, "The previous pinned message stays as it is; unpin it yourself in Telegram.";
    - a plain link to the catalog screen, for publishing, carrying no status. Publish and the pin's status are only on the catalog screen.
  - **Catalog message**: the catalog's header and footer (catalog.md). Toast "Catalog saved".
  - **Expense categories**: add, rename and remove, the refused removal included (expenses.md).
  - **Apariencia**: the theme, Light or Dark, under accounts.md's theme rule (Dark sets `data-tema="oscuro"`, Light removes it).
    - A tap applies and remembers the choice on the device at once: no save, no toast, no unsaved-changes warning.
    - The current choice is marked by word or shape and `aria-checked`, never color alone.
    - Language has no entry until it exists.
  - **Tu cuenta**: "Change password" above "Sign out" (accounts.md). Nothing new.
- **Reached from**: the business avatar at the top of Home; More on the phone; the sidebar's business row on a computer. `/settings` marks More as the active tab on the phone.
- **The list of groups** is a card: the bar or sidebar and a back arrow, no "+ New sale". Back follows history; with none, it goes to "‹ More" on the phone and "‹ Home" on a computer.
- **Each group** is its own subscreen, a form: "Close", no bar, no "+ New sale"; unsaved changes ask before discarding, an untouched group closes at once. Appearance never has unsaved changes, so it always closes at once.
- **Empty business**: every group works. Users lists at least the signed-in user; Prices shows both switches as they stand (off for a new business); Expense categories with none shows an empty list and the add action; Integrations with nothing saved shows empty fields and no "Saved" line.
- **Never here**: a variety's own settings (catalog attributes, low-stock threshold, its prices, its VIP price included) or its archiving, which live only on its page and in Archived (varieties.md); anything for the operator (ADR-0002); a group or placeholder for anything not built; an entry to run the Onboarding again.
- **Nowhere else**: the old Business screen is gone; the catalog screen edits no header or footer (its "Edit header and footer" opens Catalog message); Expenses has no categories entry, apart from creating one inside the expense form (expenses.md); the pricing switches are reached from no variety page, price form or customer form. The Onboarding's steps save the same settings through their owners, never a copy (onboarding.md).
- **Temporary exception, until Integrations and Catalog message exist**: the bot settings and the header and footer stay editable, exactly as before, in one temporary place reached only from the catalog screen ("Edit header and footer" and Publish's "unavailable" link). It is a form ("Close" back by history, else to the catalog screen; confirmation on unsaved leave), with no tab, More entry, Settings group or "coming soon" mark, and no pin status or Publish. The catalog screen itself still edits nothing; it links out. Settings's own issue retargets both links and removes the temporary place.

### Chrome and back: one rule

Every screen is exactly one of three kinds, has one parent, and gets its chrome only from its kind.

- **Tab root**: Home, Sales, Customers, Varieties, Expenses, Analysis and More. It shows the bar (or the sidebar) and "+ New sale". Expenses and Analysis are reached from More on the phone and from the sidebar on a computer.
- **Card or detail**: a customer's card, a variety's page, an archived variety's page ("‹ Archived"), the Archived card ("‹ Varieties"), a sale's detail, an expense, a stock withdrawal's detail, the catalog screen, "All entries", every "See all" list of a variety's page (its entries and withdrawals, and its prices), and Settings's list of groups.
  - It shows the bar (or the sidebar) and a "‹ <parent>" back arrow naming the screen it returns to. A withdrawal's detail returns to the screen it was opened from, and to Varieties with no history.
  - It never shows "+ New sale". A customer's card carries only "New sale to <name>".
- **Form or sheet**: New sale and Pick a customer, Record payment, the customer form (new, `/customers/new`, and editing, `/customers/{id}/edit`), the stock entry form (new or editing, `/varieties/entries/{id}`), the stock withdrawal form ("Take from stock", new or editing), the price entry form, the expense form, a variety's add and rename, a variety's low-stock warning form and catalog attributes form, every Settings group, every Onboarding step and its closing screen "Done", and the temporary place for the bot and the header and footer while it exists.
  - It shows neither the bar nor "+ New sale". It closes with "Close", never another word such as "Back".
  - Leaving it with unsaved changes asks before discarding. New sale keeps its own "Discard the sale?" (sales.md); every other form or sheet asks the same way with its own fixed wording.
  - An untouched form or sheet closes at once.
  - The Onboarding's "Close" lands on Home and keeps its resume point; New sale opened from "Done" goes back to Home, never to "Done" or the Onboarding (onboarding.md).
- **Back** follows the app's history and leaves in one move; it never lands on the same screen twice. With no history (a link opened directly), it goes to the parent named by "‹", or for a form or sheet to the screen it belongs to:

| Screen | Back with no history goes to |
|---|---|
| New variety | Varieties |
| New price | that variety's page |
| Stock entry form, new | Varieties |
| Stock entry form, editing | "All entries" |
| Customer form, new | Customers |
| Customer form, editing | that customer's card |
| Record payment | Customers |
| A variety's "See all" of prices or entries | the variety's page |
| "All entries" | Varieties |
| Stock withdrawal form, new | Varieties |
| Stock withdrawal form, editing | that withdrawal's detail |
| A withdrawal's detail | Varieties |
| Archived | Varieties |
| An archived variety's page | Archived |
| An Onboarding step or "Done" | Home |

- **A gone exit is the same move as "Close".** When saving, deleting or undoing in the stock entry form, the customer form or Record payment hits a record that no longer exists, the screen goes back one step in history when it was opened from inside the app, or to its parent when it was opened by a direct link. The list refreshes and "That is gone. The list is up to date." shows, as accounts.md defines it. No history entry is ever duplicated.
- **"Collect from <name>"** on a debtor row (Customers or Home) opens Record payment with that customer chosen, as an entry in the app's history; back or "Close" closes it in one move, back to the screen it came from.

### Routes

- Every screen's route is in English: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/settings/prices`, `/more`, and the same for every other screen. The stock withdrawal form is `/withdrawals/new` (and `/withdrawals/{id}/edit`), a withdrawal's detail `/withdrawals/{id}`. Every screen is registered once, with its kind and its parent, in `scripts/design/screens.json`, which fixes its exact path; each Settings group, each Onboarding step and "Done" are included, as are `/customers/new`, `/customers/{id}/edit` and `/varieties/entries/{id}`.
- **Varieties** and its screens: `/varieties`, `/varieties/{id}`, `/varieties/catalog` (the catalog screen), `/varieties/entries` ("All entries"), `/varieties/entries/new`, `/varieties/entries/{id}` (editing a stock entry), `/varieties/{id}/entries` (a variety's entries, the same list filtered to it, with the withdrawals that touch it, "‹ <variety>"), `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/new` and `/varieties/archived` (the Archived card). A variety's page is read-only when the variety is archived. `{id}` is the variety's or entry's own id. A reload on any of them opens the screen, never the API's answer, and the front's own API calls still reach the API.
- Every old Spanish path redirects permanently to its new route, each tested one by one, with a record's id carried across:
  - `/ventas`, `/clientes`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/mi-stock/entradas/{id}` (to `/varieties/entries/{id}`), `/variedades`, `/variedades/{id}` (to `/varieties/{id}`), `/catalogo`, `/gastos`, `/mas`, and every other one, including the old Owed to you screen's path, which goes to Customers;
  - `/negocio` goes to Settings;
  - the old Expenses → Categorías path (`/gastos/categorias`) goes to Settings → Expense categories.
- Every redirect target is a registered screen. The server answers every old path through one redirect mechanism; the front has no redirects of its own.
- The old Catalog had no separate paths for the bot or the header and footer, so nothing redirects to Integrations or Catalog message. Prices is new, so nothing redirects to it.
- An unknown or mistyped address goes to Home (`/`), as it always has. An Onboarding path opened for a business whose Onboarding is over, or that never had one, goes to Home too. A later task that removes a path with no counterpart decides where that path goes.
- No route carries a business (ADR-0004); a record's own id in a path is allowed. `/invitation/{token}` and `/reset/{token}` stay as they are (accounts.md).
- Screen text stays in Rioplatense Spanish; only the routes change.

### Routes for screens still to be rebuilt

This covers Settings and its groups, the catalog screen and a variety's page, whose screens their own issues rebuild.

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

- **Entry**: accepting a new-business invitation lands in the Onboarding instead of Home. That is the only time it opens by itself.
- **The Home notice**: while it is not over, "Go on to the setup" sits at the top of Home, on the phone and on `InicioCompu`, in the checklist's place (results.md gives Home's order). It shows "N of 6 steps" and what is next, opens the Onboarding at its resume step, and cannot be dismissed.
- **While it is not over**, the checklist and "Start with your varieties" do not show.
- **It adds no side rule**: "+ New sale" and "Send catalog" behave as for any business. What is missing is told by the notice, by New sale's own no-price line before saving and by the catalog screen's empty state.
- **Once it is over** ("Done" reached, or the import loaded the business), it never shows again; ongoing gaps are told by the standing notices.
- Its steps, passes, resume and closing screen are onboarding.md.

### First-run checklist (businesses that existed before the Onboarding)

- **The steps**, each worked out from the business's data at the moment, never from a stored tick:
  1. a variety with a current price today (required);
  2. any stock entry (required);
  3. the pinned catalog published at least once (optional);
  4. a second user in the business (optional).
- A met step shows its box checked and the word "Done", never color alone. The step labels are design's wording, within the icon and text rule's length limits; the checklist carries no attention icon.
- **Who sees it**: a business that existed before the Onboarding shipped and has not yet met both required steps, and every user of it. A brand-new business gets the Onboarding instead and never sees the checklist. The optional steps never hold it on screen; they stay reachable in Settings (Integrations, Users).
- **When it goes**: for good, the first time steps 1 and 2 are both met.
  - It never comes back, even if a required step's condition later becomes false again (say, the only price entry is deleted).
  - Ongoing gaps are told by the standing notices: "Start with your varieties" and the pinned catalog's out-of-date notice.
- **Where**: at the top of Home, on the phone and on `InicioCompu` alike (results.md gives Home's order). While it applies, it takes the first-run slot, and "Start with your varieties" does not show.
- **While it shows**:
  - "+ New sale" stays visible and, with no variety priced today, says in words what is missing;
  - while nothing qualifies for the catalog, "Send catalog" is disabled with its reason in words (e.g. "Add a variety with a price and its stock"). This is the only time it is ever disabled (catalog.md). Integrations' link to the catalog screen is never disabled.
- **An imported business** arrives with prices and stock, so it never sees the checklist.

### After-import notice

- A business the spreadsheet import loaded (import.md), as recorded by the import itself, shows on Home "Connect the bot so the pinned catalog updates by itself", with the attention icon (icon-and-text-rule.md).
- It can be dismissed. It shows until it is dismissed or the pinned catalog is first published, whichever comes first, and then never again. A dismissal is for the business: no partner sees it afterwards.
- A business imported before the import recorded it never sees the notice.

### Constraints

- Nothing here adds a route that answers business data beyond what Home's panel and the first-run state need; each screen reads its owner's routes, already in the isolation sweep and the gated-route test. The Onboarding's own routes, and any route for the first-run state (the import fact, the checklist's end, the after-import notice's dismissal), join both, and that state carries `business_id` and is exported and deleted by business removal (ADR-0015).
- Serving a front path to a browser navigation never widens what the API answers to a JSON request, and adds no API route (ADR-0024).
- Whatever decides the Onboarding notice, the checklist and the after-import notice is answered by the server for the session's business only.
- No business id in a URL; no personal data or money in the console or browser storage (accounts.md). The theme choice is the only thing kept on the device; the first-run facts are kept on the server, never in the browser.
- Feedback follows accounts.md, in Settings, the Onboarding and Home as everywhere:
  - no network shows "No connection";
  - a server error shows a generic retry;
  - a record that is gone follows the "That is gone." rule.

## Metrics

- **Tap budget (criterion 1)**: through the front, from each tab root, phone and computer viewports, the end-to-end run counts the taps to open: the sale form (1), Record payment with the customer chosen from Customers and from Home (≤2), the catalog screen (≤2), the stock entry form (≤2), the stock withdrawal form (≤2) and the expense form (≤2). 100% within budget.
- **Settings in one place (criterion 2)**: every business-wide setting named in the product docs sits in exactly one Settings group and on no other screen, the pricing switches included; the catalog screen edits no header or footer, Expenses has no categories entry, and the old Business screen does not exist; every per-variety setting sits only on the variety's page. Settings and Prices open in ≤2 taps from every tab root, phone and computer. While the temporary place stands in for Integrations and Catalog message, it is reached only from the catalog screen and from no tab, More or Settings entry. The Onboarding's steps write through the owners' routes, and a value saved there reads the same in Settings.
- **One fact, one place (criterion 3)**: no price, stock entry, withdrawal, threshold or catalog attribute is editable from two screens, checked against the docs and the design. A stock entry is edited through its one form, `/varieties/entries/{id}`, whichever list it was opened from.
- **Nothing lost, nothing invented (criterion 4)**: every action a seller had before the redesign, and everything reachable on master or on #59, maps to a place in the new structure, except the customer channel; the bar, the sidebar, More and Settings show exactly the entries listed above, with no placeholder group and no Onboarding entry; no link points at a missing screen. #47's end-to-end specs and #118's test waits pass without being edited to fit.
- **Chrome (criteria 5, 9)**: every screen in the docs and in `scripts/design/screens.json` is classified as exactly one kind with a parent, the Onboarding's steps and "Done" included, and front tests check its chrome: tab roots with the bar and "+ New sale", cards with "‹ <parent>" and no "+ New sale", forms and sheets with neither, "Close" and a confirmation on unsaved leave. The stock entry form reads "Close", never "Back"; the customer form shows "Close".
- **One move back (criterion 10)**:
  - each gone exit (stock entry form, customer form, Record payment), opened from its parent, leaves history holding the parent once, and one back leaves; opened by a direct link, it goes to the named parent;
  - each row of the back-with-no-history table is tested one by one; back with no history from Settings's list goes to More on the phone and Home on a computer; from a withdrawal's detail, to Varieties; from an archived variety's page, to Archived; from Archived, to Varieties; from the Onboarding, to Home;
  - on a computer, picking rows in Varieties' and Customers' two panes, and Varieties' auto-selected first variety, leave back at one step; on the phone, opening a record pushes an entry;
  - tapping "Collect from <name>" on a Customers row and on an Home row opens Record payment with the customer chosen, carries the in-app history state, and back closes it in one move.
- **Accessible bar (criterion 6)**: a Playwright test at 320 px with text at 130 % shows every tab label whole; the active tab carries `aria-current` and a non-color mark; no state is told by color alone.
- **Settings (criterion 8)**:
  - front tests:
    - every group has "Close" and no bar;
    - unsaved changes ask, and an untouched group closes at once;
    - Appearance shows no save, toast or warning;
  - Prices sits after Users and before Integrations, at `/settings/prices`;
  - Integrations shows the link to the catalog screen, no pin status and no Publish, and the "unpin it yourself in Telegram" line after a token or channel change;
  - one end-to-end front run from a phone viewport:
    - renames the business and creates a join link;
    - switches and saves Prices;
    - runs Test it and follows the link to the catalog screen;
    - edits the header and footer;
    - adds, renames and removes a category, a refused removal included;
    - switches Appearance, changes the password and logs out.
- **First-run matrix, the Onboarding**: 100% passing, phone and computer:
  - a brand-new business lands in the Onboarding on accepting its invitation and sees "Go on to the setup" while it is not over, never with "Start with your varieties";
  - while it runs, "+ New sale" and "Send catalog" behave as for any business;
  - a pre-existing business and an imported business (including one that landed in the Onboarding before the import) never see it; a user who joins a business mid-Onboarding sees the same notice.
- **First-run matrix, the checklist and the after-import notice (criterion 12)**: 100% passing, phone and computer:
  - a business that existed before the Onboarding sees the checklist, and each met step shows "Done";
  - it goes the first time steps 1 and 2 are both met, whatever 3 and 4;
  - deleting the only price entry afterwards never brings it back;
  - an imported business never sees it, and sees the after-import notice until dismissed or published; once dismissed, no partner sees it;
  - a business that finished the Onboarding through "Done" never sees the after-import notice, and neither does a business imported before the import fact existed;
  - a joined user sees their business's element, or none;
  - two first-run elements never show at once;
  - "Send catalog" is disabled only while the checklist shows and nothing qualifies.
- **First-run state isolated**: its routes are in the sweep and the gated-route test; business removal leaves 0 rows of it and exported count = deleted count.
- **Redirects (criterion 11)**: every old Spanish path that has moved answers a permanent redirect to its English route, tested one by one, including `/negocio`, `/gastos/categorias`, `/catalogo`, `/mi-stock/nueva-entrada`, and `/variedades/{id}` and `/mi-stock/entradas/{id}` with the id carried across. A test shows every redirect target is a `screens.json` path, with no exemption. There is one redirect mechanism, on the server, and none in the front.
- **Reloads under `/varieties` (criterion 11)**: a browser navigation to each Varieties route, parameterised ones included (`/varieties/{id}`, `/varieties/{id}/entries`, `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/entries/{id}`) and `/varieties/archived`, opens the screen, never the API's answer; the front's own API calls still reach the API.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes, the withdrawal form and detail, the Archived card, the archived variety's page, Prices, the Onboarding's screens and Home's first-run states included; Zeta approves the pull request that states them.
- **Design**: `scripts/design/compare.sh` runs before and after for the stock entry form, the customer form, New sale and Home (phone and computer, both themes), attached to the PR and judged by eye; `NuevaVentaCompu` comes out unchanged; any difference from the design is listed in the PR.

## Out of scope

- English screen texts (#53); a language entry.
- Rebuilding each area's screens (#45–#49, Settings's groups): their routes show today's content until then.
- Any operator or admin surface in the app; roles; listing or revoking invitations.
- A tour or welcome screen beyond the Onboarding.
- An entry to run the Onboarding again.
- Side rules on "+ New sale" or "Send catalog" tied to the Onboarding.
- A checklist for a brand-new business; storing a checklist step as ticked.
- Backfilling the import fact for a business imported before it existed.
- Promotions (as campaigns or offers), automations, languages, and any entry for them before they exist. A stock withdrawal for promotion is a stock record, not this.
- A "follow the system" theme.
- The pin's status or Publish in Integrations.
- Per-variety settings in Settings (#47).
- An Archived entry in the bar, the sidebar, More or Settings: it is reached only from Varieties.
- A redirect rule for removed paths with no counterpart; changing where unknown addresses go.
- Marks or "‹ <parent>" labels that depend on how a screen was reached.
- A back arrow that ignores history.
- Changing the copy of any existing unsaved-changes question.
- Live updates between partners.
- A way into Prices from a variety's page, the price form or the customer form.
- Redirects in the front; a second redirect mechanism.
- Auto-selecting a customer on Customers' two panes.
- Any token, wording or layout change to a screen beyond what the chrome rule gives it.
- A business-wide list of stock withdrawals.
