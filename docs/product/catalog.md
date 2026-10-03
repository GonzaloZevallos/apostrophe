# Catalog

The text that offers today's sellable varieties to a business's customers. It is built from each variety's catalog attributes, its current price today (varieties.md) and its stock status right now (stock.md), between the business's own header and footer. It is seen only by its business (ADR-0004). The Telegram bot (#10) will send exactly this text; until then, the seller copies it by hand.

## Jobs

**When** a price changes, a variety sells out or I start offering one, **I want to** open the catalog text the app has already built from today's current prices and stock, check it, and copy it in one tap, **so I can** paste it into my Telegram chat myself without retyping a price or a variety name, and my customers never see a stale price or a variety I can't sell.

Setting the catalog attributes and the header and footer is the setup step of this same job. Keeping the pinned catalog current on its own (test send, publishing, pinning) is BRIEF.md's Telegram job, served by #10, which reuses this text as it is.

Success criteria:

1. **Exact text**: the copied text follows the spreadsheet's format exactly.
   - The header, then one block per variety, then the footer.
   - Each block has its emoji and bolded name, the indica/sativa share, the aroma, the list price per gram and the bulk line.
   - The `**bold**` markers stay in the text.
   - Money is written as `$11.000`.
   - A line is left out when its data is missing (share, aroma, bulk).
   - It is tested against a reference set with 0 mismatches.
2. **Today, only what can be sold**: a variety appears only when it is shown, has a current price on today's Argentina date and has stock above zero right now.
   - Hidden, unpriced, sold-out and never-stocked varieties are out.
   - Low stock is still in.
3. **Fast, from the phone**: from Más → Catálogo, a seller copies today's text in a few seconds without typing anything. This includes the phone on the home network over plain http. There is no API call by hand.
4. **No guessing why**: every variety shows as in or out. Each out variety gives one reason, the first that applies: hidden, no price today, then "Agotada" or "Sin entradas". It is told by word, never by color alone.
5. **Businesses never mix** (ADR-0004): attributes, header and footer belong to one business. The text and the list never include another business's data.

## Behaviour

### Catalog attributes, per variety

- **Emoji**: optional, exactly one emoji. Plain text or more than one emoji is refused. With none, the name line has no stand-in emoji.
- **Indica share**: optional whole number from 0 to 100; sativa is the rest. It reads "• N% índica / (100−N)% sativa", including the 0 and 100 edges. With none, the line is left out.
- **Aroma**: optional.
  - It is trimmed, and every run of whitespace, line breaks included, collapses to one space.
  - It holds up to 200 characters.
  - Empty means none, and the line is left out.
  - `*` is allowed (see Bold markers).
- **Shown**: yes or no.
  - Yes by default for a new variety.
  - Yes for every variety that existed when the catalog shipped.
- **Who can be edited**: every variety, including ones out for lack of price or stock.
- **No side effects**: the attributes never touch prices, stock or sales.
- **Where**: they are edited only on Catálogo, never on Variedad detail.

### Header and footer, per business

- **Shape**: free multi-line text, up to 500 characters each. Inner line breaks are kept; leading and trailing blank lines are trimmed.
- **Blank**: allowed. A blank header or footer is left out of the text.
- **Defaults**: header "🌿 **CATÁLOGO** 🌿" and footer "📩 Consultas y pedidos por privado.".
  - A new business receives them when it opens.
  - A business that existed when the catalog shipped received them once, on upgrade.
  - There is no "restore default".

### Catalog text

- **Layout**: header, then one block per qualifying variety sorted by name, then footer. There is one blank line between sections, and a blank header or footer leaves no extra blank line.
- **Who qualifies**: a variety that is shown, has a current price today in Argentina time and has stock above zero. Low stock qualifies.
- **A variety block**:
  - `<emoji> **<name>**`, or `**<name>**` with no emoji;
  - `• N% índica / M% sativa`, only with a share;
  - `• Aroma/sabor: <aroma>`, only with an aroma;
  - `• Precio x gramo: $X`, the list price;
  - `• Desde N g: $Y c/u`, only with a bulk price: the bulk minimum and the bulk price. Whole grams show without decimals; otherwise a decimal comma is used (`2,5 g`).
- **Money**: `$` directly followed by the amount, with a dot for thousands (`$11.000`). This is the catalog's own format, not the app's `$ 11.000`.
- **Stock in the text**: none. It never mentions grams, stock or low stock.
- **Freshness**: the text is computed on every open from the data as it stands. Nothing is stored, and the screen does not update itself while open.
- **Nothing qualifies**: there is no text, and the screen says nothing is in the catalog today.

### Bold markers

- **Allowed everywhere**: a seller may type `**` in the header, the footer, the aroma and the variety name. No field refuses `*`.
- **Kept as typed**: the text keeps every marker exactly as typed. Nothing is escaped or stripped, including when a name that contains `**` is wrapped in the app's own `**`.
- **Pairing rule**: whatever renders the text reads `**` markers left to right and pairs them in order.
  - The text between each pair is bold, and that pair's markers are hidden.
  - A final unpaired `**` shows as typed.
  - This holds for the preview here and for the Telegram bot (#10).

### On screen (Catálogo)

- **Más entry**: "Catálogo · El mensaje de hoy, listo para copiar".
- **"Cómo se ve en Telegram"**: the text as a customer reads it.
  - Bold follows the pairing rule above.
  - Every other line, break, emoji and price is identical to the copied text.
  - It shows the empty state when nothing qualifies.
- **Copiar**:
  - It copies the raw text with its `**` markers, the same text #10 will send.
  - On success it shows the toast "Catálogo copiado".
  - It works from the phone over the home network's plain http.
  - A failure shows a fixed "No se pudo copiar." and no toast.
- **"Qué sale en el catálogo"**:
  - every variety by name, with its emoji, share and aroma;
  - its state: in ("Sale"), or out with one reason, the first that applies:
    1. "Oculta": hidden by the seller, and only that;
    2. no price today ("No sale: sin precio hoy");
    3. Stock's own words: "No sale: está agotada" or "No sale: sin entradas";
  - every state is told by word, never by color alone.
- **Editing**: a variety's attributes from its row, and the header and footer, on the same screen.
  - Saving shows the new text and reasons at once, with the toast "Catálogo guardado".
  - Toasts carry no data.
- **Refusals** show inline and keep what was typed. Each carries a code from `contract.json` (ADR-0008) and never repeats the input (ADR-0005).
- **A variety that is gone** follows accounts.md's "Eso ya no está." rule.

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
  - amounts with thousands;
  - a blank header and a blank footer;
  - a seller's own `**` in the header, the aroma and a name, including an unpaired one.

  0 mismatches.
- **Bold pairing**: the preview, with markers removed, equals the copied text. Bold falls between pairs read left to right, and an unpaired final `**` shows as typed. 100% passing.
- **Inclusion (criterion 2)**: a matrix of shown/hidden × price/no price today × no entries, sold out, low and ok. Only shown + priced + stock above 0 appears. 100% passing.
- **Reasons (criterion 4)**: exactly one reason per out variety, in priority order, told by word. 100% passing.
- **No curl (criterion 3)**: the end-to-end front run opens Más → Catálogo, edits attributes, header and footer, then taps Copiar. The clipboard equals the API's text.
- **Speed (criterion 3)**: the screen answers in under 300 ms with a few dozen varieties.
- **Isolation (criterion 5)**: every catalog route is in the sweep and answers 404 or empty from another business.
- **No echo**: no refusal or log line contains the header, footer, aroma or emoji typed.

## Out of scope

- The Telegram bot: test send, publishing, pinning, token and chats (#10).
- A custom variety order.
- Restoring the default header or footer.
- Stock figures in the text.
- Escaping or refusing a seller's own `**` markers.
- Live updates between partners while the screen is open.
- Editing catalog attributes from Variedad detail.
