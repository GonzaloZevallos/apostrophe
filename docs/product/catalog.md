# Catalog

The text that offers today's sellable varieties to a business's customers. It is seen only by its business (ADR-0004). It is built from:
- each variety's catalog attributes;
- its current price today (varieties.md);
- its stock status right now (stock.md);
- the business's pricing settings (pricing-settings.md), for the bulk line;

between the business's own header and footer. The pinned catalog (pinned-catalog.md) sends exactly this text through the business's own Telegram bot and keeps it current. Compartir and Copiar stay for sending it by hand. An archived variety (varieties.md) is never part of it.

Where its pieces live (navigation.md):
- the catalog screen (`/varieties/catalog`) opens from "Send catalog" on Variedades;
- a variety's attributes are edited on its page, in "In the catalog";
- the header and footer are edited in Configuración → Mensaje del catálogo (or, until that group exists, in the temporary place reached from the catalog screen; see below).

## Jobs

**When** a price changes, a variety sells out or I start offering one, **I want to** open the catalog text the app has already built from today's current prices and stock, check it, and share or copy it in one tap, **so I can** send it to my customers myself (by WhatsApp, Telegram or Instagram) without retyping a price or a variety name, and my customers never see a stale price or a variety I can't sell.

Setting the catalog attributes and the header and footer is the setup step of this same job. Keeping the pinned catalog current on its own (test send, publishing, pinning) is BRIEF.md's Telegram job, served by pinned-catalog.md, which reuses this text as it is.

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has, **so I can** charge every customer exactly what I mean to without seeing fields that don't apply to me. (Defined in pricing-settings.md: served here by the bulk line following Precio por cantidad and the VIP price never reaching customers.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by the catalog screen, at most 2 taps from any tab root.)

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page, the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell. (The navigation job applied to varieties, stock and the catalog, varieties.md: served here by the catalog screen and Compartir.)

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again. (Served here by leaving archived varieties out of the text and of what does not go out; defined in varieties.md.)

Success criteria:

1. **Exact text**: the copied text follows the spreadsheet's format exactly.
   - The header, then one block per variety, then the footer.
   - Each block has its emoji and bolded name, the indica/sativa share, the aroma, the list price per gram and the bulk line.
   - The `**bold**` markers stay in the text.
   - Money is written as `$11.000`.
   - A line is left out when its data is missing (share, aroma, bulk), and the bulk line also while Precio por cantidad is off.
   - It is tested against a reference set with 0 mismatches.
2. **Today, only what can be sold**: a variety appears only when it is unarchived, shown, has a current price on today's Argentina date and has stock above zero right now.
   - Archived, hidden, unpriced, sold-out and never-stocked varieties are out.
   - Low stock is still in.
3. **Fast, from the phone**: from Variedades → "Send catalog", a seller shares or copies today's text in a few seconds without typing anything. Compartir hands the native share sheet exactly the text Copiar copies; without a share sheet, Copiar remains. This includes the phone on the home network over plain http. There is no API call by hand.
4. **No guessing why**: every unarchived variety that does not go out gives one reason, the first that applies: hidden, no price today, then sold out or no entries. It is told by word, never by color alone.
5. **Businesses never mix** (ADR-0004): attributes, header and footer belong to one business. The text and the list never include another business's data.
6. **Customers never see the VIP price**: the text never carries it, whatever the switches.

## Behaviour

### Catalog attributes, per variety

- **Emoji**: optional, exactly one emoji. Plain text or more than one emoji is refused. With none, the name line has no stand-in emoji.
- **Indica share**: optional whole number from 0 to 100; sativa is the rest. It reads "• N% indica / (100−N)% sativa", including the 0 and 100 edges. With none, the line is left out.
- **Aroma**: optional.
  - It is trimmed, and every run of whitespace, line breaks included, collapses to one space.
  - It holds up to 200 characters.
  - Empty means none, and the line is left out.
  - `*` is allowed (see Bold markers).
- **Shown**: yes or no.
  - Yes by default for a new variety.
  - Yes for every variety that existed when the catalog shipped.
- **Who can be edited**: every unarchived variety, including ones out for lack of price or stock. An archived variety's attributes are read-only until it is restored, and archiving or restoring keeps them, the shown flag included (varieties.md).
- **No side effects**: the attributes never touch prices, stock or sales.
- **Where**: they are edited only on the variety's own page, in its "In the catalog" section (varieties.md), never on the catalog screen.

### Header and footer, per business

- **Shape**: free multi-line text, up to 500 characters each. Inner line breaks are kept; leading and trailing blank lines are trimmed.
- **Blank**: allowed. A blank header or footer is left out of the text.
- **Defaults**: header "🌿 **CATÁLOGO** 🌿" and footer "📩 Consultas y pedidos por privado.".
  - A new business receives them when it opens.
  - A business that existed when the catalog shipped received them once, on upgrade.
  - There is no "restore default".
