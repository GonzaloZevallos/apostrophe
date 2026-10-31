# Design standards

The criteria the design roles apply to every screen, and the design rules they work to. This file holds the owner's four criteria and the rules that stay, in full; the Icon and text rule and Design capture are given in full in `docs/product/icon-and-text-rule.md` and `docs/product/design-capture.md`, and their sections below are the entry point. `docs/product/` and the ADRs win over a drawing: where a drawing and a written definition differ, the written definition governs.

## The owner's four criteria

The owner's four product and design criteria. Each one's full text lives where it is listed.

1. Drawing as guide: `DESIGN_STANDARDS.md`, "Drawing as guide".
2. Phone first: `DESIGN_STANDARDS.md`, "Phone first".
3. The primary user, with the priority line: `BRIEF.md`, "Problem and who has it".
4. Assume nothing: `DESIGN_STANDARDS.md`, "Assume nothing", with its test also in `BRIEF.md`.

## Drawing as guide

The drawing is a guide, not an exact spec. A difference from the drawing is fixed only when it changes what the person understands or does. A pixel or layout difference that changes neither is not a finding and opens no issue.

- A difference from the drawing is a finding only if the owner, on the phone, would read or do something differently. That covers:
  - a change of meaning (wording, label or icon);
  - a control, step or field that is missing, extra or reordered;
  - a figure or state that is hidden or shown differently;
  - a tap target too small.
- Colour, contrast and size count only when they carry meaning or legibility. A status told by colour alone breaks the Stock status rule, and text the owner can no longer read on the phone also counts. Otherwise, colour shade and font weight do not count.
- A difference that breaks a written rule (the icon and text rule, the attention icon, the mobile standard) is a finding against that rule, not against the drawing.
- `docs/product/` and the ADRs win over a drawing. A difference from the drawing alone is never a finding. A difference from the written definition always is.
- A product decision held only in a drawing (fixed copy, the order of a flow) binds only once it is written into `docs/product/`. Until then it is a guide like the rest of the drawing.
- Tie-breaker: "would the owner, on the phone, read or do something differently?" If not, it is not a finding.

## Phone first

Working on the phone comes before polish. When a choice is needed, the flow working on the phone ships first; visual polish is a later, separate task.

- "Working on the phone" means three things:
  - the flow can be completed on a phone-sized screen;
  - touch targets meet the mobile standard;
  - the gate is green, Mobile check included.
- Polish is never opened from a finding. It becomes a separate task only when the owner or PM chooses to schedule it.
- A polish gap never blocks a task and never reopens a phone flow that has shipped.

## Assume nothing

The owner's fourth criterion: the app never hard-codes one business's way of working. Each business runs it its own way, through settings with neutral defaults.

- The owner's examples are product type, units, currency, payment methods, pricing rules, channels, and so on. The list is open, so "it isn't on the list" is never a defence.
- A label, unit, field, option list or default drawn as fixed, as the only choice for every business, is a finding. A default that fits only one business is the same finding as a fixed word on screen.
- There are no ready-made business-type presets.
- Sample data and a seller's own data are not findings, for example a variety called "Blue Dream", 3.5 g in a drawing, or a seller's header text.
- Criterion 4 applies to new scoping, design and review. It does not reclassify what exists. Choices already written down are existing assumptions, not findings against new work that follows them: the brief's constraints, the formats and inputs in `CODING_STANDARDS.md` §10, the ADRs and `docs/product/`. #330 sweeps them and #318 makes them customizable.
- New work extends an existing choice when it reuses, unchanged, a word, unit or option list that `CONTEXT.md`, `BRIEF.md` or the code already fixes for every business (for example a new field in grams or whole pesos, or another "cash or transfer" choice). That finding is recorded as a review comment linking #330 (and #318 when the customizable model is what is missing), and the change merges; it does not wait for the sweep.
- Anything the new work adds to or changes in such a choice (a further fixed option, a new unit next to grams), or that appears in none of `CONTEXT.md`, `BRIEF.md` or the code, is the new work's own assumption. Its finding blocks the merge like any finding: before merge, the choice becomes a setting with a neutral default, or the PM rules it borderline and decides with criterion 4's test.
- When the reviewer cannot tell which case applies, they ask the PM before merge, and the PM decides.
- It works alongside "Drawing as guide" and does not reopen it.
- Test: Would this still be right for a business that sells something else, in other units, other ways? If not, it is a finding.

