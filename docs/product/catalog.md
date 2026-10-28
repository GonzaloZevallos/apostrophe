# Catalog

The text that offers today's sellable varieties to a business's customers. It is seen only by its business (ADR-0004). It is built from:
- each variety's catalog attributes;
- its current price today (varieties.md);
- its stock status right now (stock.md);
- the business's pricing settings (pricing-settings.md), for the bulk line;
- the business's shown language, for the fixed lines (stored-language.md);

between the business's own header and footer. The pinned catalog (pinned-catalog.md) sends exactly this text through the business's own Telegram bot and keeps it current. Share and Copy stay for sending it by hand, in a form that pastes into any chat app with its line breaks (see Copy and Share). An archived variety (varieties.md) is never part of it.

Where its pieces live (navigation.md):
- the catalog screen (`/varieties/catalog`) opens from "Send catalog" on Varieties;
- a variety's attributes are edited on its page, in "In the catalog";
- the header and footer are edited in Settings → Catalog message (or, until that group exists, in the temporary place reached from the catalog screen; see below).

## Jobs

**When** a price changes, a variety sells out or I start offering one, **I want to** open the catalog text the app has already built from today's current prices and stock, check it, and share or copy it in one tap, **so I can** send it to my customers myself (by WhatsApp, Telegram or Instagram) without retyping a price or a variety name, and my customers never see a stale price or a variety I can't sell.

Setting the catalog attributes and the header and footer is the setup step of this same job. Keeping the pinned catalog current on its own (test send, publishing, pinning) is BRIEF.md's Telegram job, served by pinned-catalog.md, which reuses this text as it is.

**When** I want to send today's catalog to a customer or a chat by hand, **I want to** copy it with one tap and paste it anywhere so it reads the way it does on screen, **so I can** send it at once without retyping or fixing anything. (Served by Copy's plain and rich versions and by Share sending Copy's plain version.)

**When** I set up how my business prices, record a variety's price or hand over an order, **I want** the app to use only the pricing rules my business has, **so I can** charge every customer exactly what I mean to without seeing fields that don't apply to me. (Defined in pricing-settings.md: served here by the bulk line following Bulk price and the VIP price never reaching customers.)

**When** I run my business from my phone between orders or mid-chat with a customer, several times a day, **I want** the app laid out around what I actually do and how often, **so I can** get back to the customer instead of hunting through menus. (The navigation job, navigation.md: served here by the catalog screen, at most 2 taps from any tab root.)

**When** a customer asks me what I have or how much something costs, or flower comes in, runs out or gets a new price, **I want** to open one variety and find everything about it on its own page, the list to tell me at a glance what I have, what is running out and what I can't sell, and today's catalog one tap from that list, ready to share from my phone, **so I can** answer the customer, record what came in and send an up-to-date catalog without moving between screens, and my customers never get a stale price or a variety I can't sell. (The navigation job applied to varieties, stock and the catalog, varieties.md: served here by the catalog screen and Share.)

**When** a variety I loaded by mistake, or one I no longer work with, keeps showing in my lists and pickers, **I want** to take it out from my phone in a few taps, deleting it if it never moved and archiving it if it has history, **so** my lists show only what I still sell, no past sale, stock, cost or profit figure changes, and I can bring it back exactly as it was if I start selling it again. (Served here by leaving archived varieties out of the text and of what does not go out; defined in varieties.md.)

**When** my business works in a language other than English, **I want** my customers' catalog to speak that language from start to end, including the fixed lines and not just the header and footer I typed, and a business opened in that language to start with its header, footer and expense categories already in it, **so** what customers read is consistent and I have nothing to translate or retype. While my business is in English, nothing I or my customers see changes at all. (Shared with stored-language.md: served here by the fixed lines following the shown language and the header and footer defaults following the stored language at opening.)

Success criteria:

1. **Exact text**: the catalog text follows the spreadsheet's format exactly.
   - The header, then one block per variety, then the footer.
   - Each block has its emoji and bolded name, the indica/sativa share, the aroma, the list price per gram and the bulk line.
   - The `**bold**` markers stay in the text (`catalog.text` and what the pinned catalog sends; Copy and Share put out the plain version, see below).
   - Money is written as `$11.000`.
   - A line is left out when its data is missing (share, aroma, bulk), and the bulk line also while Bulk price is off.
   - It is tested against a reference set with 0 mismatches.
