# Varieties

The varieties a business sells and the price history of each, seen only by that business (ADR-0004). Every other capability reads prices from here: a sale takes the current price of its day, the catalog shows today's.

Varieties is the one screen for a variety. Its list and each variety's page hold:
- the variety's prices (here);
- its stock, entries, withdrawals and low-stock threshold (`stock.md`);
- its catalog attributes (`catalog.md`).

Which price fields a price entry shows and stores follows the business's pricing settings (pricing-settings.md). Varieties is a tab (navigation.md). It replaced the former Stock tab, the old Catalog screen and the old Varieties screens; their paths redirect (navigation.md). It also covers the end of a variety's life: a variety with no history can be deleted, and one with history archived and later restored, with no past figure moving.

## Jobs

**When** I start selling a new variety or change what I charge, **I want** to record the variety once and each price with the date it starts to apply, **so I can** charge the right price on any day without remembering when it changed.

**When** a price changes mid-day and I'm on my phone between orders or mid-chat with a customer, **I want** to record the new price and the day it applies from in a short form that reads as pesos and starts on today, without leaving the variety I was looking at, **so I can** get back to the customer sure the right price is in force, without second-guessing the amount or the date.

This refines the job above for the phone and the computer (on the computer, the variety's page stays behind the form); it is not a new job. Its secondary situation is the Onboarding's step 1, which shares the price fields (onboarding.md). Before it, the computer opened the price form as a page of its own, amounts carried no "$" and the date was a native date field.

**When** I change a message or a screen's chrome, **I want** each shared message to live in one place and the chrome rule to be proven by a test of what the screen shows, **so I** never fix a message in one screen and leave it stale in another, and never ship a card that shows "+ New sale" unnoticed.

Its protagonist is the maintainer of the app, or the reviewer acting for them, in the style of accounts.md's maintainer job; the seller is affected only indirectly. It is served here by the one source of "Check the grams entered" and "Price saved", and by the chrome test that navigation.md's chrome metric asks for. No behaviour of the app changes.

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has (a bulk price if I sell by quantity, and a VIP price I set per variety if I have VIP customers), **so I can** charge every customer exactly what I mean to without typing a special price by hand, without seeing fields that don't apply to me, and without anyone's price changing by surprise. (Served here by the price entry's VIP price and by price fields that follow the switches; defined in pricing-settings.md.)

**When** I run my business from my phone, **I want to** keep my prices up to date from the phone, **so I can** stop keeping them in the spreadsheet and have real data in place when sales arrive.

**When** I buy, harvest or count flower, **I want** to record it from my phone in a few taps, **so I can** know what I have of each variety, see one running out before a customer asks for it, and know what the grams I sell or gift cost me. (Served here by the list's status, the variety's page, its low-stock warning and "+ Stock entry"; defined in `stock.md`.)

**When** I take grams out of my own stock without selling them (to share at a party so
people get to know the business, or for my own use), **I want** to record them from my
phone in a few taps (date, varieties and grams, the reason), **so I can** keep stock right
and see in Profit what promoting the business and my own consumption cost me, without
recording a sale nobody made or an adjustment that reads as lost flower. (Served here by
"Take from stock" on the list and on a variety's page, and the withdrawals in its "Stock y
entradas"; defined in `stock.md`.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, with everything about one variety in one place, **so I can** get back to the customer instead of hunting through menus, and never wonder which of several screens holds what I need. (The navigation job, navigation.md.)

**When** I'm in the middle of serving a customer with my phone in hand, **I want** the app to behave like a phone app (a form that fills the screen with its main action under my thumb, and nothing I need hidden behind the keyboard), **so I can** record a price or edit a variety without fighting the screen or losing what I typed. (The phone layout job, navigation.md, GH-319: served here by the price form, New variety and a variety's rename, low-stock warning and catalog attributes forms, drawn on the phone by the one shared `Sheet`.)

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page (its stock and entries, its prices, its low-stock warning and how it shows in the catalog), the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell.

This one is the navigation job applied to varieties, stock and the catalog, not a
new job; its main situation is mid-chat, between orders. The stock and catalog jobs stay
in `stock.md` and `catalog.md`; the computer is the same job on two panes.

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my
lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if
it never moved and archiving it if it has history, **so** my lists show only what I still
sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly
as it was if I start selling it again.

This one is the varieties and navigation job applied to the end of a variety's life,
not a new job. Before it, a seller could only hide such a variety from the catalog and
live with it in the lists, rename it to something like "NO USAR" or leave it sold out.

**When** I open a variety I archived, from Archived, to check what it was or to bring it
back, **I want** its page to read at a glance as archived and read-only, with everything it
had (summary, hidden flag, prices, stock and movements, low-stock warning, catalog
attributes) still in view and Restore as its one safe action, **so I can** decide whether
to bring it back and leave knowing I changed nothing by accident. And when I delete a
variety that never moved, the delete looks like what it is: permanent.

This refines the end-of-life job above for the archived page and the live page's delete;
it is not a new job. Its secondary audience is the reviewer acting for the maintainer
(design-capture.md), who approves the archived page and Archived from drawings and
before/after captures, not by reading code. Before it, the archived page left out "Hidden",
the low-stock warning and the catalog attributes, styled "Archived" like "Hidden" next to
a live status mark, turned into the live variety in place on Restore, and had no drawing,
registry row or seeded variety to compare against.

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
5. Varieties says on its own, by shape and word and never by color alone, when a variety
   is sold out or below its threshold (`stock.md`, criterion 4). The summary line is
   never blank.
6. **One variety, one page**: a variety's stock and its movements (entries and
   withdrawals), prices, low-stock warning and
   catalog attributes are seen and edited from its page, and from no other screen. Every
   edit there ends in an explicit save, so the seller always knows a change was kept.
7. **Two taps at most**: from any tab root, the catalog screen ("Send catalog") and
   the stock entry form ("+ Stock entry") open in at most 2 taps; a computer never
   takes more than the phone. An entry started from a variety's page has that variety
   chosen, with "Initial stock" preselected only when it has no entries.
8. **Nothing lost, nothing invented**: everything a seller could do on the former Stock,
   Catalog and Varieties screens is still reachable; every old path redirects
   permanently; no link points at a screen that does not exist.
9. **Out of the way in a few taps**: from a variety's own page, on phone and computer, the
   seller takes it out of every list and picker. The app offers Delete only when the
   variety has no history, and Archive otherwise. It never offers a delete that will be
   refused.
10. **The books don't move**: after archiving, every past sale and its lines, stock
    figure, cost of goods, stock shortfall, Profit, Cash, Analysis figure and customer
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
15. **Only my rules show, and switching loses nothing** (pricing-settings.md):
    - With Bulk price off, no bulk price or bulk minimum shows in the price form or on the variety's page.
    - With Customers VIP off, no VIP price shows.
    - Switched back on, every stored bulk and VIP price shows again.
16. **The price form looks as designed**: it matches `docs/product/design-system/pantallas/` on the phone and the computer, in both themes:
    - on the computer, a modal over the variety's page, never a page of its own;
    - a "$" before every peso amount (list, bulk and VIP price; never the bulk minimum);
    - the effective date shown as a "Today" chip by default.
17. **A price from today in the fewest taps**: recording a price effective today never requires opening a date picker. Choosing another date stays possible.
18. **One message, one source**: every message shown on more than one screen ("Check the grams entered" in the price, stock entry and withdrawal forms) has one source, and so does the toast "Price saved". The wording a seller sees does not change anywhere.
19. **Read as archived, nothing hidden**: an archived variety's page says "Archived" in
    words, and "Hidden" when the variety is hidden. It shows its summary, prices, stock and
    movements, low-stock warning and catalog attributes, all read-only, with no action but
    Restore. No state is told by colour alone, in either theme. Restoring still meets
    criteria 10 and 11.
20. **The right weight on each action**: "Delete variety" (a live variety with no
    history) is drawn as a destructive action; Restore is drawn as a safe action, with no
    confirmation.
21. **Approved from evidence**: the archived page and Archived have drawings in
    `pantallas/` on phone and computer, light and dark; the sample app seeds one archived
    variety; `scripts/design/screens.json` lists both pages; before/after captures
    (ADR-0042) are attached to the PR with every difference listed.

## Behaviour

- **Variety**: a name, trimmed, inner spaces collapsed, up to 60 characters. Renaming keeps its prices. Varieties are listed by name.
- **Price entry**: an effective date and a list price per gram in whole pesos. Optionally, it also has:
  - a bulk price per gram with its bulk minimum in grams (up to two decimals). The two come together or not at all, and the bulk price is lower than the list price;
  - a VIP price per gram, in whole pesos, lower than the list price. It is independent of the bulk price and minimum (an entry may have either one alone) and is never compared with the bulk price.

  Every amount is above zero.
- **A VIP price at or above the list price** is refused with its own fixed message and its own refusal code (ADR-0008), which never repeats the amount (ADR-0005).
- **Rules switched off** (pricing-settings.md):
  - A price entry recorded while Bulk price is off stores no bulk price or bulk minimum, and one recorded while VIP customers is off stores no VIP price, whatever the request sends. Nothing is copied forward from an earlier entry.
  - Earlier entries keep what they stored.
  - When a rule is switched back on, the current price shows no bulk or VIP line if its entry has none; the seller records a new entry if they want one.
- One entry per variety per effective date; a second one on the same date is refused.
- **No edits**: a price entry is never edited, its VIP price included. A new entry replaces it from its own date (ADR-0003).
- **Deleting a price entry** (`DELETE /varieties/{id}/prices/{entry_id}`, ADR-0003): any entry may be deleted, the one in force today included. The entry before it applies again.
- A variety's own representation carries its current price **today**, `null` when it has none. Today is the business day in Argentina time. Answers carry what is stored, together with the business's switches; screens hide what is switched off.
- The price history lists the newest entry first.
- **Low-stock threshold**: optional grams, above zero, up to two decimals, set or turned off per variety. Turned off means the variety has none; no former amount is kept. Its rules and the stock status are in `stock.md`.

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
    the same moment either blocks the delete or is refused as "That is gone". Nothing is
    ever orphaned.
  - A variety already gone answers 404 and follows accounts.md: "That is gone. The list is up to date."
- **Archive**: offered for a variety with history. It leaves every list and picker but
  stays in the books.
  - Archive is never refused for having or lacking history. If the variety's last sale or
    entry was deleted after the page loaded, tapping "Archive variety" still archives
    it; it can be deleted later by restoring it first. An archived variety may also lose
    all its history while archived (its last entry or sale deleted); the same path
    applies.
  - Archiving a variety already archived changes nothing; one already gone answers "That is gone. The list is up to date."
  - Allowed with stock above, at or below zero, always after a confirmation.
  - Archiving and restoring never create a stock entry and never change stock, lots, cost
    of goods, pending cost, prices or any other figure.
  - Archive and hide are independent: archiving keeps the hidden flag, and restoring
    brings it back as it was.
  - Archiving and restoring are upkeep triggers for the pinned catalog
    (pinned-catalog.md).
- **An archived variety is left out of**:
  - Varieties' list and its summary line;
  - Home's What you have left, and the "Start with your varieties" rule (results.md);
  - New sale's variety picker (`sales.md`);
  - the stock entry form's variety picker (`stock.md`);
  - the price entry form;
  - the catalog text and the catalog screen's "what does not go out" list (`catalog.md`);
  - the pinned catalog.
- **Past records keep it, by its plain name, with no "Archived" tag and no figure
  changed**: Sales and a sale's detail, the customer's account, All entries,
  Analysis' variety rows and every week, month and since-the-start figure, Results'
  Profit and Cash, and the business export (which holds the archived flag as a stored
  fact).
- **Existing records stay workable** (ADR-0009): a stock entry of an archived variety can
  be edited or deleted from All entries; a sale containing one can be deleted,
  Undo included; Assign customer still works. An entry edit can keep the archived
  variety it already has, but can never move the entry onto a different archived one.
- **Nothing new is recorded against an archived variety**: no sale line, stock entry or
  price entry; such a reference answers as gone. A form left open while a partner
  archives the variety is refused on save with accounts.md's "That is gone" rule and
  keeps the rest of what was typed where the screen allows. In New sale the line shows
  the generic gone message and the form stays open (sales.md's rule for a variety not
  found).
- **Names**: an archived variety keeps its name reserved under the uniqueness rule (case
  and spacing ignored).
  - Adding or renaming a variety to that name is refused inline with its own fixed
    refusal: the name belongs to an archived variety, look in Archived. It repeats
    nothing typed.
  - An archived variety can be renamed only after it is restored, so restore never
    collides: Restore has no name-clash refusal and no error state of its own. Its only
    other outcome is accounts.md's "That is gone." for a variety that is gone.
  - A deleted variety's name is free at once.

### Routes

- The routes are those in `scripts/design/screens.json`: `/varieties`,
  `/varieties/{low}`, `/varieties/catalog`, `/varieties/entries`,
  `/varieties/entries/new`, `/varieties/entries/{id}` (editing a stock entry),
  `/varieties/{low}/entries` (a variety's "See all" of entries and withdrawals),
  `/varieties/{low}/prices`, `/varieties/{low}/prices/new`, `/varieties/new` and
  `/varieties/archived` (the Archived card). An archived variety's page is the same
  `/varieties/{low}`, read-only.
- A reload on any of them opens the screen, never the API's answer (ADR-0024 and
  ADR-0033 govern paths shared with the API).
- Old paths (`/variedades`, `/mi-stock`, `/mi-stock/nueva-entrada`,
  `/mi-stock/entradas/{id}`, `/catalogo` and every other former Stock, Varieties or
  Catalog path) redirect permanently (navigation.md).

### On screen: the Varieties list (`Varieties`)

- **A tab root** (navigation.md). On a computer it is two panes: the list on the left, the
  selected variety's page on the right.
  - **On a computer**, opening Varieties with nothing selected selects the first
    unarchived variety by name automatically, so a figure is always in view; this counts
    as no tap, and picking another variety replaces it. With no varieties, the right pane
    holds nothing that could be read as data.
  - Archiving or deleting the selected variety selects the next one by name, else the
    previous one, else the empty state.
  - **On the phone**, the list is the screen; it never opens a variety on its own.
  - A selected variety that is gone follows accounts.md's "That is gone." rule.
- **Every unarchived variety**, hidden ones included, sorted by name, in a stable order.
- **Each row**:
  - the name;
  - its stock status mark (`MarcaEstado`: square = sold out as the inverted chip, filled
    circle = low, empty circle = ok) and its word, with "no entries" when it has none
    and its detail line (`stock.md`);
  - "Hidden" beside the status when the variety is hidden from the catalog. It never
    replaces the stock status: a hidden variety can still be sold, gifted, withdrawn and
    restocked;
  - grams and days left;
  - today's list price per gram, or "No price: cannot be sold" when it has none.
- **The summary line**, above the list, counting unarchived varieties only:
  - with no varieties at all: no summary line, and a fixed empty state inviting the seller
    to add the first variety;
  - with every variety ok: "N varieties · all ok";
  - otherwise: every status that is not ok, counted by word, in stock-status order (e.g. "1 no entries · 1 sold out · 1 low"). It is never blank.
  - The exact wording is design's, as long as each state is told by word.
- **"Send catalog"** at the top, opening the catalog screen (`catalog.md`). It is
  disabled, with its reason in words, only while the first-run checklist shows and nothing
  qualifies (navigation.md).
- **"+ Stock entry"**, a secondary button above the list (not a floating button),
  opening the stock entry form with the variety to be chosen (`stock.md`).
- **"Take from stock"**, a secondary button next to "+ Stock entry", on phone and
  computer, opening the stock withdrawal form with no variety chosen (`stock.md`).
- **"New variety"**: adds a variety (a form; on the phone a sheet drawn by the one shared `Sheet`, over Varieties, navigation.md's Phone layout).
- **"All entries"** at the foot (`stock.md`), at `/varieties/entries`. It lists entries only.
- **"Archived (N)"** at the foot, next to "All entries", opening the Archived
  card. It is left out when there are none.

### On screen: Archived

- **A card** (navigation.md) at `/varieties/archived`: the bar or sidebar and
  "‹ Varieties", without "+ New sale".
- It lists every archived variety by name. Each row marks "Archived" as a neutral
  badge (a word, with no colour carrying the state, in both themes) and "Hidden", in its
  own text style beside it, when the variety is hidden, so the seller knows what Restore
  will bring back. Each row carries "Restore", icon + text, in a secondary row-action
  size, with the same icon and word as the archived page's Restore.
- On a computer it uses the same two panes; opened with nothing selected, it selects the
  first archived variety by name.
- **Restore** on a row is one tap with no confirmation, shows the toast "Variety
  restored", and the variety returns to Varieties' list exactly as it was: hidden flag,
  prices, stock, entries, threshold and catalog attributes.

### On screen: a variety's page (`VariedadDetalle`)

- **A detail** (navigation.md): the bar or sidebar and "‹ Varieties", without
  "+ New sale".
- **The summary line** at the top: grams, status, days left and today's list price (e.g.
  "64 g · ok · 21 days · $ 11.000 x g"), with "Hidden" when hidden.
- **Three actions**: "+ Entry" (the stock entry form with this variety chosen, and
  "Initial stock" preselected only when it has no entries, `stock.md`), "New price"
  (the price entry form) and "Take from stock" (the stock withdrawal form with this
  variety chosen, `stock.md`).
- **Sections**:
  - **Stock and entries**: the variety's last 3 movements (its stock entries and the
    withdrawals that touch it, newest date first, then most recently recorded first) and
    "See all", which opens `/varieties/{low}/entries`: the same list as "All
    entries", filtered to this variety, with its withdrawals, where each entry can be
    edited or deleted (`stock.md`). A withdrawal row shows its date, "Promotion" or
    "Own use" and this variety's grams with a minus sign, and opens the
    withdrawal's detail;
  - **Prices**: the last 3 price entries with "Effective from", newest first, each row with
    its delete action, and "See all" (`/varieties/{low}/prices`) for the full history.
    - Each row shows the list price.
    - It shows the bulk price and minimum only while Bulk price is on, and the VIP price ("VIP price") only while VIP customers is on, each only when the entry has one;
  - **Low stock warning**: the current warning, read-only, with an on/off switch and an
    "Edit" link, and nothing else (no "See all"):
    - it reads "Warn me below 15 g", "Warning: 18,5 g left" or "Warning off";
    - "Edit" opens a small form: "Warn when below" in grams, "Save the warning" and "Close". A refused amount shows under the field and keeps what was typed;
    - turning the switch on opens that same form (an off warning keeps no amount); closing it without saving leaves the warning off;
    - turning the switch off saves at once;
    - every save, the switch-off included, shows the toast "Warning saved";
  - **In the catalog**: the variety's catalog attributes, read-only (shown or hidden, emoji, % indica, aroma/sabor), with an "Edit" link, and nothing else (no "See all"). It is the only place they are edited (`catalog.md`):
    - "Edit" opens one form with "Show in the catalog", Emoji, % indica and Aroma/flavor, ending in "Save the catalog";
    - each refusal (for example an aroma over 200 characters) shows under its own field and keeps everything typed;
    - leaving with something typed and not saved asks before discarding;
    - a save shows the toast "Catalog saved".