- **Where**: they are edited only in Configuración → Mensaje del catálogo (navigation.md).
  - **Temporary exception**: until that group exists, they are edited, exactly as before, in the temporary place reached only from the catalog screen (see On screen). It is removed when Configuración ships.

### Catalog text

- **Layout**: header, then one block per qualifying variety sorted by name, then footer. There is one blank line between sections, and a blank header or footer leaves no extra blank line.
- **Who qualifies**: a variety that is unarchived, shown, has a current price today in Argentina time and has stock above zero. Low stock qualifies. An archived variety never qualifies, whatever its flag, price or stock.
- **A variety block**:
  - `<emoji> **<name>**`, or `**<name>**` with no emoji;
  - `• N% indica / M% sativa`, only with a share;
  - `• Aroma/sabor: <aroma>`, only with an aroma;
  - `• Precio x gramo: $X`, the list price;
  - `• Desde N g: $Y c/u`: the bulk minimum and the bulk price. It shows only when the current price has a bulk price and Precio por cantidad is on. Whole grams show without decimals; otherwise a decimal comma is used (`2,5 g`).
- **VIP price**: never in the text, whatever the switches (pricing-settings.md).
- **Money**: `$` directly followed by the amount, with a dot for thousands (`$11.000`). This is the catalog's own format, not the app's `$ 11.000`.
- **Stock in the text**: none. It never mentions grams, stock or low stock.
- **Freshness**: the text is computed on every open from the data and the pricing settings as they stand. Nothing is stored, and the screen does not update itself while open. A save of Precios that changes either switch triggers the pinned catalog's upkeep (pinned-catalog.md).
- **Nothing qualifies**: there is no text, and the screen says nothing is in the catalog today. The pinned catalog sends its own empty message instead (pinned-catalog.md).

### Bold markers

- **Allowed everywhere**: a seller may type `**` in the header, the footer, the aroma and the variety name. No field refuses `*`.
- **Kept as typed**: the text keeps every marker exactly as typed. Nothing is escaped or stripped, including when a name that contains `**` is wrapped in the app's own `**`.
- **Pairing rule**: whatever renders the text reads `**` markers left to right and pairs them in order.
  - The text between each pair is bold, and that pair's markers are hidden.
  - A final unpaired `**` shows as typed.
  - This holds for the preview here and for the Telegram bot (pinned-catalog.md).

### On screen: the catalog screen

- **Route**: `/varieties/catalog`. The old `/catalogo` redirects there permanently (navigation.md).
- **Opened from**: "Send catalog" on Variedades, and Inicio's "Your Telegram catalog is out of date" notice. It is a detail (navigation.md): the bar or sidebar and "‹ Variedades", without "+ New sale".
- **It always opens**, including when nothing qualifies: it then shows the empty state, and the pinned catalog keeps its own empty message and "Up to date" (pinned-catalog.md). "Send catalog" is disabled, with its reason in words (e.g. "Add a variety with a price and its stock"), only while the first-run checklist shows and nothing qualifies (navigation.md).
- **"How it looks in Telegram"**: the text as a customer reads it.
  - Bold follows the pairing rule above.
  - Every other line, break, emoji and price is identical to the copied text.
  - It shows the empty state when nothing qualifies.
- **Compartir**, the main action:
  - it opens the device's native share sheet with exactly the text Copiar copies, `**` markers included;
  - where the browser offers no share sheet, it is not shown, and Copiar remains;
  - success, or closing the share sheet without sending, shows nothing and changes nothing: the share sheet is its own feedback, and there is no toast;
  - a real failure (not the seller cancelling) shows the fixed "Could not share." and leaves Copiar available;
  - neither carries any of the catalog text, a name or an amount.
- **Copiar**, the fallback:
  - It copies the raw text with its `**` markers, the same text the pinned catalog sends.
  - On success it shows the toast "Catalog copied".
  - It works from the phone over the home network's plain http.
  - A failure shows a fixed "Could not copy." and no toast.
- **The pinned catalog's status and Publicar** (pinned-catalog.md): "Up to date" or "Out of date" with its fixed reason, and Publicar. When Publicar is unavailable, it says why in words and links to where the bot settings are: Configuración → Integraciones, or the temporary place until that exists.
- **What does not go out, and why**: every unarchived variety out of today's catalog, by name, each with one reason, the first that applies:
  1. hidden by the seller ("hidden");
  2. no price today ("no price");
  3. Stock's own words: sold out ("sold out") or no entries ("no entries").

  Every reason is told by word, never by color alone (e.g. "Sir Jack, agotada · Mango Bomb, sin precio · X, oculta"). The exact wording is design's. Archived varieties are not listed here.