## Icon and text rule

How every screen labels its entries, actions and notices: which controls are icon-only, which are text only and which are icon + text; how long an always-visible line may be; and what may move behind More info. It decides how things are labelled, never what they do.

The full rule, including the attention icon and the tappable notice, is `docs/product/icon-and-text-rule.md`.

## Design capture

The evidence a reviewer uses to judge that a screen looks as designed: the design file and the built app are captured side by side from the screens registry (`scripts/design/screens.json`), with pinned fonts, by `scripts/design/comparisons.mjs`, and when a change needs a before/after pair, the raw captures are compared by exact AE with `scripts/design/ae.mjs` (ADR-0042). It is review evidence attached to a PR and judged by eye; it is never a step of the gate (docs/product/gate.md).

The full text is `docs/product/design-capture.md`.

## Palette

The app's colors are the owner's Yerba palette, in a light and a dark theme. The values live in `docs/product/design-system/tokens.css` and `tokens.ts` (and the app's copy, `web/src/styles/tokens.css`); no other file carries a literal color. The contrast table that proves every text pair is in `docs/product/design-system/README.md`.

- **Light:** background `#f6f7f5`, surface `#ffffff`, ink `#15201a`, muted `#56645c`, border `#dce3de`, primary `#1e6b47` and its soft tint `#e2f1e8`, debt `#a35706`, button `#1e6b47` with white text.
- **Dark:** background `#0e1411`, surface `#18211c`, ink `#e7eee9`, muted `#9aaaa1`, border `#2a362f`, primary `#5cc594` and its soft tint `#1f3a2c`, debt `#e8a54b`, button `#5cc594` with dark text (never white).
- **Also in both:** gain `--positivo` (`#1e7a45` light, `#6bd39a` dark), loss `--negativo` (`#c0352b`, `#f07a6e`), primary-dark `--acento-oscuro` (`#14532f`), warm accent `--acento-calido` (`#e3a23b`, text on it is ink only, `--acento-calido-texto`).
- **Derived** (the owner gave no value; each is a tint or shade of the owner's hues): `--tenue`, `--deuda-fondo`, `--deuda2`, `--deuda-linea`, `--critico`, `--critico-texto`.
- **Deviation:** light debt moved from the owner's `#a85a06` to `#a35706` because it read 4.35:1 on the soft tint; the ratio and the move are in the README.
- **Chart series:** `--serie1` to `--serie5`. Light: `#1e6b47`, `#e3a23b`, `#4c7fd0`, `#b8457a`, `#b9c2bc`. Dark, brighter variants of the same hues: `#5cc594`, `#f0b95a`, `#7fa8e8`, `#e07aa8`, `#7f8c85`. A series is a mark, always labelled directly, touching it.
- Every text pair is at least 4.5:1 in both themes; decorative borders are exempt.
- **Color never alone:** no state told by color alone: a sign, arrow or word on every gain, loss, debt or state; chart series labelled directly. The color census (`web/src/architecture/colorCensus.ts`) lists every rule that uses a debt, state, gain, loss or series token.

## Logo

The Yerba mark is a white apostrophe on a green (`#1e6b47`) rounded square. It is the same in both themes and in every Business, Language and screen.

- **One source.** `web/public/icons/mark.svg` is the only source of the mark. Nothing under `web/src` copies its markup or path data: the app draws it with an `<img>` of that file.
- **Everything derives from it.** The favicon is that SVG, with `icon-192.png` as the fallback. The PNG icons (`icon-192.png`, `icon-512.png`, the maskable `icon-maskable-512.png` and `apple-touch-icon.png`) are rendered from it by `scripts/design/icons.mjs` (`npm --prefix web run icons`), offline, without editing the SVG. The renderer writes `web/public/icons/icons.json` with the SVG's SHA-256 and each icon's size, never a PNG hash.
- **Maskable and apple-touch** are full-bleed and opaque, with the apostrophe inside the 80 % safe zone. The 192 and 512 icons are the rounded square on transparency.
- **The check** is `web/src/design/icons.test.ts`: it decodes the PNGs, and fails when the SVG changes without the PNGs being rendered again.
- **The installed app does not change:** the manifest's `id`, `name` and `short_name` are never edited by a rebrand.

### Wordmark

The wordmark is "apostrophe" in lower case, Geist 600, with the ’ (U+2019) in `--acento` (`#1e6b47` in light, `#5cc594` in dark). `BrandMark` (`web/src/components/BrandMark.tsx`) draws it, with the mark from `mark.svg`; it is the only place either is drawn.

- **Where it shows.** The mark with the wordmark (the lockup) goes at the top of Sign in, of both invitation screens (new Business and joining one), of the first Onboarding step, and above "+ New sale" in the computer's side rail. The mark alone goes inline at the start of Home's header on the phone, and only when the business name fits whole beside it: CSS decides, by wrapping the mark onto a clipped second line, so the header never gets taller and the name never loses a character. Nowhere else: no other Tab root, card, detail, Sheet, Catalog, Sale bill or Telegram text.
- **Not a control.** Tapping the brand does nothing: no link, no hover or press state.
- **Fixed name.** Its accessible name is "apostrophe" in every Business, theme and Language, the Test locale included (`brand.wordmark` and `brand.mark.label` are verbatim keys). Beside the wordmark the mark is decorative and the ’ is `aria-hidden`; alone in Home's header the mark is an image named "apostrophe" while it is visible.

## Theme

The owner's decision of 2026-10-29 wins over ADR-0026 (the ADR is not edited here).

- **Automatic by default.** With nothing stored the app follows the phone's light or dark setting live, and re-checks when the seller comes back to the app.
- **A stored choice wins.** Light or Dark is chosen only in Settings → Appearance (Theme: Automatic, Light, Dark) and stored on that device as `tema` = `claro` or `oscuro`. Automatic is no key; any other value or a storage error also reads as Automatic.
- **The attribute is the resolved theme.** No `data-tema` on `<html>` is light, `oscuro` is dark. Only `web/src/theme.ts` writes it and the key; only `web/src/theme/systemTheme.ts` asks the system.
- **Old choices.** An old Dark still opens dark. An old Light stored nothing, so it now follows the phone.
- **Other tabs** pick up a change when they next load; there is no live sync between windows.
- **Accepted cost:** one light frame on a dark phone with nothing stored. A device that cannot report its setting reads light.

## Mobile standard

This section is a pointer and holds none of the standard's requirements.

- The mobile standard is `CODING_STANDARDS.md` §10 "Phone", the one authoritative text. The design README's "En el celular" restates it; where the two differ, §10 wins.
- §10's requirements and checks are written rules, not differences from a drawing, so the test in "Drawing as guide" never exempts them.
- The Mobile check itself is in `docs/product/mobile-check.md` and `docs/product/gate.md`.

## Typeface

Geist is the typeface of every screen, at weights 400, 500, 600 and 700, bundled with the app through `@fontsource/geist` (imported only in `web/src/main.tsx`): the app fetches no font from outside the installation. `--fuente` is `'Geist', system-ui, -apple-system, sans-serif` and is the same in `docs/product/design-system/tokens.css`, `tokens.ts` and `web/src/styles/tokens.css`. The drawings in `pantallas/` still name Plus Jakarta Sans; a design capture answers that request from the self-hosted Geist files, so both sides are drawn in Geist (ADR-0042).
