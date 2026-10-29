# Navigation

The app's one structure for a business: the tabs on the phone, the sidebar on a computer, More, Settings, the one rule that gives every screen its chrome and its way back, which place is marked, the routes and their redirects, the phone layout (fixed bar, floating "+ New sale", forms as sheets), and the first run (the Onboarding for a brand-new business, the first-run checklist for a business that existed before it, the after-import notice for an imported one). It says where every capability is reached from. What each capability does stays in its own file; nothing here changes a rule of pricing, settlement, stock, the catalog, isolation or feedback. Seen only by the session's business (ADR-0004).

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

**When** I review a change to Home's first-run elements before approving it, **I want** the tests, the `/first-run` contract and the design capture to prove what navigation.md, results.md and ADR-0046 say in every state they can be in and in both themes, **so I can** approve from the evidence alone, without trusting partial checks or carrying open findings into the next task.

- Its protagonist is the maintainer, or the reviewer acting for them, as in gate.md, design-capture.md and onboarding.md criterion 6. The seller is affected only indirectly: a head nobody can approve holds up the work they are waiting for.
- It refines criterion 12, results.md criteria 10–12 and ADR-0046; it is not a new product job and adds no product behaviour.
- Its capture side (the `InicioHoyCompu` row) is design-capture.md's.
- Before it (GH-45's follow-up): the agreement test reached `/first-run` only where the checklist shows, the shape of `checklist` outside the checklist kind was undecided, only the checklist test ran in both themes, and the Today capture showed a difference by construction.

**When** I'm in the middle of serving a customer with my phone in hand, **I want** the app to behave like a phone app (the tabs and "+ New sale" within reach, a form that fills the screen with its main action under my thumb, and nothing I need hidden behind the keyboard or off the edge of the screen), **so I can** record a sale, a payment or stock without fighting the screen or losing what I typed.

- This is a quality bar on the navigation job and the BRIEF's phone jobs (record a sale, collect a payment, record stock, check Home), below 900 px only (GH-319). It is not a new job. The computer keeps every capability and gets nothing from it (Phone first).
- Before it: the bar scrolled away with the page, "+ New sale" sat in the page flow, forms were overlays or routed pages whose action could end up below the fold or behind the keyboard, some tap targets and labels were too small, and some screens scrolled sideways. The seller scrolled back up, pinched or retried taps.
- Served by "Phone layout (GH-319)" below and criteria 19 and 20. Analysis's content (its three tables and month selector) is GH-319's part 2; its chrome is covered here.

Choosing which pricing rules the business uses (pricing-settings.md) belongs in Settings too, as the Prices group.

Before this structure: the bar was Home · Sales · Customers · Stock · More; one variety was split across Stock, Varieties and Catalog; collecting a debt took four taps from Customers; settings were split across Business, Catalog and Expenses → Expense categories, and the bot was configured inside Catalog. Nothing of it is kept but the redirects from its paths, and, until Settings's Integrations and Catalog message exist, the temporary place for the bot and the header and footer reached from the catalog screen (catalog.md).

Success criteria:

1. **Daily jobs by frequency.** From any tab root on the phone:
   - a sale opens in 1 tap ("+ New sale");
   - the payment sheet with the customer already chosen opens in at most 2 taps (Customers → "Collect", or "Collect" on Home directly);
   - the catalog screen opens in at most 2 taps (Varieties → "Send catalog");
   - a stock entry opens in at most 2 taps (Varieties → "+ Stock entry");
   - a stock withdrawal opens in at most 2 taps (More → "Take from stock", or Varieties → "Take from stock");
   - an expense opens in at most 2 taps (More → "+ Add expense").

   On a computer, each takes no more taps than on the phone.
2. **Every business-wide setting in one place.** Name, users and join links, the pricing rules (Bulk price and VIP customers), the Telegram bot, the catalog header and footer, expense categories, appearance, and your account (password, log out) are all in Settings and nowhere else. Settings is reachable in at most 2 taps from any tab root: from the business avatar on Home and from More on the phone, from the sidebar's business row on a computer. Settings that belong to one variety live on the variety, and nowhere else. The one temporary exception is the bot and the header and footer, reached from the catalog screen until their Settings groups exist. The Onboarding's steps save these same settings through their owners and are not a second place for them (onboarding.md).
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

Success criteria, reviewing the first run (GH-45 follow-up):

13. **Approved from the evidence alone.** A review of the merging head raises no important finding about the first run's agreement test, the shape of `checklist`, its theme coverage or the Today capture, and none is carried into another task.
14. **A broken answer fails a test.** In any reachable state (no variety; priced without stock; stock without a price; sold out; qualifying; checklist gone), a test fails if `/first-run`'s `nothing_qualifies` is not exactly "the kind is the checklist and `GET /catalog` has no text", or if its checklist steps disagree with the data.
15. **One shape for `checklist`.** Its shape outside the checklist kind is written once, here. The API, `contract.json` and the front agree on it, and a test pins it.
16. **Both themes.** Every first-run test on Home runs in light and in dark.
17. **The capture tells the truth.** `InicioHoyCompu` is compared against its own named section (design-capture.md).
18. **Nothing a seller sees changes, and no test is loosened.** This file, results.md and every screen read and behave as before; every suite passes; edited tests keep every assertion they had; registry changes stay within their declared seams.

Success criteria, the phone layout (GH-319). They are checked at 320, 360 and 390 px. Analysis's content meets them in GH-319's part 2; its chrome meets them here. Speed is criterion 1 together with the BRIEF's measure: the tap count to a saved sale is unchanged, and a sale is still recorded from the phone in under a minute.

19. **Nothing needed is out of reach on the phone.**
    - On tab roots, the bar and "+ New sale" stay in view at any scroll position. On cards and details only the bar shows, and on forms and sheets neither shows.
    - While a text keyboard is open, the bar and the button are hidden and can't be tapped, and nothing shifts when they come back.
    - A sheet's main action, and any error about it, stays pinned and visible at the bottom. The three forms that keep the old overlay (below) are a named exception.
    - No page is wider than the screen, down to 246 px, with extreme data.
    - Long names truncate with an ellipsis. A figure never splits, and "$" never stays alone on a line.
    - Every tap target is at least 44×44, and no text is under 12 px.
20. **Nothing typed or found is lost, and the computer is untouched.**
    - Rotating the phone or resizing across 900 px keeps what was typed.
    - Closing a sheet opened from a scrolled list returns to the same scroll position.
    - Tapping outside a sheet never discards work and never adds a confirmation. Where a visible area lies outside it, a tap there closes it only when nothing was changed. A full-screen phone sheet has no outside: the safe-area strip by the status bar never counts as one.
    - Computer layouts come out with unchanged captures, ADR-0044's price modal included.

## Behaviour

### Tabs (phone)

- **The bar**: Home · Sales · Customers · Varieties · More, in that order. Tabs are objects, chosen by how often they are used. It is fixed to the bottom of the screen (Phone layout).
- **"+ New sale"** floats just above the bar on tab roots, apart from the tabs, and opens the sale form directly (sales.md). It is not a tab.
- **Labels** are always visible, at least 12 px; no tab is an icon alone.
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
  - **Business**: the business's name (accounts.md). Toast "Business renamed".
  - **Users**: the partners by email, sorted by email, the signed-in one marked "you", and "Invite a partner", which creates one fresh join link per tap, to copy or share (accounts.md). No list of invitations, no revoking, no roles.
  - **Prices** (pricing-settings.md), at `/settings/prices`:
    - the two switches, Bulk price and VIP customers;
    - "Save the prices", and the toast "Prices saved";
    - the fixed line that past sales keep their price and switching off deletes nothing, and the fixed help line under the VIP switch.
  - **Integrations**: the Telegram bot (pinned-catalog.md):
    - the token, the channel chat, the own chat, and Test it, the only way they are saved;
    - after a token or channel change, "The previous pinned message stays as it is; unpin it yourself in Telegram.";
    - a plain link to the catalog screen, for publishing, carrying no status. Publish and the pin's status are only on the catalog screen.
  - **Catalog message**: the catalog's header and footer (catalog.md). Toast "Catalog saved".
  - **Expense categories**: add, rename and remove, the refused removal included (expenses.md).
  - **Appearance**: the theme, Light or Dark, under accounts.md's theme rule (Dark sets `data-tema="oscuro"`, Light removes it).
    - A tap applies and remembers the choice on the device at once: no save, no toast, no unsaved-changes warning.
    - The current choice is marked by word or shape and `aria-checked`, never color alone.
    - Language has no entry until it exists.
  - **Your account**: "Change password" above "Sign out" (accounts.md). Nothing new.
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
  - On the phone, the forms listed under "Phone layout" are drawn as sheets by the one shared `Sheet`.
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
| Expense form, new | Expenses |
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

### Phone layout (GH-319)

Below 900 px only. Every rule here is scoped under that breakpoint. Computer layouts, ADR-0044's price modal included, stay exactly as they are. Analysis's content (its three tables and month selector) is GH-319's part 2; only its chrome follows this section now.

- **Fixed bar**: the bar is fixed to the bottom of the screen on tab roots and on cards and details, respecting the device insets.
- **Floating "+ New sale"**: it floats together with its "what is missing" line just above the bar, on tab roots only. Forms and sheets show neither the bar nor the button.
- **Bottom space**: content never ends under the bar or the button, and the last row is fully visible above them. One bottom-space value (`--bottom-chrome-height`) drives three things: the content padding, the button position and the toast position. No rule hard-codes those heights. A customer's card pins its "New sale to <name>" above the bar from the same value.
- **Keyboard**:
  - Whenever a text keyboard is open, on any tab root or card with a text field (Customers search, Sales search or filters, and the rest), the bar and the button are hidden and can't be tapped. They are never pushed up above the keyboard.
  - Padding does not change, so nothing shifts. Closing the keyboard brings both back with the typed text and scroll position unchanged.
  - Pinch-zoom never counts as keyboard open. Neither does a date, time, select, checkbox, radio, range, color, file or button control: those leave the bar in place.
  - It works on iOS, on Android and without the visual viewport API. Only `useVisualViewport` decides it, through one pure function (ADR-0028 as amended). New sale keeps its form-fixed behaviour.
- **Toasts**: only their position changes, never their timing or dismissal.
  - They sit above the bar and the "+ New sale" group on tab roots, above the bar on cards and details, and above the pinned action on a sheet. A toast never covers a main action.
  - After a save closes a sheet, the toast shows in its place on the screen the seller returns to.
- **Sheets**:
  - One shared `Sheet` draws every phone form listed below. It is a full-screen modal dialog with "Close" at the top, and the background does not scroll.
  - Focus goes to the first enabled field (a choice group's first option included), or to a field the form names.
  - The main action sits in an actions container pinned at the bottom of the form, inside the form. Errors and destructive actions sit above the main action, and nothing renders below it.
  - The sheet's height follows the visible viewport, so the keyboard does not cover the action.
  - The form's element tree is the same on phone and computer, so a resize across 900 px or a rotation keeps what was typed.
- **Back and Close on a sheet**: the phone's back gesture is the same action as "Close".
  - With nothing changed, the sheet closes and the seller is back where they opened it from, at the same scroll position.
  - With something typed, the form's existing leave confirmation appears, exactly as before.
  - The inline edits on a variety's page close their sheet first and never jump over the page.
- **Tap outside**:
  - On the phone a sheet fills the screen and has no outside. The safe-area strip by the status bar does not count as outside: a tap there does nothing, whether the sheet is touched or not. No gap or visible backdrop is added to create an outside. "Close" and back are a phone sheet's only exits.
  - Where a visible area does lie outside a dialog (the computer's existing dialogs), a tap there closes an untouched dialog and does nothing on a touched one. Those computer frames keep their backdrop behaviour exactly as it is today; this part does not edit them.
  - Anywhere, tapping outside never discards work, never opens a dialog, and no form gains a new confirmation.
- **What is behind a sheet**:
  - Opened from inside the app, the screen behind is the one the form was opened from. An in-page sheet (a variety's inline edits, editing an expense) has its own screen behind it.
  - Opened by a direct address, a routed form shows its sheet over the parent from the back-with-no-history table. That parent is inert and hidden from assistive technology, with no chrome, no heading and no ids, and it shows nothing while its data is loading or missing.
  - Routes, kinds and parents do not change.
- **Forms drawn as sheets**:
  - Record payment;
  - the price entry form (phone only; its computer modal is ADR-0044's);
  - the customer form, new and editing;
  - the expense form, new and editing;
  - the stock entry form, new and editing;
  - the stock withdrawal form, new and editing;
  - New variety;
  - a variety's rename, low-stock warning form and catalog attributes form.
- **Known exception**: Change password, the expense categories editor and New sale's new-customer overlay keep the old overlay on the phone, with no pinned action. The `Sheet` ADR (ADR-0053) names them. This is an exception to criterion 19's pinned action, not a failure of it.
- **Record payment's focus**: on the phone, opening it puts focus on its first field, not its title; its computer modal still focuses the title. Closing still returns focus to the "Collect" or "Record payment" that was tapped (payments.md).
- **New sale's payment choice**:
  - The Cash / Transfer / Owing choice stays visible above the sale's footer.
  - Save is never disabled. It does not look ready until a choice is made: it is drawn as a secondary button until then and as the primary button after.
  - A tap on Save before the choice does what it did before: the line names what is missing. The tap count to a saved sale does not change.
- **Fit**: no page is wider than the viewport at 320 and 246 px with extreme data. Long names truncate with an ellipsis, a figure never splits, and "$" never stays alone on a line. The expenses month ordering rule applies to Expenses only.
- **Tap targets and text**: every tap target is at least 44×44 and no text is under 12 px. This includes:
  - New variety;
  - the onboarding Skip and Skip the rest;
  - Categories, Integrations and Edit header and footer;
  - Owed to you;
  - the month arrows;
  - the low-stock switch.
- **Keyboard help**:
  - Login suggests the username and current password.
  - Change password and the reset page suggest the new and current password.
  - Customer search is a search field with a search key on the keyboard.

### Routes

- Every screen's route is in English: `/sales`, `/customers`, `/varieties`, `/expenses`, `/analysis`, `/settings`, `/settings/prices`, `/more`, and the same for every other screen. The stock withdrawal form is `/withdrawals/new` (and `/withdrawals/{id}/edit`), a withdrawal's detail `/withdrawals/{id}`. Every screen is registered once, with its kind and its parent, in `scripts/design/screens.json`, which fixes its exact path; each Settings group, each Onboarding step and "Done" are included, as are `/customers/new`, `/customers/{id}/edit` and `/varieties/entries/{id}`.
- **Varieties** and its screens: `/varieties`, `/varieties/{id}`, `/varieties/catalog` (the catalog screen), `/varieties/entries` ("All entries"), `/varieties/entries/new`, `/varieties/entries/{id}` (editing a stock entry), `/varieties/{id}/entries` (a variety's entries, the same list filtered to it, with the withdrawals that touch it, "‹ <variety>"), `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/new` and `/varieties/archived` (the Archived card). A variety's page is read-only when the variety is archived. `{id}` is the variety's or entry's own id. A reload on any of them opens the screen, never the API's answer, and the front's own API calls still reach the API.
- Every old Spanish path redirects permanently to its new route, each tested one by one, with a record's id carried across:
  - `/ventas`, `/clientes`, `/mi-stock`, `/mi-stock/nueva-entrada`, `/mi-stock/entradas/{id}` (to `/varieties/entries/{id}`), `/variedades`, `/variedades/{id}` (to `/varieties/{id}`), `/catalogo`, `/gastos`, `/mas`, and every other one, including the old Owed to you screen's path, which goes to Customers;
  - `/negocio` goes to Settings;
  - the old Expenses → Expense categories path (`/gastos/categorias`) goes to Settings → Expense categories.
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

### What `/first-run` answers, and how it is proven (GH-45 follow-up)

- **The shape of `checklist`**: outside the checklist kind (the Onboarding notice, "Start with your varieties", none), `checklist` is an empty list `[]`, never `null`. The after-import notice is its own flag and never changes it. This is the one statement of the shape: the plan, the API schema and the front read it, and the contract checker is not changed. Home shows the checklist only when the kind says so, never because the list has items.
- **`nothing_qualifies`** is true exactly when the kind is the checklist and the catalog has no text to send; in every other kind it is false, whatever the catalog holds. It is read only by the checklist's rule that disables "Send catalog", and outside the checklist it means nothing. It is never widened to answer for every kind.
- **The agreement test** compares `/first-run` with its sources in eight states: no variety; priced without stock; stock without a price; sold out; qualifying; checklist gone; an open Onboarding; and an imported business, while its notice shows and once it is over. In every state:
  - the kind and the notice flag equal what their sources say: `/onboarding-progress`, the import fact and the publish fact;
  - `GET /catalog` itself is read (not only the port the server reads it through), and `nothing_qualifies` equals "the kind is the checklist and `GET /catalog` has no text".

  Each first-run element (the Onboarding notice, the checklist, "Start with your varieties", the after-import notice, none) appears in at least one state. It adds checks only; no rule or matrix here changes.
- **Both themes**: the front tests of the Onboarding notice, the checklist, "Start with your varieties", the after-import notice, "+ New sale"'s missing-price line and the disabled "Send catalog" each run in light and dark, keeping every assertion they had. Home's figures are out of this scope.

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
- **Phone layout (GH-319)**:
  - Every phone sheet is rendered by the one shared `Sheet` (ADR-0053). No form defines its own backdrop, Close placement, pinned-action layout or scroll lock.
  - Wherever a sheet has an outside, its tap-outside and its Close read the same `touched` value: the `dirty` the host already passes to `useLeaveGuard`. On the phone's full-screen sheet nothing outside it closes it.
  - "Keyboard open" is decided only in `useVisualViewport` (ADR-0028 as amended).
  - The phone rules never edit ADR-0044's `PriceFrame` dialog branch or `CobroFrame`'s computer branch.
  - Each step leaves the Mobile check green, deletes every offender entry it turns green, keeps registry keys and adds no entry outside gate.md's trade or new-row rules.

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
- **First-run agreement (criteria 13, 14)**: over the eight states, `/first-run`'s kind and notice flag equal their sources, and `nothing_qualifies` equals "the kind is the checklist and `GET /catalog` has no text": 0 differences; each of the five elements appears in at least one state; a deliberately broken `nothing_qualifies` makes the test fail, shown once in the PR and not committed. 0 findings of these kinds on the merging head, and 0 carried into another task.
- **One shape (criterion 15)**: a backend test shows `checklist == []` for every kind that is not the checklist; a front test shows `[]` is read as no checklist; the plan, the schema and the front agree, and the contract checker's code is unchanged.
- **Both themes (criterion 16)**: each of the six first-run front tests runs in light and dark, and no test has fewer assertions than before.
- **Nothing loosened (criterion 18)**: every suite passes; the only edited tests are the agreement test, the Home first-run tests and the two registry tests, each keeping its assertions; under `web/src/` nothing but tests changes, apart from the front's `/first-run` type if it declared `checklist` nullable.
- **Redirects (criterion 11)**: every old Spanish path that has moved answers a permanent redirect to its English route, tested one by one, including `/negocio`, `/gastos/categorias`, `/catalogo`, `/mi-stock/nueva-entrada`, and `/variedades/{id}` and `/mi-stock/entradas/{id}` with the id carried across. A test shows every redirect target is a `screens.json` path, with no exemption. There is one redirect mechanism, on the server, and none in the front.
- **Reloads under `/varieties` (criterion 11)**: a browser navigation to each Varieties route, parameterised ones included (`/varieties/{id}`, `/varieties/{id}/entries`, `/varieties/{id}/prices`, `/varieties/{id}/prices/new`, `/varieties/entries/{id}`) and `/varieties/archived`, opens the screen, never the API's answer; the front's own API calls still reach the API.
- **One structure (criterion 7)**: the docs, CONTEXT.md, `pantallas/` and `screens.json` name the same screens and routes, the withdrawal form and detail, the Archived card, the archived variety's page, Prices, the Onboarding's screens and Home's first-run states included; Zeta approves the pull request that states them.
- **Design**: `scripts/design/compare.sh` runs before and after for the stock entry form, the customer form, New sale and Home (phone and computer, both themes), attached to the PR and judged by eye; `NuevaVentaCompu` comes out unchanged; any difference from the design is listed in the PR.
- **Phone speed (GH-319, with criterion 1)**: the New sale e2e passes unedited, with the same tap count to a saved sale. A sale is recorded from a phone viewport in under 60 s.
- **Chrome in reach (criterion 19)**:
  - The Mobile check runs at 320, 360 and 390 px, at the top, middle and bottom scroll positions. On every tab root, Analysis's chrome included, it finds the bar and "+ New sale" inside the viewport with the last row fully above them. On cards it finds the bar and no button, and on forms and sheets neither.
  - 0 `chrome-at-load`, `chrome-mid-scroll` or bar-label entries are left for the screens in scope.
- **Keyboard (criterion 19)**:
  - The unit matrix of the keyboard decision passes 100%: iOS gap, Android drop, focus at mount, an address-bar change under 120 px, `scale = 2`, and no `visualViewport` with text, date and select focus.
  - On Customers, the e2e hides the bar and button with the keyboard open and brings them back with the search text and scroll offset unchanged.
  - An Android-sized scroll keeps the bar visible.
  - `nuevaVentaTelefono.spec.ts` and the existing hook tests pass unedited.
- **Pinned action and focus (criterion 19)**:
  - On every sheet, the action's bottom edge is within `--inset-abajo` of the sheet's bottom. This is checked on rename (the shortest form) and on a withdrawal with lines (the tallest).
  - A front test per form asserts its first-focus control, Record payment's first field included.
  - A direct address shows each routed sheet over its parent, one test per route.
- **Fit, targets and text (criterion 19)**:
  - 0 `h-scroll`, `name-overflow` or `figure-split` entries at 320 and 246 px with the seed's extreme data, on every phone screen except Analysis's content.
  - 0 `touch-target`, `text-size` or `autocomplete` entries on the screens in scope.
  - No entry names Record payment's walked sheet states.
- **Nothing lost (criterion 20)**:
  - Viewport-flip tests in the price form and in Record payment keep the typed text.
  - Close from a scrolled list returns to the same offset.
  - `Sheet` unit tests, wherever a backdrop is drawn: tapping it closes an untouched sheet and does nothing on a touched one.
  - A `Sheet` unit test on the phone: a tap on the top safe-area strip leaves the sheet open, touched or untouched.
  - The existing unsaved-changes tests pass unedited.
- **Computer untouched (criterion 20)**: the computer captures of touched screens are unchanged. `PriceFrame`'s dialog branch and `CobroFrame`'s computer branch have 0 changed lines.
- **Offender lists (GH-319)**: 0 entries added outside gate.md's trade or new-row rules. Each new assertion is shown failing once on a deliberately regressed input in the PR, and that input is not committed.

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
- Changing the contract checker so it can declare a nullable array; a `null` checklist.
- A `nothing_qualifies` that answers for every kind, or a catalog read added to every Home read for it.
- Theme coverage of Home's Today, Week and Month figures as part of the first-run review.
- Analysis's content on the phone (its three tables and month selector): GH-319's part 2.
- Converting Change password, the expense categories editor or New sale's new-customer overlay into sheets.
- Any computer layout change from the phone layout; changing the timing or dismissal of toasts; changing New sale's tap count or what Save does before the payment choice.
- Disabling Save in New sale; a scroll-and-highlight on Save.
- A tap-outside area on the phone's full-screen sheet: a gap, a visible backdrop strip, or the safe-area strip acting as a close target.
