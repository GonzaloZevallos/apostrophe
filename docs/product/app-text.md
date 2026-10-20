# App text

Every word the app itself writes for a person to read, and the one place it lives. That covers the screens, the API's messages, the catalog text and the bot's posts, the page title and manifest, and the operator commands' output. It is in English by default and kept in one keyed module, so a wording or a future language changes in one place. It changes no behaviour, screen, route, flow, refusal code or format.

Two things are never app text:
- seller data: what a seller typed or a stored seeded value now theirs;
- the words the spreadsheet import reads from the sheet.

**Precedence.** This file states the language rule for every capability. Until each capability file's quoted copy is updated, it wins over any quoted Spanish wording elsewhere in `docs/product/`. Those quotations keep their meaning and are rendered faithfully in English (GH-53).

## Jobs

**When** I open any screen, read a message the app or the API shows me, or read the catalog the bot posts, **I want** all of it in plain English, with every text kept in one place, **so I can** use the app without translating anything, and the product's owner can change any wording, or later add a language, in one place without touching the screens.

- **Protagonists.** The people who read the app: the seller on the phone, their partner, and the customers who read the catalog in Telegram. Also Zeta, who owns the wording.
- **It refines** every capability's "run my business from my phone" job. It adds no capability, screen, route or step.
- **Before it**, the app spoke only Spanish, its texts were scattered through the screens, and the design files, docs and tests were tied to exact Spanish wording.
- **Assumption.** Existing sellers accept an English app until the translations decision.

Success criteria:

1. **No Spanish app text where a person reads.** None in any of these:
   - every screen, toast, confirmation, and empty, loading and error state;
   - refusal messages and controls' accessible names;
   - the page title and the manifest;
   - the catalog text, a new business's default header and footer, and the bot's posts;
   - the operator commands' output.

   Seller data and the sheet's words are excluded.
2. **One place.** Every front text lives in one keyed module, and no screen writes its own literal. Changing a word means editing one entry.
3. **Nothing else changes.** Behaviour, flows, tap budgets, isolation, refusal codes and formats stay as they are. No route is in Spanish, and the old Spanish paths still redirect.
4. **The product docs agree.** The design docs, CONTEXT.md, `screens.json`, the tests and the e2e all agree with the English app. No test is loosened.

## Behaviour

### Scope

- **Every word the app itself writes is English:**
  - the front: titles, labels, buttons, tabs, headings, badges, states, confirmations, toasts and accessible names;
  - every API message, `detail` included;
  - the catalog text and the bot's posts;
  - the operator commands' output.
- **A faithful version.** Each text keeps its meaning, screens, flows, actions and confirmations, and still names the facts it named (date, amount, grams, reason).
- **Unchanged:**
  - refusal codes, their kinds and `contract.json`;
  - no refusal repeats the input (ADR-0005);
  - the front never reads `detail` (ADR-0008).
- **Routes** are English. None may be Spanish, and the old Spanish paths keep redirecting permanently (navigation.md).

### Register

- Plain, short, neutral and friendly. No slang, and no warmth or humour beyond what the Spanish had.
- "You" where the Spanish used vos. Buttons are imperative verbs ("Save sale", "Collect").
- **Security texts** (the brake message, the login hint, the dead-link texts, "That's gone") reveal nothing more than before: no attempt count, no reason a link is dead, and no id, name or date.
- **The icon and text rule.** Its closed lists, its 44 px targets and its rule that the accessible name is the control's word all hold. That word is the English one.
- **Length limits** hold on the English copy, counted as before:
  - a help line or notice: 80 characters;
  - an empty-state title: 40 characters.

  A text the limit forces to shorten keeps its facts and moves only the how or why behind More info.

### Terms

- A label that names a concept uses the glossary's English term: Varieties, Customers, Sales, Expenses, Balance, Credit, Payment, Gift, Special price, Promotion, Own use, Stock shortfall, Pending cost, Profit, Cash, and the rest.
- A sentence is translated faithfully and uses those terms inside it ("owes you since dd/mm", "Nobody owes you").
- **CONTEXT.md:**
  - each term's `_In the app_` line holds the English word the seller sees;
  - a term with no word of its own keeps none;
  - where there is no clear English term, the word is proposed there;
  - the `_Avoid_` lists never forbid a word the app shows.

### Words inside formats

- **Words follow the language:**
  - weekday and month names;
  - "Today" ("Today 07/10") and "since";
  - any word inside a figure. A pending mark reads "and N g not yet costed", and a fully pending figure reads "N g not yet costed".
- **Numbers and symbols stay as they are:** the thousands dot, the decimal comma, `$ 11.000`, `−$ 4.500`, `3,5 g`, `dd/mm`, and the catalog's `$11.000` and `2,5 g`.
- Sorting and search stay by name, ignoring case and accents. Monday is the first day of the week.

### Seeded and stored names