- **One removal action**, worked out from history when the page is read:
  - with no history: "Delete variety", through a destructive ConfirmDialog, then the
    toast "Variety deleted" and back to Varieties.
    - The trigger on the page is drawn as a visibly critical action: icon + text with the
      `tacho` icon, its accessible name unchanged, and never a filled button outside a
      confirmation. The filled critical button is the ConfirmDialog's confirm answer only.
    - Its exact treatment is design's, inside the existing tokens and the icon and text
      rule; a style the design system lacks is drawn from tokens before it is built.
  - with history: "Archive variety", through a confirmation that names the grams on hand
    when stock is not zero (e.g. "You have 12 g left. If you archive it, they stop showing on Home
    and in the lists, but the stock is kept.") and simply asks with zero stock (the
    exact wording is design's), then the toast "Variety archived". Its trigger keeps a
    non-destructive look, clearly distinct from "Delete variety": archiving loses
    nothing and can be undone.
  - **Stale page, delete**: if history appeared after the page loaded, the delete is
    refused with its coded refusal and the page refreshes to show "Archive variety". The
    UI never offers a delete it knows will be refused.
  - **Stale page, archive**: if the history went away after the page loaded, "Archive
    variety" still archives it, with no refusal.
- **An archived variety's page** is the same page, read-only, with the back arrow
  "‹ Archived" (with no history, back goes to Archived):
  - **Its summary line**: its grams, as a figure even when negative; today's list price,
    or "No price"; "Archived" as a neutral badge (a word, with no colour carrying
    the state, in both themes); and "Hidden", in its own text style beside it, when the
    variety is hidden. It shows no stock status mark and no days left: those warn about
    selling and restocking, and an archived variety is out of every list, picker and
    Home.
  - **"Restore"** is its one action: a primary icon + text action, in the place of the
    live page's three actions, right under the summary line and its marks, so on the phone
    it is reachable without scrolling past any section. Nothing sits next to it. Its icon
    is a `NombreIcono` name; if none fits, design draws one under the icon rule.
  - **Its sections, all read-only**:
    - **Stock and entries**: the last 3 movements, with "See all";
    - **Prices**: the last 3 price entries, with "See all", following the same switch
      rule as the live Prices section (no VIP price while Customers VIP is off);
    - **Low stock warning**: the stored setting only, "Warn me below N g" or "Warning
      off"; never the live "Warning: N g left"; no switch and no "Edit";
    - **In the catalog**: the four stored attributes (shown or hidden in words, emoji,
      % indica, aroma/sabor), an attribute never set left out; no "Edit" and no note
      about the public catalog.
  - **"See all" from it** opens read-only lists: the prices list has no price delete;
    in the movements list, entry rows have no edit or delete and open nothing, while
    withdrawal rows still open the withdrawal's own detail (its back follows history to
    this list, and with no history goes to Varieties). Each list's back arrow names the
    variety and returns to its archived page. Entries stay editable and deletable from
    "All entries", and withdrawals from their own detail, so nothing is lost.
  - no "+ Entry", "Take from stock", "New price", price delete, threshold switch,
    rename, Edit forms or removal action;
  - **Restore from the page** shows the toast "Variety restored" and goes back to
    Archived in one move; the page never turns into the live variety in place, and no
    history entry is duplicated. On a computer, Archived' right pane then selects the
    next archived variety by name, else the previous one, replacing the current history
    entry. With no archived variety left, it goes to Varieties, so an empty Archived is
    never shown. The variety comes back exactly as it was;
  - to delete an archived variety that has no history, the seller restores it first, then
    deletes it. There is no second path.
