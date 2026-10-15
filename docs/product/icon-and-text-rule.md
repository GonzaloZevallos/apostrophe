# Icon and text rule

How every screen labels its entries, actions and notices: which controls are icon-only, which are text only and which are icon + text; how long an always-visible line may be; and what may move behind More info. It decides how things are labelled, never what they do. No action, route, entry order, confirmation, toast wording or tap budget is changed by it, and no rule about what a screen reveals (accounts.md) is weakened by it. The design-system README states the same rule, the same way. Where each screen sits is navigation.md; each screen's own copy stays in its own capability file.

## Jobs

**When** I'm on my phone between orders or mid-chat with a customer and I need to find an entry, an action or what a notice is telling me, **I want** to recognise it at a glance by its icon and a short label, and read any help or notice as one short line, **so I can** get to it without reading blocks of text and get back to the customer.

This refines the navigation job (navigation.md) and the "feels like a phone app" job (accounts.md); it is not a new job and adds no capability. Its protagonist is the seller, in busy, one-handed phone use; setup screens (Configuración, Integraciones, the catalog) follow the same rule and are not designed apart. The computer is the same job on a bigger screen. Before it, the app had 13 icons and screens read as walls of words: finding an entry or an action took reading instead of a glance.

Success criteria:

1. **Found at a glance**: every entry in Más, in Configuración's list of groups and in action rows, and every action, shows an icon next to its text, except the two closed lists below. Navigation and menus always show icon + text; "no tab is an icon alone" stays.
2. **One rule, written once**: this file and the design-system README state the same two closed lists, the same length limits, and what may and may never go behind More info. The next screen follows it without asking.
3. **Short by default, nothing lost**: always-visible help lines, notices and empty states fit the limits, and text that says the same thing twice is cut. A needed longer explanation stays one tap away behind More info and is never deleted silently.
4. **One icon family, no state by icon or colour alone**: every icon is stroke 1.6 at 22 px, named in `NombreIcono`, in both themes. No emoji as an interface icon. The word or shape that carries a state keeps carrying it.
5. **Nothing else changes**: actions, routes, entry order, confirmations, toast wording, tap budgets, every rule about what a screen reveals and every accessible name stay. Existing tests pass unchanged, with two named exceptions, each listed in the PR with its screen and control:
   - copy deliberately shortened: the owning doc and the test change in the same diff;
   - a word that becomes an icon-only control under the closed list (e.g. "Cerrar", "Editar"): a test that found it by its visible text now finds it by role and its unchanged accessible name, and nothing else in that test changes; no assertion is dropped or loosened.

   Any other test edit means the implementation is wrong, not the test.
6. **Looks as designed**: `scripts/design/compare.sh` runs before and after for every screen, phone and computer, both themes, judged by eye.

## Behaviour

### Which form each control takes

The two lists are closed. Adding to either changes this file and the README, never a single screen.

- **Icon-only**: delete ("Borrar…"), search ("Buscar"), close ("Cerrar"), edit ("Editar"), and share ("Compartir") only where it is not the screen's main action (e.g. the Compartir under a fresh invitation link in Usuarios, whose main action is "Invitá a un socio").
  - The accessible name is the exact current word; "Cerrar", never "Volver", still holds through it.
  - The target is at least 44 px.
  - Being on the list allows icon-only; it never requires it. A screen's main action always carries its text (Compartir on the catalog screen keeps its word).
  - **Close is one form everywhere**: every form and sheet closes with the same icon-only control, accessible name "Cerrar". No form shows the word while another shows the icon.
  - Back is not on the list: it is navigation and stays "‹ <parent>" (navigation.md).
  - More info's "i" is the one icon-only control outside this list, defined by its own term below.
