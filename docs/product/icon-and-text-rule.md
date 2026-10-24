# Icon and text rule

How every screen labels its entries, actions and notices: which controls are icon-only, which are text only and which are icon + text; how long an always-visible line may be; and what may move behind More info. It decides how things are labelled, never what they do. No action, route, entry order, confirmation, toast wording or tap budget is changed by it, and no rule about what a screen reveals (accounts.md) is weakened by it. The design-system README states the same rule, the same way. Where each screen sits is navigation.md; each screen's own copy stays in its own capability file.

## Jobs

**When** I'm on my phone between orders or mid-chat with a customer and I need to find an entry, an action or what a notice is telling me, **I want** to recognise it at a glance by its icon and a short label, and read any help or notice as one short line, **so I can** get to it without reading blocks of text and get back to the customer.

This refines the navigation job (navigation.md) and the "feels like a phone app" job (accounts.md); it is not a new job and adds no capability. Its protagonist is the seller, in busy, one-handed phone use; setup screens (Settings, Integrations, the catalog) follow the same rule and are not designed apart. The computer is the same job on a bigger screen. Before it, the app had 13 icons and screens read as walls of words: finding an entry or an action took reading instead of a glance.

**When** a change adds or edits a link and the gate checks it, **I want** the guard to let through only the links this rule allows to carry a chevron, and to flag every other link that carries an icon, **so I can** trust a green gate and never let an action reach the seller looking like a link.