- **"See all" lists** are cards (navigation.md): the bar or sidebar and "‹ <variety>",
  without "+ New sale"; back with no history goes to the variety's page. The full price
  history follows the same switch rule as the Prices section.
- **Renaming** the variety is done here.
- **Forms** opened from here (New price, + Entry, Take from stock, rename, the low-stock warning, the
  catalog attributes) have "Close" and a confirmation when leaving with something typed;
  an untouched one closes at once.
  - On the phone each is a full-screen sheet drawn by the one shared `Sheet` (ADR-0062,
    navigation.md's Phone layout), with its main action pinned at the bottom of the form.
  - Rename, the low-stock warning and the catalog attributes open as sheets over this
    page, which stays behind them, and share the page's one record of unsaved changes.
    Back closes the sheet first and never jumps over the page.
- **Deleting a price entry**: confirmed with "Before deleting" ("Delete…? / No, keep it /
  Yes, delete it"), and the copy says what takes the entry's place:
  - with an earlier entry, the price that applies again and its date, e.g. "Back to
    $ 9.000 x g from 12/09";
  - for the first entry, that there is no price before the next entry's date;
  - for the only entry, that the variety is left "No price: cannot be sold".

  The copy never mentions sales.
- **After deleting**, today's prices update at once on the page and the list. Home may
  show "Start with your varieties" again.
- **Toasts**: "Variety saved", "Price saved", "Price deleted", "Variety
  deleted", "Variety archived" and "Variety restored", with no names or amounts in
  them (plus "Warning saved", "Catalog saved" and the entry form's "Entry
  saved").
- **Refusals**, such as a duplicate name, a name held by an archived variety, a
  duplicate date or a VIP price at or above the list price, show inline and keep what was
  typed.
- **A variety that is gone**, or another business's variety (archived or not) opened by
  id, follows accounts.md's "That is gone." rule, with "Back to Varieties".
- No network shows "No connection"; a server error shows the generic retry (accounts.md).
- Everything works on phone and computer, light and dark; no state is told by colour
  alone.

### On screen: the price entry form ("New price")

- **Kind**: a form (navigation.md) on both devices: no bar and no "+ New sale"; "Close"; leaving with something typed asks before discarding, and an untouched form closes at once. Back with no history goes to the variety's page. Only how it is drawn on the computer differs.
- **Fields**:
  - the effective date and the list price;
  - the bulk price and bulk minimum only while Bulk price is on, and "VIP price" only while VIP customers is on, each optional;
  - it says nothing about a rule that is switched off.
- **Amounts in pesos**: the list price, the bulk price and the VIP price each show "$" before the amount. The bulk minimum, in grams, never does. The "$" is text under the design README's contrast rule (ADR-0029), drawn with existing tokens only. These fields are the shared price fields, so the "$" also shows in the Onboarding's step 1 (onboarding.md).
- **"Effective from", a date chip**:
  - it reads "Today dd/mm" by default, as New sale's date does (sales.md);
  - tapping it opens the date choice; how that choice looks is design's, as long as it is reached from the chip;
  - a chosen day that is not today reads "dd/mm", without "Today";
  - going back to today is done from the same chip, where "Today" can be found; there is no separate control, and it never takes more than the chip and its choice;
  - recording a price effective today never requires opening a date picker;
  - the date rules are unchanged: any date is allowed, one entry per variety per date, and a refused date is refused as before;
  - the chosen date is kept when the save is refused for any field.
- **On the phone**: a full-screen sheet drawn by the one shared `Sheet` (ADR-0062, navigation.md's Phone layout), with "Close" at the top and "Save the price" pinned at the bottom of the form, above the keyboard; refusals sit above it. It has no outside: "Close" and the phone's back gesture are its exits. Opened by a direct link, it shows over that variety's page, which stays inert behind it. Resizing across 900 px or rotating the phone keeps what was typed.
- **On a computer**: a modal over the variety's page, unchanged by the phone layout (ADR-0044).
  - "Close" returns to that page; a successful save returns there too, shows the toast "Price saved", and the Prices section shows the new entry.
  - A refusal keeps the modal open with everything typed, inline on its field.
  - Opened by a direct link (`/varieties/{low}/prices/new`), it shows the modal over that variety's page.
  - While the modal is open, the variety list behind it cannot be used.
- **A variety archived or gone** while the form is open follows accounts.md's "That is gone" rule, as before.

### Design evidence for the archived pages

- **Drawings**: `docs/product/design-system/pantallas/` draws the archived variety's page
  and Archived, on phone and computer, in light and dark; on a computer, Archived is
  two panes with the first archived variety by name selected. They cover the summary
  line, the "Archived" badge and "Hidden", the read-only sections and Restore. The
  live page's critical "Delete variety" trigger is drawn too.
- **Registry** (`scripts/design/screens.json`): the existing `VariedadArchivada` and
  `VariedadArchivadaOscuro` entries point at the new drawing and the seeded archived
  variety, never duplicated; the computer twins and the Archived rows (phone and computer,
  light and dark) are added. Each row reaches its screen the way a seller does and
  captures its section whole (design-capture.md).
- **Sample app** (`scripts/design/sample_app.py`): it seeds exactly one archived variety,
  hidden, whose only history is one opening-stock entry recorded with no cost, dated on or
  after the sample business's first record (no sale, no withdrawal), with a low-stock
  threshold, catalog attributes (emoji, % indica, aroma) and a current price entry. Every
  period figure on Home, Sales and Analysis stays as `muestra.md` has it; `muestra.md`
  gains only that variety's own rows, recaptured by the script (ADR-0035).
- **Muestra guard**: it checks the archived variety's own grams, "Archived" and "Hidden"
  on its screens, not only denylisted literals.

### Constraints

- Every route, the delete, archive and restore routes included, joins the isolation sweep
  and the gated-route test (ADR-0004).
- Refusal codes in `contract.json` (ADR-0008): a delete with history; a name held by an
  archived variety; an archived variety referenced for a new record (gone). Archive has no
  refusal of its own. None repeats a name or an amount (ADR-0005).
- **One source per shared message**: in the front, "Check the grams entered" (shown by the price, stock entry and withdrawal forms) and the toast "Price saved" are each defined once and read from there; no screen restates either as its own literal.
- **Phone layout (GH-319)**: the price form's phone branch, New variety and the three inline edits are drawn by the one shared `Sheet`; ADR-0044's `PriceFrame` dialog branch is not edited, and the registry keys `VariedadRenombrar`, `VariedadUmbral` and `CatalogoAtributos` are kept.

## Metrics

- **Price in force (criterion 1)**: tests over the history answer the latest entry on or
  before a day, and none before the first. 100% passing.
- **Past untouched (criterion 2)**: deleting an entry makes the previous one current again,
  covered by tests through the API and the front.
- **Unique names (criterion 3)**: duplicates within a business, whatever the case or
  spacing, are 0, archived varieties included.
- **VIP price validation**: 100% passing.
  - At or above the list price is refused with its own code, which is in `contract.json` and checked by `tests/test_refusal_codes.py`.
  - A VIP price with no bulk price, and a bulk price with no VIP price, are accepted.
  - No refusal contains the amount.
- **Switched-off rules store nothing (criterion 15)**: a price entry sent with bulk or VIP values while that rule is off stores none of them; earlier entries' values are unchanged.
- **Switches on screen (criterion 15)**: front tests show the price form, the Prices section and the full history with no bulk fields while Bulk price is off and no VIP price while VIP customers is off, and every stored value back once switched on.
- **No curl (criterion 4)**: the end-to-end front run adds a variety, adds a price from its
  page (with a VIP price when VIP customers is on), renames the variety, deletes a price
  entry, sets a low-stock threshold through "Edit", turns it off and on again through the
  switch, and edits the variety's catalog attributes through "Edit" and "Save the
  catalog", all from its page, and records a withdrawal from its page. It also deletes a
  fresh variety, archives one with a sale, finds it in Archived, opens its read-only page
  and restores it.
- **Status shown (criterion 5)**: the list and the page show the status mark and word for
  each status, "Hidden" beside (never instead of) the status of a hidden variety, and the
  summary line for no varieties, all ok and a mix; never by color alone; covered by the
  front tests and checked by eye in both themes.
- **One page (criterion 6)**: no other screen offers an edit of a variety's prices,
  entries' variety-level view, threshold or catalog attributes; checked against the docs
  and the design. Front tests show only Stock and entries and Prices carry their last 3
  rows and "See all". Withdrawal rows on the page are told apart from entries by word and
  sign, covered by front tests.
- **Saved, never guessed (criterion 6)**: front tests show:
  - Low stock warning and In the catalog read-only until "Edit";
  - switching the warning on opens the threshold form, and "Close" leaves it off;
  - switching it off saves at once with "Warning saved";
  - a too-long aroma refused under its field, everything typed kept;
  - leaving the catalog form with unsaved text asks first, and an untouched form closes at
    once.
- **Two taps (criterion 7)**: the end-to-end run, phone and computer viewports, counts the
  taps from every tab root to the catalog screen and to the stock entry form: 100% within
  2, a computer never more than the phone; an entry from a variety's page has the variety
  chosen and "Initial stock" preselected only with no entries.
- **Two panes**: on a computer viewport, nothing selected shows the first unarchived
  variety by name; no varieties leaves the right pane with no figure; archiving or
  deleting the selected variety selects the next, else the previous, else the empty
  state; on the phone the list never opens a variety.
- **Nothing lost (criterion 8)**: every old Stock, Varieties and Catalog path answers a
  permanent redirect, tested one by one, `/mi-stock/entradas/{id}` included; every old
  action maps to a place in the new screens; no link points at a missing screen; a reload
  on `/varieties/{low}/entries`, `/varieties/entries/{id}` and `/varieties/archived`
  opens the screen.
- **Offered action (criteria 9, 12)**: a matrix, 100% passing. The page offers "Delete
  variety" exactly when the variety has no history and "Archive variety" otherwise,
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
  variety absent from Varieties' list and summary line, What you have left, New sale's,
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
  it (Undo included) and Assign customer still work.
- **Findable (criterion 13)**: "Archived (N)" shows the right count and is absent with
  none; restore takes 1 tap from the card and from the archived page; the archived page
  offers no action but "Restore".
- **Taps (criterion 9)**: through the front on a phone viewport, archiving or deleting
  takes the action plus its confirmation from the variety's page; a computer takes no
  more.
- **Isolation (criterion 14)**: another business's variety or entry, archived or not,
  opened by id shows "That is gone."; every route, delete, archive and restore
  included, is in the sweep and the gated-route test; after a full front run, the console
  and browser storage hold no names or amounts, and no refusal or toast carries a name or
  an amount.
- **Read as archived (criterion 19)**: front tests on an archived variety's page, hidden
  and shown, show "Archived", plus "Hidden" when hidden; grams and price with no status
  mark and no days left; the four sections read-only, the threshold as a stored statement
  and never "Warning"; and no action but "Restore". Archived rows show "Archived"
  and, when hidden, "Hidden". No state is told by colour alone, in both themes. The
  muestra guard checks the seeded archived variety's grams, "Archived" and "Hidden".
- **Right weight (criterion 20)**: front tests show the "Delete variety" trigger as
  icon + text with `tacho`, never a filled button, and the filled critical button only in
  its ConfirmDialog; "Archive variety" not drawn as destructive; Restore icon + text,
  primary on the page and secondary on an Archived row, with no confirmation.
- **Restore landing**: front tests show Restore from the archived page showing "Variety
  restored" and landing on Archived in one move; on a computer the next archived
  variety by name selected, else the previous one; Varieties when none is left; no
  duplicated history entry; the page never becoming the live variety in place; the
  Archived row's restore unchanged.
- **Read-only lists**: front tests show the archived page's "See all" lists with no price
  delete and no entry edit, delete or open; withdrawal rows still opening their detail;
  each list's back arrow returning to the archived page.
- **No regression (criteria 19–21)**: the existing varieties suites pass with no assertion
  edited, criteria 10 and 11's metrics included, except those that pinned the old icon-only
  delete, the archived page's old omissions, or the old restore-in-place landing (which
  criterion 1 of the restore reverses); the PR lists each.
- **Approved from evidence (criterion 21)**: the four drawings exist for the archived
  page and for Archived; `screens.json` lists them and their twins with no duplicate key
  (`assertScreens`); the sample app seeds one archived variety and `muestra.md` changes
  only by its rows; before/after captures from one script and one install, on the same
  Argentina day, with the fontsource version recorded (ADR-0042), are attached to the PR
  with every difference listed. The delete trigger is judged by its front test and the
  drawing, and by a capture only where a registry row already reaches a variety with no
  history.
- **Design**: `scripts/design/compare.sh` runs before and after for the list, the page,
  Archived and the archived page, phone and computer, both themes, attached to the PR
  and judged by eye. The PR lists the two agreed departures from the drawing (the
  "Edit" forms of Low stock warning and In the catalog).
- **Price form looks as designed (criterion 16)**:
  - `scripts/design/compare.sh` runs before and after for the price form, phone and computer, both themes, and for the Onboarding's step 1, attached to the PR and judged by eye; every design-vs-docs difference is listed in the PR;
  - `scripts/design/screens.json` holds the price form's dark twins (phone and computer), following the dark-twin convention, and the Onboarding's price step, and `compare.sh` measures them.
- **"$" scope (criterion 16)**: front tests show the "$" on the list, bulk and VIP price, never on the bulk minimum, and the same in the Onboarding's step 1, which shows no date chip.
- **Date chip (criterion 17)**: front tests show "Today dd/mm" by default and "dd/mm" for another day, going back to today from the chip, the chosen date kept after a refused save, and no native date input opened to record a price from today.
- **Modal (criterion 16)**: front tests through the real routes show the modal on a computer viewport and a full-screen sheet on the phone, a direct link rendering the modal over its variety, the list behind it inert, and the close, save ("Price saved", the new entry in Prices) and discard flows. A viewport-flip test (phone to computer and back) keeps what was typed (GH-319).
- **Sheets on a variety (GH-319)**: front tests show focus on the first field and exactly one "Close" in New variety and in the rename, low-stock warning and catalog attributes sheets; a direct address to New variety shows it over Varieties; an e2e run shows the rename sheet's action within `--inset-abajo` of the sheet's bottom.
- **One source (criterion 18)**: a test shows "Check the grams entered" and "Price saved" each defined once, and the rendered text in every screen that shows them unchanged.
- **Chrome proven by behaviour** (navigation.md, criterion 5): a Shell test shows "+ New sale" on a tab root and absent under card chrome.
- **No regression (criteria 16–18)**: the existing suites pass; the only edited tests are those that found the native date input or the page layout, each listed in the PR; the contrast guard (ADR-0029) passes with no token change.
- **Speed**: Varieties answers in under 300 ms with a few dozen varieties.

## Out of scope

- The rules of catalog attributes: the catalog capability (they are edited here).
- The rules of stock withdrawals: the stock capability (they are started and seen here).
- Deleting a variety with history, by any path.
- Deleting an archived variety without restoring it first.
- Refusing an archive because the variety has no history.
- Merging varieties, or taking over an archived variety's name.
- Deleting, archiving or restoring several varieties at once; archiving or deleting from
  the list itself.
- An "Archived" tag on past records.
- Moving a stock entry onto an archived variety.
- Live updates between partners while a screen is open.
- Settings and its groups, the pricing switches included (pricing-settings.md).
- Editing catalog attributes or the threshold in place, without a form and a save.
- Editing a price entry, its VIP price included (ADR-0003).
- Copying a hidden rule's prices forward onto a new entry.
- Other VIP rules (a percent off list); price promotions by date.
- Documenting the price form's divergence from the design instead of bringing it in line.
- A date choice in the Onboarding's step 1; any change to a price entry's date rules.
- A new token or a change to any token value for the price form.
- Reworking the archived page's back arrow (navigation.md, ADR-0045).
- A live stock status, days left or "Warning" warning on an archived variety.
- Editing anything from an archived variety's page or its "See all" lists.
- A name-clash refusal or error state for Restore.
- Usage metrics for archived pages.

## Planned in GH-318

Not built yet. Until the part named ships, the sections above are what the app does.

The epic lets a business describe what it sells in its own words. Each passage names the ADR that decides it, the part that will deliver it, and the current sentence it will replace. The part that delivers a passage removes it from here and edits Behaviour and Out of scope in the same diff.

### The product word

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md and docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md; delivered by the product word part, with the Product rename on the wire for the API path.

- The seller will choose the word for what is sold, singular and plural. The default will be "Product" / "Products". It will be shown as typed and never translated, because it is the seller's own data.
- Code, tests and docs will say Product, and the API path will become `/api/products`. Columns that reference a variety's id will stay `variety_id` until #75 (ADR-0061). The front paths under `/varieties/*` will not move.
- It will replace: "**Variety**: a name, trimmed, inner spaces collapsed, up to 60 characters. Renaming keeps its prices. Varieties are listed by name." and the capability's title, "The varieties a business sells and the price history of each".

### Categories, subcategories and attributes

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the categories part.

- Products will be grouped in categories and subcategories, two levels deep, and every product will belong to exactly one subcategory. The list, the pickers and the filters will group by category and subcategory.
- A subcategory will be archivable only when it holds no unarchived product; a category only when none of its subcategories is unarchived; the business's last unarchived subcategory never. Restoring a product whose subcategory is archived will be refused until that subcategory is restored.
- Attributes will be defined per subcategory (name, type, required or not, shown in the catalog or not). An attribute no product has a value for will be deletable; one with any value will only be archivable, and every value will be kept.
- Moving a product to another subcategory will keep the values of the attributes both subcategories share and tell the seller, before confirming, which values the product loses. The hidden flag will stay on the product, never an attribute.
- It will replace: "its catalog attributes (`catalog.md`)." in the list of what the page holds, and the fixed attributes of catalog.md's "### Catalog attributes, per variety" (quoted in `catalog.md`'s own Planned section).

### Units and quantities

Decided in docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md; delivered by the units part.

- Each product will have one unit with a name, a short label and 0 to 2 decimals, used for its stock, price, sale quantity, bulk minimum and low-stock threshold. A business will be able to mix units. The unit will be locked once the product has history.
- A quantity will be stored as a whole number of hundredths whatever the unit; the unit's decimals will only validate input and decide display (ADR-0056). Quantities of different units will never be added: a figure that totals quantities will show one amount per unit.
- It will replace: "a list price per gram in whole pesos", "a bulk price per gram with its bulk minimum in grams (up to two decimals)" and "**Low-stock threshold**: optional grams, above zero, up to two decimals".

### Money

Decided in docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; delivered by the money part.

- Prices will cross the wire in currency units, parsed as Decimal, and be stored at the business's own scale, 0 or 2. The business will have its own currency symbol and money decimals (0 to 2).
- It will replace "whole pesos" wherever this file says it, and "Every amount is above zero." keeps holding.

### Customer types

Decided in docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md; delivered by the customer-type prices part.

- Customer types will replace the single VIP mark: each type will have its own price per product, kept as effective-dated rows. The `vip` mark and `vip_price` columns will stay frozen in place.
- It will replace: "a VIP price per gram, in whole pesos, lower than the list price. It is independent of the bulk price and minimum (an entry may have either one alone) and is never compared with the bulk price." and the refusal "**A VIP price at or above the list price**".
- Out of scope: the line "Other VIP rules (a percent off list); price promotions by date." will be split. "price promotions by date" will be reversed by the promotions part (docs/adr/0060-the-applied-promotion-snapshot-is-typed-sale-promotion-rows-recorded-as-the-sale-stood-when-saved-and-never-recomputed.md; see `sales.md`); "Other VIP rules (a percent off list)" will stay out.

### The business day

Decided in docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; delivered by the time-zone part.

- Each business will have a time zone, and "today" will be worked out per business. Recorded dates will never be rewritten.
- It will replace: "Today is the business day in Argentina time."

### Existing businesses

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the parts that build each configuration, each seeding existing businesses with its own default.

- Each existing business will be migrated, with no stored row rewritten, to one category and one subcategory holding emoji, indica share and aroma as attributes; the "grams" / "g" unit with 2 decimals; "Variety" / "Varieties" as its word; "$" with whole pesos; and VIP as a customer type. The hidden flag will stay on each product. It will be able to add categories and subcategories; nothing else will be forced on it.