- **Text only**:
  - links (`enlace`), such as "Editar encabezado y pie" and "Ver todas";
  - the answer pair inside a confirmation, with its exact current words ("No, dejala / Sí, borrala", "No, seguí cargando / Sí, descartala" and the rest);
  - the submit of a form or sheet ("Guardá la venta", "Guardá el aviso", "Guardá el catálogo", "Registrar", "Guardar y entrar", "Entrá" and the rest);
  - choices among options, which are not actions: the period tabs (Hoy · Semana · Mes · Fechas), Efectivo · Transferencia · Debiendo, Promoción · Consumo propio, an entry's origin, Claro · Oscuro, "Todo: $ X";
  - Deshacer inside "Venta guardada".
- **Icon + text**: everything else, e.g. "+ Nueva venta", "+ Entrada de stock", "Sacar del stock", "Mandar catálogo", Cobrar (accessible name still "Cobrar a <name>"), Publicar, Probarlo, Buscar mi chat, Archivar, Restaurar, "Invitá a un socio", Cambiar contraseña, Cerrar sesión, Copiar and the main Compartir. A new action that fits neither list is icon + text. The icon next to a word is decorative and hidden from assistive technology, so the accessible name stays the word.
- **Tappable notice**: a notice the seller taps to open what it points to, such as Inicio's "Seguí con la configuración". It is neither an action row nor a control of either closed list, and it does not change them.
  - It keeps its card exactly as designed: its surface, rounded corners and own padding, with no row spacing and no row divider.
  - Its sentence carries the meaning, and its accessible name is its visible text.
  - Its chevron is the decorative mark that it opens something; it takes no other icon, and the attention icon only when Notices below lists it.
- No action is removed or renamed while it gains an icon.

### Navigation, menus and rows