- **A new business** is seeded in English:
  - categories "Growing supplies", "Packaging", "Shipping and travel" and "Other";
  - catalog header "🌿 **CATALOG** 🌿";
  - footer "📩 Questions and orders by private message.".
- **Rows already stored** are the seller's data. Nothing rewrites them, and there is no migration.
- **An existing business** may show its stored Spanish categories, header and footer next to the English interface until the translations decision, with no prompt.
- The import still matches categories by name and adds any that are missing (import.md).

### Never translated

- What a seller typed: names of varieties, customers and categories, notes, aromas, and a stored header and footer.
- The words the import reads from the sheet ("Compra", "Pendiente", "Amigo", "Sí"/"No", its column titles and the rest).

### Spreadsheet import

- It accepts exactly the titles, values and fixed cells it reads today, and gains no English titles.
- Its report and refusals are in English.
- An unfinished row is quoted with the sheet's own text as it appears (e.g. `Falta pago`).

### Around the screens

- The page title, the installed app's description, the document's declared language and the manifest's `lang` are English (`en`).
- The installed app's name stays "Apostrophe".
- The manifest's `id` stays `"/"` (accounts.md), and the manifest passes the installability check.
- The app offers no downloads and shares no file, so there are no file names to translate.

### Telegram

- **The catalog text** is English, including every fixed word of a block: the indica/sativa share, the aroma line, the price per gram and the bulk line. With nothing qualifying, it reads "Nothing to offer for now." between the header and the footer. Its formats stay (catalog.md, pinned-catalog.md).
- **On screen**, Probarlo's and Buscar mi chat's reasons and the pin's statuses are English.
- **Posts already sent** are never re-sent or touched, and there is no per-business language.
- **The pinned message** is edited into English in place by the existing upkeep, at the next trigger and at the latest at the next Argentina day change, since the text differs from the last one published. There is no forced resend and no new post.
- A business with a stored Spanish header and footer keeps them, so its catalog may mix languages.

### One place for the texts

- Every front text lives in one keyed module. No screen writes its own visible literal, and there is no translation library and no language switch.
- Changing one entry changes every screen that shows it.
- `LIMITED_COPY`, `LONG_REFUSALS` and `SAMPLES` (icon-and-text-rule.md) keep running on the English copy, with no assertion loosened.

### Guard in the gate

- **It fails when:**
  - a screen writes its own visible text instead of reading the keyed module;
  - Spanish appears in the keyed module, the API messages, or the catalog and bot texts.
- **It never flags:** seller data, the sheet's words, the kept formats or "Apostrophe".
- **It is** fast and gives the same verdict on any date (gate.md). It passes the real tree with no false alarm.
- A real offender is fixed, never exempted.
- How it detects Spanish and where it runs is the Tech Lead's decision.

### Docs, design and tests

- The design-system README says English is the app's language and that `pantallas/` are references for structure, not wording.
- `scripts/design/screens.json` follows the routes, and the copy-keyed design guards follow the English labels.
- The capability docs' quoted copy, CONTEXT.md, the tests and the e2e follow the English app. No test is loosened.

No empty, loading or error state is new. Each existing one keeps its conditions and is shown in English.

## Metrics

No telemetry; read from tests and the gate.

- **No Spanish (criterion 1).**
  - The guard passes over the real tree with 0 Spanish strings in the keyed module, the API messages and the catalog and bot texts.
  - It is shown failing on a deliberately added Spanish message.
  - It is shown passing on seller data, the sheet's words and the kept formats.
- **One place (criterion 2).**
  - 0 screens with a visible literal of their own.
  - A changed entry changes every screen that uses it.
  - Texts defined outside the keyed module: 0 at merge.
- **Nothing else (criterion 3).** Each of these is checked:
  - every `contract.json` code is unchanged;
  - money, grams and date formats are unchanged;
  - every old Spanish path still answers its permanent redirect;
  - no Spanish route in `screens.json` or the front's registry;
  - the manifest's `lang` is `en`, its `id` is `"/"` and installability passes;
  - the page title and the document language are English.
- **Telegram.**
  - The catalog, its empty message included, is built in English.
  - Upkeep edits a published Spanish text once, in place, with no new post.
- **Seeds.**
  - A new business gets the English categories, header and footer.
  - Existing rows are untouched.
  - The import still matches and adds categories by name.
- **Limits.** The copy-limit tests pass on the English copy. The PR lists every shortened text and where its long form went.
- **Docs agree (criterion 4).**
  - The README, CONTEXT.md's `_In the app_` lines, `screens.json`, the capability docs, the tests and the e2e agree.
  - Every edited test is listed in the PR, and none is loosened.

## Out of scope

- Translations, a language switch, a translation library.
- Rewording beyond a faithful English version.
- English column titles or values for the spreadsheet import.
- A per-business language choice.
- Forcing a resend of the pinned message; editing posts already sent.
- A migration that rewrites stored seeded names, headers or footers; prompting a seller to change them.
- File names for downloads (there are none).
- Changing any format, route, refusal code or behaviour.