- Its protagonist is the maintainer, or the reviewer acting for them, as in gate.md's and design-capture.md's maintainer jobs. The seller is affected only indirectly.
- It is served by the closing guard (`findActionLinks`, ADR-0037's "action links" amendment). That guard lets a link carry only a record row's trailing chevron. It never judges whether a link "does" or "opens".
- No rule of this file changes because of it.
- Before it (GH-227, follow-up of GH-165), the guard exempted a chevron anywhere in a link. A link that was not a record row, holding a word and a chevron (e.g. "Siguiente ›"), passed the gate, and only a reviewer reading the diff caught it.

Success criteria:

1. **Found at a glance**: every entry in More, in Settings's list of groups and in action rows, and every action, shows an icon next to its text, except the two closed lists below. Navigation and menus always show icon + text; "no tab is an icon alone" stays.
2. **One rule, written once**: this file and the design-system README state the same two closed lists, the same length limits, and what may and may never go behind More info. The next screen follows it without asking.
3. **Short by default, nothing lost**: always-visible help lines, notices and empty states fit the limits, and text that says the same thing twice is cut. A needed longer explanation stays one tap away behind More info and is never deleted silently.
4. **One icon family, no state by icon or colour alone**: every icon is stroke 1.6 at 22 px, named in `NombreIcono`, in both themes. No emoji as an interface icon. The word or shape that carries a state keeps carrying it.
5. **Nothing else changes**: actions, routes, entry order, confirmations, toast wording, tap budgets, every rule about what a screen reveals and every accessible name stay. Existing tests pass unchanged, with two named exceptions, each listed in the PR with its screen and control:
   - copy deliberately shortened: the owning doc and the test change in the same diff;
   - a word that becomes an icon-only control under the closed list (e.g. "Close", "Edit"): a test that found it by its visible text now finds it by role and its unchanged accessible name, and nothing else in that test changes; no assertion is dropped or loosened.

   Any other test edit means the implementation is wrong, not the test.
6. **Looks as designed**: `scripts/design/compare.sh` runs before and after for every screen, phone and computer, both themes, judged by eye.
7. **The gate lets a link carry only a record row's trailing chevron.**
   - A link that is not a record row and holds a word and a chevron (e.g. "Siguiente ›") is flagged. So is a link whose chevron is anywhere other than a record row's trailing mark.
   - The real tree stays green with no false alarms. Record rows with their trailing chevron, `shell/` navigation with `aria-current`, `mas__item` and `ajustes__item` stay unflagged.
   - `ACTION_LINKS_LEFT` stays exactly Expenses' "Add expense", and `ENTRY_CLASSES` does not grow.
   - A real offender found on the tree is fixed, never exempted.
   - Nothing the seller sees changes.

## Behaviour

### Which form each control takes

The two lists are closed. Adding to either changes this file and the README, never a single screen.

- **Icon-only**: delete ("Delete…"), search ("Search"), close ("Close"), edit ("Edit"), and share ("Share") only where it is not the screen's main action (e.g. the Share under a fresh invitation link in Users, whose main action is "Invite a partner").
  - The accessible name is the exact current word; "Close", never "Back", still holds through it.
  - The target is at least 44 px.
  - Being on the list allows icon-only; it never requires it. A screen's main action always carries its text (Share on the catalog screen keeps its word).
  - **Close is one form everywhere**: every form and sheet closes with the same icon-only control, accessible name "Close". No form shows the word while another shows the icon.
  - Back is not on the list: it is navigation and stays "‹ <parent>" (navigation.md).
    - The parent is the fixed one navigation.md names for that screen (its "‹ <parent>" and its back-with-no-history table), whatever screen it was reached from. Back still follows history.
    - A screen shows exactly one back, the one its chrome gives it (the shell's); a screen never draws a second one of its own.
    - Back is never "‹" alone and never a generic word such as "Back": its visible text and its accessible name both name the parent.
  - More info's "i" is the one icon-only control outside this list, defined by its own term below.
- **Text only**:
  - links (`enlace`), such as "Edit header and footer" and "See all";
  - the answer pair inside a confirmation, with its exact current words ("No, keep it / Yes, delete it", "No, keep entering / Yes, discard it" and the rest);
  - the submit of a form or sheet ("Save sale", "Save the warning", "Save the catalog", "Record payment", "Save and sign in", "Sign in" and the rest);
  - choices among options, which are not actions: the period tabs (Today · Week · Month · Dates), Cash · Transfer · Owing, Promotion · Own use, an entry's origin, Light · Dark, "All: $ X";
  - Undo inside "Sale saved".
- **Icon + text**: everything else, e.g. "+ New sale", "+ Stock entry", "Take from stock", "Send catalog", Collect (accessible name still "Collect from <name>"), Publish, Test it, Find my chat, Archive, Restore, "Invite a partner", "Change password", "Sign out", Copy and the main Share. A new action that fits neither list is icon + text. The icon next to a word is decorative and hidden from assistive technology, so the accessible name stays the word.
  - **The "+" in the docs is the icon**: in "+ New sale", "+ Add expense", "+ Stock entry", "+ Entry" and any other label written with a leading "+", the "+" stands for the `agregar` icon. On screen the icon draws it and the visible text is the word alone, never a literal "+" beside the icon. The accessible name is unchanged.
- **An action never looks like a link**: only a link (`enlace`) is drawn as one (underlined, in the link style). An action, in any form, including one that opens another screen such as "New sale" or "New sale to <name>", is drawn as the action it is.
- **Tappable notice**: a notice the seller taps to open what it points to, such as Home's "Go on to the setup". It is neither an action row nor a control of either closed list, and it does not change them.
  - It keeps its card exactly as designed: its surface, rounded corners and own padding, with no row spacing and no row divider.
  - Its sentence carries the meaning, and its accessible name is its visible text.
  - Its chevron is the decorative mark that it opens something; it takes no other icon, and the attention icon only when Notices below lists it.
- No action is removed or renamed while it gains an icon.

### Navigation, menus and rows

- The bar, the sidebar, More and Settings's list of groups always show icon + text.
- Entry rows (More, Settings's groups) and action rows get a leading icon.
- Record rows keep their layout and state marks: customers, sales, varieties, stock entries, withdrawals, expenses, price entries and the account's rows, with `MarcaEstado`, amber "owes you" and "Credit". Actions on record rows follow the lists above.
- Within one menu (More, Settings's groups, the bar, the sidebar), no two entries share an icon.

### Icons

- One family: stroke 1.6, 22 px, no emoji.
- **Every icon is specified by its `NombreIcono` name**: nothing is "an icon" without one.
- `componentes.ts` and `Icono.tsx` name the same set. A name already drawn is reused before a new one is added; no two names draw the same meaning.
- A specific metaphor over a neutral one (e.g. a plug or a bot for Integrations); never a generic placeholder.
- The same meaning gets the same icon everywhere.
- A name joins `NombreIcono` only when a screen uses it; the existing names stay.
- Each new icon is judged by eye in the design check.

### Length of always-visible text

- A help line or notice: one sentence, at most 80 characters.
- An empty state: a title of at most 40 characters, plus one line of at most 80, plus its action if it has one.
- Inline refusals and the reasons of Test it and Find my chat aim for 80, stay on screen and keep what the seller must fix, even past 80. They never move behind More info.
- Consequences the seller would not otherwise expect stay visible in short form: the old pinned message staying as it is, the grams on hand in the archive confirmation, the grams that return to stock on delete.
- A confirmation question may be shortened, but keeps every fact it names today: date, amount, grams, reason.
- Fixed security texts (the brake message, the sign-in hint, the dead-link texts) keep their meaning; shortening never adds information, such as an attempt count or why a link is dead.
- Characters are counted on the copy as shown, as code points after NFC. A placeholder is measured with `SAMPLES` (`web/src/copy/limits.ts`: date `28/09`, amount `$ 999.999` and `−$ 999.999`, grams `999,99 g`, a 24-character name, count `99`), the worst cases, never with fixture or API data. Each copy file (`web/src/copy/`) registers its always-visible strings in `LIMITED_COPY` and the refusals it keeps over 80 in `LONG_REFUSALS`; `web/src/copy/copyLimits.test.ts` fails for a module that has neither, an entry over its limit, or a long refusal not listed.

### More info

- An "i" from the family, in a 44 px target, at the end of the line it explains.
- A tap expands the longer text in place under the line; a second tap collapses it. Never a modal or a sheet.
- It always opens closed, and whether it was opened is never remembered: the browser keeps only the theme choice.
- Accessible name "More info", with `aria-expanded`.
- Opening it is never an unsaved change and never triggers the leave confirmation.
- It holds only the how or why: never a consequence, a refusal's fix or a state.
- A line whose explanation fits in 80 characters has none.

### Notices

- One attention icon, the same everywhere and decorative, sits next to the sentence of every notice or status that asks the seller to act or says something failed:
  - Home's "Your Telegram catalog is out of date";
  - "Out of date" with its reason;
  - "Start with your varieties";
  - the after-import "Connect the bot…";
  - "No connection";
  - the generic server-error retry.
- The sentence carries the state; the icon never replaces it or appears without it. Colour and wording do not change.
- No icon on: "Up to date"; "That is gone." and its list form; toasts; the first-run checklist (it keeps its boxes and "Done"); help lines; empty states.
- A notice the seller taps to open something is a tappable notice (see above): it keeps its designed card, never a row's frame. Home's "Go on to the setup" is one; it carries its chevron and no attention icon.

### Actions that swap their word by state

- None exists today. Archive and Restore are two actions on two screens, each with its own icon. The low-stock warning's on/off switch is a switch, not a button, and gets no icon.
- For a future one: the word carries the state; a second icon is allowed only where a screen uses it.

### Where it is written

- This file and `docs/product/design-system/README.md`, stated the same way. `componentes.ts` holds the `NombreIcono` names and More info's component type.
- Copy shortened under this rule changes in its owning capability file, in the same diff as its test.

## Metrics

No telemetry; from tests and the design check.

- **Found at a glance (criterion 1)**: a front test over every screen in `scripts/design/screens.json`: every entry row, action row and action outside the closed lists has an icon and its text; every icon-only control has its exact current accessible name and a 44 px target; the icon next to a word is hidden from assistive technology; no menu repeats an icon; every form and sheet closes with the same icon-only "Close". 0 exceptions.
- **Icon and word not doubled**: no visible label carries a literal "+" beside an `agregar` icon, and every such control keeps its accessible name. 0 exceptions.
- **One back per screen**: every card and detail in `scripts/design/screens.json` shows exactly one back control, reading "‹ <parent>" with the fixed parent navigation.md names, its accessible name naming that parent; none reads "‹" alone or "Back". 0 exceptions.
- **Actions are not links**: no action is drawn in the link style; checked by eye in the design check.
- **One rule (criterion 2)**: this file and the README state the same lists and limits, the tappable notice included; `componentes.ts` and `Icono.tsx` name the same set; every `NombreIcono` name added by this rule is used by a screen. 0 unused new names, 0 mismatches.
- **Short by default (criterion 3)**:
  - help lines and notices ≤ 80 characters, empty-state titles ≤ 40 with one line ≤ 80, asserted over the fixed copy; refusals over 80 are listed for review;
  - More info opens closed, toggles `aria-expanded`, never triggers the leave confirmation and holds no consequence or fix;
  - a PR list shows every shortened or moved text and where its long form went. 0 silent deletions.
- **Icon family and states (criterion 4)**: a guard for stroke 1.6, 22 px and no emoji; front tests show every state keeps its word or shape in both themes; the attention icon is on the six listed notices and on none of the informational ones.
- **Tappable notice**: Home's "Go on to the setup" is drawn as a tappable card, with no row spacing or row divider, its accessible name its visible text and no attention icon; `compare.sh` shows it unchanged, phone and computer, both themes.
- **Nothing else changes (criterion 5)**: the existing suites pass; the only edited tests are shortened copy and text-to-role-and-name lookups of controls made icon-only, each listed in the PR; tap budgets and the redirect table unchanged; security texts add no information.
- **Looks as designed (criterion 6)**: `compare.sh` before and after for every screen, phone and computer, both themes, judged by eye; at 320 px with text at 130 %, no icon or label is clipped and the bar still fits.
- **Only a record row's trailing chevron (criterion 7)**, from the closing guard's own tests and the gate:
  - gap closed: a link that is not a record row and holds a word and a chevron ("Siguiente ›") fails the guard, and so does a link whose chevron is not a record row's trailing mark;
  - no false alarms: the guard passes over the real tree, and tests keep record rows with their trailing chevron, `shell/` navigation with `aria-current`, `mas__item` and `ajustes__item` unflagged;
  - `ACTION_LINKS_LEFT` is exactly Expenses' "Add expense", and `ENTRY_CLASSES` is the same two entries;
  - the change touches no screen, copy or route; the only edited tests are the guard's own, and they keep every case they guarded;
  - every real offender found is listed in the PR and shown fixed. Expected: 0.

## Out of scope

- An icon-only UI; back as icon-only; a screen's main action as icon-only.
- Adding, removing, renaming or reordering any action or entry; changing a route, a confirmation or toast wording.
- Icons on record rows.
- An optional icon on notices; icons no screen uses.
- Drawing a tappable notice as a list row, or giving it a row's spacing or divider.
- Moving a consequence, a refusal's fix or a state behind More info.
- Remembering whether More info was opened.
- A back label that depends on how a screen was reached (navigation.md).
- A dashboard or any business metric.
- Closing the closing guard's other known gaps: an icon drawn by a helper component, a link re-exported under another name, an action link with no icon.
- Judging a link's intent ("does" versus "opens") in the guard.