- The bar, the sidebar, Más and Configuración's list of groups always show icon + text.
- Entry rows (Más, Configuración's groups) and action rows get a leading icon.
- Record rows keep their layout and state marks: customers, sales, varieties, stock entries, withdrawals, expenses, price entries and the account's rows, with `MarcaEstado`, amber "te debe" and "A favor". Actions on record rows follow the lists above.
- Within one menu (Más, Configuración's groups, the bar, the sidebar), no two entries share an icon.

### Icons

- One family: stroke 1.6, 22 px, no emoji.
- **Every icon is specified by its `NombreIcono` name**: nothing is "an icon" without one.
- `componentes.ts` and `Icono.tsx` name the same set. A name already drawn is reused before a new one is added; no two names draw the same meaning.
- A specific metaphor over a neutral one (e.g. a plug or a bot for Integraciones); never a generic placeholder.
- The same meaning gets the same icon everywhere.
- A name joins `NombreIcono` only when a screen uses it; the existing names stay.
- Each new icon is judged by eye in the design check.

### Length of always-visible text

- A help line or notice: one sentence, at most 80 characters.
- An empty state: a title of at most 40 characters, plus one line of at most 80, plus its action if it has one.
- Inline refusals and the reasons of Probarlo and Buscar mi chat aim for 80, stay on screen and keep what the seller must fix, even past 80. They never move behind More info.
- Consequences the seller would not otherwise expect stay visible in short form: the old pinned message staying as it is, the grams on hand in the archive confirmation, the grams that return to stock on delete.
- A confirmation question may be shortened, but keeps every fact it names today: date, amount, grams, reason.
- Fixed security texts (the brake message, the Entrar hint, the dead-link texts) keep their meaning; shortening never adds information, such as an attempt count or why a link is dead.
- Characters are counted on the Spanish copy as shown, as code points after NFC. A placeholder is measured with `SAMPLES` (`web/src/copy/limits.ts`: date `28/09`, amount `$ 999.999` and `−$ 999.999`, grams `999,99 g`, a 24-character name, count `99`), the worst cases, never with fixture or API data. Each copy module (`messages.ts` or `*Messages.ts`) registers its always-visible strings in `LIMITED_COPY` and the refusals it keeps over 80 in `LONG_REFUSALS`; `web/src/copy/copyLimits.test.ts` fails for a module that has neither, an entry over its limit, or a long refusal not listed.

### More info

- An "i" from the family, in a 44 px target, at the end of the line it explains.
- A tap expands the longer text in place under the line; a second tap collapses it. Never a modal or a sheet.
- It always opens closed, and whether it was opened is never remembered: the browser keeps only the theme choice.
- Accessible name "Más info", with `aria-expanded`.
- Opening it is never an unsaved change and never triggers the leave confirmation.
- It holds only the how or why: never a consequence, a refusal's fix or a state.
- A line whose explanation fits in 80 characters has none.

### Notices

- One attention icon, the same everywhere and decorative, sits next to the sentence of every notice or status that asks the seller to act or says something failed:
  - Inicio's "Tu catálogo en Telegram está desactualizado";
  - "Desactualizado" with its reason;
  - "Arrancá por las variedades";
  - the after-import "Conectá el bot…";
  - "Sin conexión";
  - the generic server-error retry.
- The sentence carries the state; the icon never replaces it or appears without it. Colour and wording do not change.
- No icon on: "Al día"; "Eso ya no está." and its list form; toasts; the first-run checklist (it keeps its boxes and "Hecho"); help lines; empty states.
- A notice the seller taps to open something is a tappable notice (see above): it keeps its designed card, never a row's frame. Inicio's "Seguí con la configuración" is one; it carries its chevron and no attention icon.

### Actions that swap their word by state

- None exists today. Archivar and Restaurar are two actions on two screens, each with its own icon. The low-stock warning's on/off switch is a switch, not a button, and gets no icon.
- For a future one: the word carries the state; a second icon is allowed only where a screen uses it.

### Where it is written

- This file and `docs/product/design-system/README.md`, stated the same way. `componentes.ts` holds the `NombreIcono` names and More info's component type.
- Copy shortened under this rule changes in its owning capability file, in the same diff as its test.

## Metrics

No telemetry; from tests and the design check.

- **Found at a glance (criterion 1)**: a front test over every screen in `scripts/design/screens.json`: every entry row, action row and action outside the closed lists has an icon and its text; every icon-only control has its exact current accessible name and a 44 px target; the icon next to a word is hidden from assistive technology; no menu repeats an icon; every form and sheet closes with the same icon-only "Cerrar". 0 exceptions.
- **One rule (criterion 2)**: this file and the README state the same lists and limits, the tappable notice included; `componentes.ts` and `Icono.tsx` name the same set; every `NombreIcono` name added by this rule is used by a screen. 0 unused new names, 0 mismatches.
- **Short by default (criterion 3)**:
  - help lines and notices ≤ 80 characters, empty-state titles ≤ 40 with one line ≤ 80, asserted over the fixed copy; refusals over 80 are listed for review;
  - More info opens closed, toggles `aria-expanded`, never triggers the leave confirmation and holds no consequence or fix;
  - a PR list shows every shortened or moved text and where its long form went. 0 silent deletions.
- **Icon family and states (criterion 4)**: a guard for stroke 1.6, 22 px and no emoji; front tests show every state keeps its word or shape in both themes; the attention icon is on the six listed notices and on none of the informational ones.
- **Tappable notice**: Inicio's "Seguí con la configuración" is drawn as a tappable card, with no row spacing or row divider, its accessible name its visible text and no attention icon; `compare.sh` shows it unchanged, phone and computer, both themes.
- **Nothing else changes (criterion 5)**: the existing suites pass; the only edited tests are shortened copy and text-to-role-and-name lookups of controls made icon-only, each listed in the PR; tap budgets and the redirect table unchanged; security texts add no information.
- **Looks as designed (criterion 6)**: `compare.sh` before and after for every screen, phone and computer, both themes, judged by eye; at 320 px with text at 130 %, no icon or label is clipped and the bar still fits.

## Out of scope

- An icon-only UI; back as icon-only; a screen's main action as icon-only.
- Adding, removing, renaming or reordering any action or entry; changing a route, a confirmation or toast wording.
- Icons on record rows.
- An optional icon on notices; icons no screen uses.
- Drawing a tappable notice as a list row, or giving it a row's spacing or divider.
- Moving a consequence, a refusal's fix or a state behind More info.
- Remembering whether More info was opened.
- A dashboard or any business metric.
