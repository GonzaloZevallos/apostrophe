# Product language

The one language the product writes in: English. It covers every word the product itself writes for a person to read: screens, states, accessible names, API messages meant for a person, the operator scripts' printed lines, the import report's own words and the fixed lines of the Telegram catalog. Every front text lives in one keyed module. It changes no behaviour of any capability: screens, flows, routes, rules and formats stay as their owners define them. It supersedes the Rioplatense Spanish rule formerly stated in BRIEF.md and accounts.md ("Language and formats"). The capability docs and the design files name every screen, group, control and message by that same English, so there is only ever one name for each.

## Jobs

**When** I run my business from the app (on the phone between orders, reading what a refusal or confirmation tells me, or checking the catalog my bot pins for customers), **I want** every word I or my customers read to be in English, **so I can** work in the product's one language and never meet a sentence in another one.

**When** I decide to reword a text or later add a language, **I want** every text a person reads to live in one keyed place, **so** the change is made once and never hunted down screen by screen.

**When** I read a capability doc or open a design file to build, test or review a screen, **I want** every screen, group, control and message named by the exact English the app shows (the glossary's `_In the app_` word or the string in the copy module), **so I can** find it by what I see on screen and never have to translate it or decide which of two names wins.

- The first job's protagonist is the seller, in the same moments as every other capability. The second's is the owner and maintainer (Zeta).
- The third's main readers are the maintainer or agent who builds and tests a screen from its capability doc, including the agent that writes tests (a test that looks for a Spanish name fails against the English app). Second is the reviewer who compares a design file with the built app, mainly through the design capture. Sellers do not read the docs.
- Before it, the whole product spoke Rioplatense Spanish with vos. No seller worked around it; the move is a product decision, so the scope is a faithful English version of each existing text, with no rewording.
- It makes no promise either way about Spanish coming back; it guarantees only that adding a language later is a change in one place.

Success criteria:

1. **No Spanish left.** A person finds no Spanish word and no Spanish route in any of these:
   - every screen and state (empty, loading, error, refusal, confirmation, toast, notice), on phone and computer;
   - every accessible name;
   - every API message meant for a person;
   - every fixed line of the bot's posts;
   - every line the operator scripts print.
2. **Formats unchanged.** `$ 11.000` and `−$ 4.500` in the app; `$11.000` and `2,5 g` in the catalog; `dd/mm`; `3,5 g`. Only the words change.
3. **Same behaviour, same meaning.**
   - Screens, flows, actions, routes, tap budgets and rules are unchanged.
   - Each text is a faithful English version of its original, with the same facts.
   - Security texts (the brake message, the dead-link texts, the gone-record notice) reveal nothing new.
   - No state is told by colour alone, and the icon and text rule's length limits hold.
4. **One place for the words.** Every text the front shows, accessible names included, lives in one keyed module, and no screen holds a text of its own. There is no translation library and no language switch.
5. **The seller's own data is untouched.** Nothing the seller typed or the business stored is rewritten.
6. **Docs and design files name things as the app does.**
   - A review search of the capability docs finds no Spanish name for a screen, group, control or message.
   - No design file shows a Spanish product label.
   - No doc holds a precedence note saying which of two names wins.
   - Every English name a doc uses traces to a glossary term or a copy key.

## Behaviour

### What changes

- **Text the product writes**:
  - front texts and accessible names (for example "Cobrar a <name>" becomes "Collect from <name>", still naming the customer);
  - the API messages meant for a person;
  - the operator scripts' printed lines and the import report's own words;
  - the catalog's fixed lines (line labels, the empty-catalog line);
  - Test it's and Find my chat's reasons.
- **Faithful, not reworded.** No message gains or loses information. English has no vos, so the register is plain second-person English.
- **Document language.** `<html lang="en">`, and the manifest's `lang` is `"en"`. Manifest `id` and `scope` never change (accounts.md).

### What never changes

- **Seller data**: variety, customer and category names, notes, aroma, emoji, and a business's stored catalog header and footer.
  - Existing businesses keep everything stored, the Spanish defaults they received included.
  - Nothing is migrated.
- **Sample and fixture data** (the sample business's names and figures) is seller data and stays as it is.
- **Formats**: every numeric and date format, in the app and in the catalog.
- **Legacy redirects**: every legacy Spanish redirect (ADR-0024, ADR-0033, `app/legacy_front_paths.json`) works exactly as today, with no row added or removed.

### Defaults for a business opened after this change

- **Expense categories**: "Growing supplies", "Packaging", "Shipping and transport", "Other".
- **Catalog header**: "🌿 **CATALOG** 🌿".
- **Catalog footer**: "📩 Questions and orders by private message.".
- The emoji and the `**` markers are kept as before.

### Telegram

- The bot has no commands and recognises no keywords, so nothing needs an alias.
- When nothing qualifies, the pinned catalog reads the header, "Nothing to offer for now." and the footer.
- **Nothing already posted is rewritten as a batch.** A published pin picks up the English fixed lines on its next upkeep trigger, at the latest at the next Argentina day's check. That is the ordinary in-place edit, never a new post (pinned-catalog.md).
- A Spanish stored header or footer may sit beside the English fixed lines until the seller edits it. This is intended.

### Spreadsheet import

- It recognises the Spanish sheet exactly as today: tab names, column titles and cell values such as "Compra", "Efectivo", "Pendiente", "Amigo", "Regalo", "Sí"/"No" and the unfinished-row texts.
- Only the report's own words are English. Sheet texts it quotes stay as the sheet wrote them.
- Categories match by name as today, so a sheet's Spanish categories are created next to a new business's English defaults. Those defaults can be removed while they have no expenses.

### Words and formats together

- Words become English: "Today 03/10", "Yesterday", weekday and month names, "since dd/mm".
- Every numeric and date format stays. Ranges keep their shape ("28/09 – 04/10").
- English words with Argentine formats are intended, not a defect.

### Routes

- Routes the app shows, links to or navigates to are English, `scripts/design/screens.json` included.
- "No Spanish route" never applies to the legacy redirects.

### Vocabulary

- Each glossary term's `_In the app_` line is the English word on screen, starting from the glossary's English term.
- Where that term reads as code, a plain English word is used instead. The choices are listed for Zeta to reword later in one place.
- The `_Avoid_` lines stay as guidance for code and docs.

### Fit, length and security

- **Security texts** say what they said: no attempt count, cause, id, name or date.
- **Length limits** (icon-and-text-rule.md) hold on the English copy.
- **Fit:**
  - English labels fit their 44 px targets;
  - the bar fits at 320 px with text at 130 %;
  - no screen scrolls horizontally at phone widths;
  - the phone check's offender lists may only shrink.

### Docs

- BRIEF.md says "Interface in English".
- CONTEXT.md's `_In the app_` convention names the English word on screen.
- accounts.md's language rule points here.
- The design-system README says English is the app's language. The drawings in `pantallas/` carry the app's English product text; only annotations that describe a drawing may stay Spanish.
- A capability doc's quoted string follows the keyed module, in the same diff as its code.

### How docs and design files name things

- **The name is what the app shows.** A capability doc names each screen, group, control and message by the glossary's `_In the app_` word or the exact string in `web/src/copy/`, character for character.
- **Glossary and copy differ.** The doc uses the copy string of the screen it describes, with no note. Both may be right on different screens ("Owes you", "Account / Owes").
- **No precedence notes.** No doc says which of two names wins; there is only one.
- **Nothing the app does not show.** If a name has no glossary word and no copy key, the app does not show it. A doc describes the thing in plain English with glossary terms and quotes no label. A design-file label of that kind is an annotation, not product text.
- **Product text in design files.** A design-file label is product text when the built app shows it, and it is the app's English. Annotations that describe a drawing, the design README prose and `dominio.ts` may stay Spanish.
- **Registry ids.** Running prose names a screen in English ("the Prices group in Settings"). A registry id (`ConfiguracionPrecios`, `NegocioNuevo`, `Invitacion`…) appears, in code format, only where the sentence points at a design file or a registry row. Ids never change.
- **Spreadsheet names.** The sheet's own names (Ajustes, Catálogo, Ventas, Entradas, Gastos, Revisar…) stay Spanish in `import.md`. Each is marked as the spreadsheet's every time ("the sheet's Ventas tab"), and none is glossed with an app word: Ajustes held prices and is not the app's Settings.
- **Spanish that stays in docs.** Seller data (earlier businesses' Spanish defaults, stored header and footer, fixture names), marked spreadsheet names, drawing annotations, registry ids pointing at a design file, and a Spanish string quoted only as the old text being replaced.

## Metrics

There is no telemetry. These are read from tests and review.

- **No Spanish (criterion 1).**
  - A guard fails on a user-facing literal outside the keyed module and on any known Spanish string.
  - A sweep of API refusals and operator script output finds no Spanish.
  - The bot's fixed lines are asserted in English with the fake adapter.
  - A walk of every registry screen, phone and computer, both themes, finds no Spanish.
  - Target: 0 Spanish texts and 0 Spanish routes.
- **Formats (criterion 2).** The existing format tests pass unchanged.
- **Same behaviour (criterion 3).**
  - Suites pass, with edits limited to texts and lookups by text.
  - No behaviour assertion is dropped or loosened.
  - The tap budgets and the redirect table are unchanged.
  - The security texts are checked in review for what they reveal.
  - The offender lists only shrink.
- **One place (criterion 4).** The guard, plus a test that every text and accessible name resolves by key.
- **Seller data (criterion 5).**
  - An existing business's stored names, notes, header, footer and categories are identical before and after.
  - A new business gets the English defaults.
  - The Spanish-sheet import fixtures load as before.
- **Docs and design files (criterion 6).** A review step, not a Gate check.
  - A review search of `docs/product/*.md` and the design-system docs (apart from the README prose), using the glossary's Avoid words and the known Spanish screen words, leaves only the allowed classes. Target: 0 Spanish names of a screen, group, control or message.
  - A search of `pantallas/*.dc.html` finds 0 Spanish product labels.
  - A search of the docs finds 0 precedence notes.
  - Every English name has a glossary term or copy key in the rename's inventory source column. Names with no source are listed as findings, never invented.
  - The design checks stay green: `assertScreens`, the full strict registry capture, `pytest tests/design` and vitest `src/design`.
- **Pinned catalog.** A published business whose text changes only in its fixed lines gets one in-place edit and no new post.
- **Business measure.** Spanish texts a person can reach: goal 0. Spanish texts found after merge: goal 0. Spanish screen names a reader meets in a capability doc: goal 0.

## Out of scope

- Translations; a language switch; a translation library.
- Rewording beyond a faithful English version.
- Migrating stored defaults, stored headers and footers, or messages already posted.
- Changing what the import recognises in the sheet.
- Adding or removing legacy redirects.
- Changing any format, route, rule or behaviour of a capability.
- A Gate check for Spanish text in docs or design files.
- Renaming registry ids.