- **Links**: each variety named in the preview or in what does not go out opens that variety's "In the catalog" section on its page. "Edit header and footer" opens Configuración → Mensaje del catálogo, or the temporary place until that exists.
- **The screen itself edits no header, footer or bot setting**: it only links out (navigation.md).
- **The temporary place** (a deliberate, temporary exception while Configuración → Integraciones and Mensaje del catálogo do not exist):
  - it holds the bot settings (token, channel chat, own chat, Probarlo) and the header and footer, working exactly as before, with no rework;
  - it is reached only from the catalog screen, by "Edit header and footer" and Publicar's "unavailable" link;
  - it is a form: "Close" goes back by history, and with none to the catalog screen; leaving with unsaved changes asks first;
  - it has no tab, Más entry, Configuración group or "coming soon" mark, and shows no pin status and no Publicar;
  - Configuración's own issue retargets both links and removes it. If Configuración already exists, it is not built.
- **Saving attributes** (on the variety's page) or **the header and footer** shows the toast "Catalog saved"; the catalog screen shows the new text the next time it opens. Toasts carry no data.
- **Refusals** show inline and keep what was typed. Each carries a code from `contract.json` (ADR-0008) and never repeats the input (ADR-0005).
- **A variety that is gone** follows accounts.md's "That is gone." rule.

### Constraints

- Every catalog table carries `business_id`, and the business comes from the session.
- Every route joins the isolation sweep, the gated-route test and the ownership migration test.
- No header, footer, aroma or catalog text goes to logs, the console or browser storage.

## Metrics

- **Exact text (criterion 1)**: the reference set covers:
  - emoji or none;
  - share at 0, 50 and 100, or none;
  - aroma or none;
  - bulk or none, with a whole and a fractional bulk minimum;
  - a bulk price with Precio por cantidad on and off;
  - amounts with thousands;
  - a blank header and a blank footer;
  - a seller's own `**` in the header, the aroma and a name, including an unpaired one.

  0 mismatches.
- **No VIP price (criterion 6)**: across the reference set, with entries carrying a VIP price and every combination of switches, the VIP price never appears in the text. 100% passing.
- **Bold pairing**: the preview, with markers removed, equals the copied text. Bold falls between pairs read left to right, and an unpaired final `**` shows as typed. 100% passing.
- **Inclusion (criterion 2)**: a matrix of archived/unarchived × shown/hidden × price/no price today × no entries, sold out, low and ok. Only unarchived + shown + priced + stock above 0 appears. 100% passing.
- **Reasons (criterion 4)**: exactly one reason per unarchived variety that does not go out, in priority order, told by word; archived varieties are not listed. 100% passing.
- **Share = copy (criterion 3)**: with a stubbed share sheet, Compartir hands exactly the API's text; with none available, Compartir is not shown and Copiar works; a cancel shows nothing; a forced failure shows "Could not share." and leaves Copiar; no message holds catalog text.
- **Always opens**: the catalog screen opens with nothing qualifying outside first run, and "Send catalog" is disabled only while the checklist shows and nothing qualifies.
- **Address**: `/varieties/catalog` opens the catalog screen, also on reload; `/catalogo` answers a permanent redirect to it.
- **Temporary place**: while Configuración's groups do not exist, a front test shows the bot settings and the header and footer save from it, both links open it, it shows no pin status and no Publicar, and no tab, Más or Configuración entry points to it.
- **No curl (criterion 3)**: the end-to-end front run edits a variety's attributes on its page and the header and footer (in Configuración, or the temporary place until it exists), opens Variedades → "Send catalog" and taps Copiar. The clipboard equals the API's text.
- **Speed (criterion 3)**: the screen answers in under 300 ms with a few dozen varieties, and opens in at most 2 taps from any tab root.
- **Isolation (criterion 5)**: every catalog route is in the sweep and answers 404 or empty from another business. One business's switches never change another's text.
- **No echo**: no refusal or log line contains the header, footer, aroma or emoji typed; after a full front run, the console and browser storage hold no catalog text.
- **Design**: `scripts/design/compare.sh` runs before and after for the catalog screen, phone and computer, attached to the PR.

## Out of scope

- The Telegram bot (test send, publishing, pinning, token and chats): pinned-catalog.md.
- A custom variety order.
- Restoring the default header or footer.
- Stock figures in the text.
- Escaping or refusing a seller's own `**` markers.
- Live updates between partners while the screen is open.
- Editing catalog attributes or the header and footer from the catalog screen itself: it links to where they are edited.
- A toast after sharing.
- Redesigning the bot settings or the header and footer editing.
- A VIP price in the catalog, or a separate catalog for VIP customers.
- Listing archived varieties on the catalog screen.