2. **Today, only what can be sold**: a variety appears only when it is unarchived, shown, has a current price on today's Argentina date and has stock above zero right now.
   - Archived, hidden, unpriced, sold-out and never-stocked varieties are out.
   - Low stock is still in.
3. **Fast, from the phone**: from Varieties → "Send catalog", a seller shares or copies today's text in a few seconds without typing anything. Share hands the native share sheet exactly Copy's plain version; without a share sheet, Copy remains. A share sheet that never finishes never leaves the screen stuck: Share and Copy stay usable. This includes the phone on the home network over plain http. There is no API call by hand.
4. **No guessing why**: every unarchived variety that does not go out gives one reason, the first that applies: hidden, no price today, then sold out or no entries. It is told by word, never by color alone.
5. **Businesses never mix** (ADR-0004): attributes, header and footer belong to one business. The text and the list never include another business's data.
6. **Customers never see the VIP price**: the text never carries it, whatever the switches.
7. **One language from start to end**: for a business whose shown language is not English, every fixed line of the text (and the pinned catalog's empty line) is in that language, on the catalog screen, Test it, Publish and upkeep alike. A business in English in the same run stays English.
8. **English unchanged**: for a business in English, the text and the new-business header and footer are byte-identical to the frozen baseline (`en.baseline.json`). Money and grams formats are the same in every language.
9. **Pastes as shown, anywhere**: copied with Copy and pasted into Telegram's message box on iPhone, the catalog keeps every line break and blank line the screen shows (one line per bullet, blocks separated as on screen) and shows no literal `**`. The same copy still reads right in WhatsApp and in a plain-text target, with no regression, and the seller sends the paste without editing it. Telegram, WhatsApp and plain text are all first-class targets; fixing one never justifies breaking another.

## Behaviour

### Catalog attributes, per variety

- **Emoji**: optional, exactly one emoji. Plain text or more than one emoji is refused. With none, the name line has no stand-in emoji.
- **Indica share**: optional whole number from 0 to 100; sativa is the rest. In English it reads "• N% indica / (100−N)% sativa", including the 0 and 100 edges. With none, the line is left out.
- **Aroma/flavor**: optional.
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
- **Defaults**: a new business is opened with a default header and footer in its stored language at opening (stored-language.md), stored as its own data.
  - In English they are header "🌿 **CATALOG** 🌿" and footer "📩 Questions and orders by private message.", byte-identical to the baseline.
  - A stored language is never the test locale, so defaults are never written in `en-XA`, even while the operator's forced language is on.
  - A later language change never rewrites them: from opening they are the seller's own data, never translated.
  - A business that existed when the catalog shipped received the English defaults once, on upgrade; every business that existed before this change keeps exactly what it stored, with no backfill.
  - There is no "restore default".
- **Where**: they are edited only in Settings → Catalog message (navigation.md).
  - **Temporary exception**: until that group exists, they are edited, exactly as before, in the temporary place reached only from the catalog screen (see On screen). It is removed when Settings ships.

### Catalog text

- **Layout**: header, then one block per qualifying variety sorted by name, then footer. There is one blank line between sections, and a blank header or footer leaves no extra blank line.
- **Who qualifies**: a variety that is unarchived, shown, has a current price today in Argentina time and has stock above zero. Low stock qualifies. An archived variety never qualifies, whatever its flag, price or stock.
- **A variety block** (English wording shown):
  - `<emoji> **<name>**`, or `**<name>**` with no emoji;
  - `• N% indica / M% sativa`, only with a share;
  - `• Aroma/flavor: <aroma>`, only with an aroma;
  - `• Price per gram: <money>`, the list price per gram;
  - `• From <grams>: <money> each`, the bulk minimum in grams and the bulk price each. It shows only when the current price has a bulk price and Bulk price is on. Whole grams show without decimals; otherwise a decimal comma is used (`2,5 g`).
- **Fixed lines and language**:
  - The fixed lines are the share line, the aroma/flavor line, the price per gram line, the bulk line, and the pinned catalog's empty line "Nothing to offer for now." (pinned-catalog.md).
  - They come from the copy module in the business's shown language: the operator's forced language when one is set, otherwise the stored language (stored-language.md). The language is worked out when the text is built, on every open of the catalog screen and by every Test it, Publish and upkeep run.
  - When a line shows, and the data it carries, do not depend on the language.
  - The seller's own data is never translated: names, emoji, aroma, header and footer stay as stored.
  - Money and grams formats are the same in every language.
  - In English every fixed line is byte-identical to the baseline `en.baseline.json`.
- **VIP price**: never in the text, whatever the switches (pricing-settings.md).
- **Money**: `$` directly followed by the amount, with a dot for thousands (`$11.000`). This is the catalog's own format, not the app's `$ 11.000`.
- **Stock in the text**: none. It never mentions grams, stock or low stock.
- **Freshness**: the text is computed on every open from the data, the pricing settings and the shown language as they stand. Nothing is stored, and the screen does not update itself while open. A save of Prices that changes either switch, and a change of the stored language, trigger the pinned catalog's upkeep (pinned-catalog.md, stored-language.md).
- **Nothing qualifies**: there is no text, and the screen says nothing is in the catalog today. The pinned catalog sends its own empty message instead (pinned-catalog.md).

### Bold markers

- **Allowed everywhere**: a seller may type `**` in the header, the footer, the aroma and the variety name. No field refuses `*`.
- **Kept as typed in the text**: the catalog text (`catalog.text`, and what the pinned catalog sends) keeps every marker exactly as typed. Nothing is escaped or stripped, including when a name that contains `**` is wrapped in the app's own `**`.
- **Pairing rule**: whatever renders the text reads `**` markers left to right and pairs them in order.
  - The text between each pair is bold, and that pair's markers are hidden.
  - A final unpaired `**` shows as typed.
  - This holds for the preview here, for the Telegram bot (pinned-catalog.md), and for what Copy and Share put out: paired markers are removed from Copy's plain version and become bold in its rich version; an unpaired final `**` stays as typed in both.

### On screen: the catalog screen

- **Route**: `/varieties/catalog`. The old `/catalogo` redirects there permanently (navigation.md).
- **Opened from**: "Send catalog" on Varieties, and Home's "Your Telegram catalog is out of date" notice. It is a detail (navigation.md): the bar or sidebar and "‹ Varieties", without "+ New sale".
- **It always opens**, including when nothing qualifies: it then shows the empty state, and the pinned catalog keeps its own empty message and "Up to date" (pinned-catalog.md). "Send catalog" is disabled, with its reason in words (e.g. "Add a variety with a price and its stock"), only while the first-run checklist shows and nothing qualifies (navigation.md).
- **"How it looks in Telegram"**: the text as a customer reads it. It is unchanged by how Copy works.
  - Bold follows the pairing rule above.
  - Every other line, break, blank line, emoji and price is identical to Copy's plain version.
  - It shows the empty state when nothing qualifies.
- **Share**, the main action:
  - it opens the device's native share sheet with exactly Copy's plain version: no paired `**`, every line break and blank line kept. Share has no rich version of its own;
  - where the browser offers no share sheet, it is not shown, and Copy remains;
  - success, or closing the share sheet without sending, shows nothing and changes nothing: the share sheet is its own feedback, and there is no toast;
  - a real failure (not the seller cancelling) shows the fixed "Could not share." and leaves Copy available;
  - a share sheet waiting to finish never holds the screen: Share and Copy are never disabled or held busy by it, so a sheet that never finishes (it spins, or it was closed without the browser telling the app) never leaves the screen stuck;
  - a share that never finishes counts as closing the sheet without sending: it shows nothing and changes nothing. There is no time limit;
  - tapping Share again while an earlier share has not finished starts a new share with the same text. If the browser refuses it, that is a real failure ("Could not share.", Copy available). Only the latest share's outcome shows; an earlier one that finishes late shows nothing;
  - nothing is ever copied on its own when sharing fails or does not finish: Copy stays on screen for the seller to tap;
  - neither message carries any of the catalog text, a name or an amount.
- **Copy**, the fallback, puts the catalog on the clipboard so it pastes into any chat app as the preview shows it:
  - **Plain version**, always present: the catalog text with every paired `**` removed, every line break and blank line kept. It never carries a paired `**`. Every plain-text target reads it.
  - **Rich version**, a bonus where the browser allows it: the plain version plus bold between paired markers (the app's around names and the seller's own alike), with real line breaks and blank lines. The seller's text is put in as text, never read as markup: a `<`, `>` or `&` pastes as typed. Bold never outranks pasting right in every target: if the rich version cannot be shown to survive Telegram's paste on iPhone with every line break intact, Copy puts only the plain version.
  - An unpaired final `**` stays as typed in both versions.
  - It no longer copies the raw text with its `**` markers: the pinned catalog still sends that text, through Telegram's API, not through a paste.
  - On success it shows the toast "Catalog copied", whichever versions went to the clipboard.
  - It works from the phone over the home network's plain http, with at least the plain version; where the rich version cannot be written, the plain one alone is a success.
  - It works whatever state Share is in, a share that has not finished included.
  - A failure shows a fixed "Could not copy." and no toast. No message carries catalog text, and there is no state telling which version was copied.
- **The pinned catalog's status and Publish** (pinned-catalog.md): "Up to date" or "Out of date" with its fixed reason, and Publish. When Publish is unavailable, it says why in words and links to where the bot settings are: Settings → Integrations, or the temporary place until that exists.
- **What does not go out, and why**: every unarchived variety out of today's catalog, by name, each with one reason, the first that applies:
  1. hidden by the seller ("hidden");
  2. no price today ("no price");
  3. Stock's own words: sold out ("sold out") or no entries ("no entries").

  Every reason is told by word, never by color alone (e.g. "Sir Jack, sold out · Mango Bomb, no price · X, hidden"). The exact wording is design's. Archived varieties are not listed here.
- **Links**: each variety named in the preview or in what does not go out opens that variety's "In the catalog" section on its page. "Edit header and footer" opens Settings → Catalog message, or the temporary place until that exists.
- **The screen itself edits no header, footer or bot setting**: it only links out (navigation.md).
- **The temporary place** (a deliberate, temporary exception while Settings → Integrations and Catalog message do not exist):
  - it holds the bot settings (token, channel chat, own chat, Test it) and the header and footer, working exactly as before, with no rework;
  - it is reached only from the catalog screen, by "Edit header and footer" and Publish's "unavailable" link;
  - it is a form: "Close" goes back by history, and with none to the catalog screen; leaving with unsaved changes asks first;
  - it has no tab, More entry, Settings group or "coming soon" mark, and shows no pin status and no Publish;
  - Settings's own issue retargets both links and removes it. If Settings already exists, it is not built.
- **Saving attributes** (on the variety's page) or **the header and footer** shows the toast "Catalog saved"; the catalog screen shows the new text the next time it opens. Toasts carry no data.
- **Refusals** show inline and keep what was typed. Each carries a code from `contract.json` (ADR-0008) and never repeats the input (ADR-0005).
- **A variety that is gone** follows accounts.md's "That is gone." rule.

### Constraints

- Every catalog table carries `business_id`, and the business comes from the session.
- Every route joins the isolation sweep, the gated-route test and the ownership migration test.
- No header, footer, aroma or catalog text goes to logs, the console or browser storage.
- Copy's plain and rich versions are built on the front from the API's text with the same pairing rule the preview uses; the server's `catalog.text` does not change for them.
- **Language**:
  - The catalog domain imports no translation library. The fixed lines reach it as a plain `CatalogWords` value through `CatalogWordsSource`, a port in the catalog's application layer.
  - The business's language reaches the catalog only through `CatalogLanguage`, implemented in the catalog's own adapter over accounts. That adapter is the only place the forced override is applied.
  - Upkeep reads the language in its own session, after the triggering commit.
  - No route, query or body names a business or a language, and no request input selects `en-XA`.

## Metrics

- **Exact text (criterion 1)**: the reference set covers:
  - emoji or none;
  - share at 0, 50 and 100, or none;
  - aroma or none;
  - bulk or none, with a whole and a fractional bulk minimum;
  - a bulk price with Bulk price on and off;
  - amounts with thousands;
  - a blank header and a blank footer;
  - a seller's own `**` in the header, the aroma and a name, including an unpaired one.

  0 mismatches.
- **No VIP price (criterion 6)**: across the reference set, with entries carrying a VIP price and every combination of switches, the VIP price never appears in the text. 100% passing.
- **Bold pairing**: the preview, with markers removed, equals Copy's plain version. Bold falls between pairs read left to right, and an unpaired final `**` shows as typed. 100% passing.
- **Copy payload shape (criterion 9)**: with a stubbed clipboard, across the reference set:
  - the plain entry (`text/plain`) equals the API's text with paired markers removed, byte for byte, with the same line breaks and blank lines and no paired `**`;
  - when the rich entry is present, it is `text/html`, carries one line break per line of the plain version, bolds only between paired markers, and renders a seller-typed `<b>` or `&` as text;
  - with rich copy unavailable (plain http), only the plain entry is written and the toast still reads "Catalog copied".

  100% passing.
- **Survives Telegram's paste (criterion 9)**: the PR carries a written statement of why the result survives Telegram iOS's paste parsing. It reproduces the collapse (Markdown in pasted plain text: `**…**` to bold, a lone line break to a space), rules out other causes with a text with no `**`, and covers a text with an unpaired `**`. A case that still collapses is a finding brought back, never a new rule.
- **Pastes as shown (criterion 9)**: before merge, the owner taps Copy on the iPhone and pastes into a Telegram chat, a WhatsApp chat and a plain-text note. Every line break and blank line matches the preview, no `**` shows, and nothing needs editing. The result is recorded on the PR.
- **Share = Copy's plain version (criterion 3)**: with a stubbed share sheet, 100% passing:
  - Share hands exactly Copy's plain version, as text only;
  - with none available, Share is not shown and Copy works;
  - a resolve and a cancel show nothing;
  - a forced failure shows "Could not share." and leaves Copy;
  - a share that never settles shows nothing, leaves Share enabled and Copy working, and a second tap calls the share sheet again with the same text;
  - a refused second call shows "Could not share." and leaves Copy;
  - an earlier share settling after a newer tap shows nothing;
  - nothing is written to the clipboard by Share in any outcome;
  - no message holds catalog text.
- **Share on the iPhone (criterion 3)**: before merge, the owner shares from the iPhone over the HTTPS link to a Telegram contact, a WhatsApp contact and a note; where the sheet spins, they close it and confirm Share and Copy both still work. The result is recorded on the PR, and a sheet that hangs only for some payload is a finding brought back, never a change to the payload.
- **Always opens**: the catalog screen opens with nothing qualifying outside first run, and "Send catalog" is disabled only while the checklist shows and nothing qualifies.
- **Address**: `/varieties/catalog` opens the catalog screen, also on reload; `/catalogo` answers a permanent redirect to it.
- **Temporary place**: while Settings's groups do not exist, a front test shows the bot settings and the header and footer save from it, both links open it, it shows no pin status and no Publish, and no tab, More or Settings entry points to it.
- **No curl (criterion 3)**: the end-to-end front run edits a variety's attributes on its page and the header and footer (in Settings, or the temporary place until it exists), opens Varieties → "Send catalog" and taps Copy. The clipboard's plain entry equals the API's text with paired markers removed.
- **Speed (criterion 3)**: the screen answers in under 300 ms with a few dozen varieties, and opens in at most 2 taps from any tab root.
- **Isolation (criterion 5)**: every catalog route is in the sweep and answers 404 or empty from another business. One business's switches or language never change another's text.
- **No echo**: no refusal or log line contains the header, footer, aroma or emoji typed; after a full front run, the console and browser storage hold no catalog text.
- **Design**: `scripts/design/compare.sh` runs before and after for the catalog screen, phone and computer, attached to the PR.
- **English unchanged (criterion 8)**: every moved fixed line and the header and footer defaults render in English exactly as `en.baseline.json`; the reference set plus the empty case shows 0 differences from before the move.
- **Follows the language (criterion 7)**: with a fixture `de` (`selectable_languages=("en","de")`), a business stored as `de` gets `de`'s fixed lines from `GET /catalog`, Test it, Publish and the Ticker's start-of-day run, while a business in `en` in the same run stays byte-identical to the baseline. Domain unit tests build `CatalogWords` by hand. 100% passing.
- **No leftover English**: under the forced `en-XA`, the catalog text, the pinned empty text and the defaults rendered from the defaults source contain, after removing `⟦…⟧` segments, stored data and money/grams tokens, 0 letters; a planted literal fails the check.

## Out of scope

- The Telegram bot (test send, publishing, pinning, token and chats): pinned-catalog.md.
- Removing the `**` markers from the server's `catalog.text` or from what the pinned catalog sends.
- Changing the preview "How it looks in Telegram".
- A rich version for Share.
- New feedback states or wording for Copy or Share, or telling the seller which version was copied.
- A time limit on the share sheet, or copying the catalog on its own when sharing fails or does not finish.
- Adding a title or a link to what Share hands the share sheet, or shortening or rewriting its text for a share target.
- Making a share target (Telegram's or another app's share extension) finish when it hangs on its own side.
- A custom variety order.
- Restoring the default header or footer.
- Rewriting a business's stored header or footer when its language changes, or backfilling defaults for existing businesses.
- Translating the seller's own data.
- Stock figures in the text.
- Escaping or refusing a seller's own `**` markers.
- Live updates between partners while the screen is open.
- Editing catalog attributes or the header and footer from the catalog screen itself: it links to where they are edited.
- A toast after sharing.
- Redesigning the bot settings or the header and footer editing.
- A VIP price in the catalog, or a separate catalog for VIP customers.
- Listing archived varieties on the catalog screen.

## Planned in GH-318

Not built yet. Until the part named ships, the sections above are what the app does.

Each passage names the ADR that decides it, the part that will deliver it, and the current sentence it will replace. The part that delivers a passage removes it from here and edits Behaviour and Out of scope in the same diff.

### The catalog template

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the catalog template part.

- The blocks, the lines and their order between the header and footer will be the business's own, kept per business. A new business starts with name and price, and the header "**CATALOG**".
- It will replace: "**Layout**: header, then one block per qualifying variety sorted by name, then footer." and the fixed lines "`• Price per gram: <money>`" and "`• From <grams>: <money> each`".

### Attributes shown in the catalog

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md; delivered by the categories part.

- The attributes a subcategory defines, for each field whether it shows in the catalog, will take the place of the three fixed ones. Emoji, indica share and aroma become attributes of the migrated business's one subcategory, with today's catalog text unchanged for it. An archived attribute's line leaves the catalog and its values are kept. Whether a product is hidden stays a flag on the product.
- It will replace: "### Catalog attributes, per variety" (**Emoji**, **Indica share**, **Aroma/flavor**) and "**Shown**: yes or no."

### Money format

Decided in docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md; delivered by the money part.

- The catalog's money format will follow the business's currency symbol and money decimals.
- It will replace: "**Money**: `$` directly followed by the amount, with a dot for thousands (`$11.000`). This is the catalog's own format, not the app's `$ 11.000`." and "Money and grams formats are the same in every language."

### The product word and the unit

Decided in docs/adr/0055-configuration-is-stored-per-business-in-hexagons-split-by-reason-to-change-with-frozen-shared-values-read-through-each-reader-s-own-protocol.md and docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md and docs/adr/0061-columns-keep-variety-id-until-75-while-code-and-the-api-say-product.md; delivered by the product word part, the units part and the Product rename on the wire.

- The catalog, the bot and the reports will use the seller's product word, shown as typed and never translated, and each product's unit label in place of "g".
- It will replace: "Whole grams show without decimals; otherwise a decimal comma is used (`2,5 g`)." and, in Out of scope, "A custom variety order."

### The business day

Decided in docs/adr/0057-the-business-time-zone-replaces-argentina-days-today-is-worked-out-per-business-and-upkeep-is-due-when-its-last-check-was-not-on-the-business-s-own-today.md; delivered by the time-zone part.

- It will replace: "has a current price today in Argentina time".
