---
status: draft
---
## Goal

Restyle the frame of the Product page (`/varieties/{low}`, active and archived) toward `ProductoDetalle` and `ProductoDetalleOscuro`. This is for the seller who opens a Product from the phone and wants to see where it stands at a glance, with its actions right below:
- Stock with its Stock status;
- the price today or "No price";
- Days left;
- Hidden.

A new presentational `ProductStateBlock` with exactly three rows replaces the loose summary paragraphs and the marks row. The page takes the order header → state block → actions → Prices → In the catalog → Stock and entries → low stock → removal. Nothing changes in behaviour, routes, API fields or copy keys.

## Acceptance criteria

- `ProductStateBlock` exists in `web/src/screens/varieties/`. It has no fetch, takes the `active | archived` discriminated union with `hidden: boolean | null`, and always renders exactly three `listitem`s.
- Active: row 1 is the Stock figure with `MarcaEstado` (word and shape). Row 2 is the Current price or "No price" (`NO_PRICE_TODAY`). Row 3 holds Days left and Hidden, and keeps its line height when both are absent.
- Archived: row 1 is the Stock figure (even negative) with the neutral "Archived" `Insignia`. Row 2 is the price or "No price". Row 3 is "Hidden" when known, otherwise an empty row that keeps its height. No Days left and no Stock status.
- `hidden: null` leaves out the Hidden mark and never shows the Product as not hidden.
- The loading shape is three neutral bars with `aria-busy="true"`, no digit and no currency symbol. Heights come from token line heights.
- `VarietyPage` builds the union only once the variety, the Stock row and the catalog source of its kind (`catalogQuery` or `archivedCatalogQuery`) have settled. A failed catalog gives `hidden: null` with the existing error below the block. A failed variety or Stock row replaces the block with "No connection" or the generic retry.
- The inline `variedad-resumen` blocks and `.variedad-marcas` are gone. Every e2e, vitest, role-name, `mobile-standard/states*.ts` and `architecture/` use of a removed class is migrated in the same diff, with the zero-match search quoted in the PR (D-69509906).
- A structural test, written so later parts keep it unedited, shows:
  - the main content `h2`s are exactly Prices, In the catalog, Stock and entries, and the low-stock heading, in that order;
  - the buttons and links outside those sections are exactly edit name, Entry, New price, Take from stock, and one of "Delete product" or "Archive product".
- State block tests (hidden; no price; `days_left` null; both absent; archived with hidden) each render three listitems.
- With the catalog response held, the block is `aria-busy`, has three listitems, shows no digit and never shows "Hidden" first.
- With the catalog failed, a Product hidden on the server shows no "Hidden" and the error shows.
- With the Stock row failed, the error shows with no `aria-busy` block and no stand-in figure.
- Exactly one of "Delete product" or "Archive product" shows, last on the page with no heading, in its existing treatment. On an archived Product, Restore is the only action.
- In the `mobile` e2e project, at its viewport and default text size, the state block and the actions are inside the viewport without scrolling, active and archived.
- Row 3 wraps at large text sizes without truncating or dropping either item, and the page never scrolls sideways.
- The frame CSS in `web/src/styles/app.css` uses tokens only, in light and dark. Every restyled button has `touch-action: manipulation`, `user-select: none` and is at least 44×44 px.
- No copy key is added. `vitest` and the `mobile` e2e project pass with no offender added. `tsc` and `oxlint` are clean.
- None of the forbidden files is changed: `scripts/design/screens.json`, `web/src/routes.test.ts`, `ProductsComputer.tsx`, `VarietiesLayout.tsx`, `SendCatalog.tsx`, `PriceNew`, `PriceFrame`, `PriceForm`, `PriceFields`, `settingsRows.ts`, `fixedSets.ts`.

## Out of scope

- The drawing's category, unit of sale, cost/margin block, page-wide Save, photo tile and free attribute chips, and any placeholder in their place (owner's Decision 1).
- Any new behaviour, route, API field or copy key.
- Dedicated computer polish.
- The Design capture as a criterion.
- The sections' own restyling (part 2 of GH-850), and the archived page's registry and evidence (part 3).

## Decisions

- The archived block's row 3 stays as an empty row that keeps its height when the Product is not known to be hidden.
  - Reason: active and archived pages line up and nothing shifts when data settles.
- Row 3 wraps to a second line at large text sizes or on narrow screens, and never truncates or drops Days left or Hidden.
  - Reason: Phone first; nothing is lost and the page never scrolls sideways, at the accepted cost of one line at large text.
- When the Product or its Stock row fails, the existing "No connection" or generic retry replaces the block, which never shows a stand-in figure.
  - Reason: the block never shows a figure it cannot back, and the loading shape never stays on screen after a failure.
- The removal action keeps its existing treatment, last on the page with no heading, even though the drawing does not show it.
  - Reason: the owner accepted the departure ("Drawing 1: accept"), and the written definition requires Delete and Archive.
- Success criterion 1 (no scrolling on a phone) is checked by one assertion in the `mobile` e2e project.
  - Reason: the job's main success criterion needs a check of its own, and the request's tests did not measure it.
- `docs/product/varieties.md` is rewritten with the new order, the three-row block and the section "Rediseño de la página según ProductoDetalle".
  - Reason: the written definition must not disagree with what ships, and it wins over the drawing.

## Risks

Migrating the e2e landmarks (`archivadas.spec.ts:89` and the helpers) can break the mobile walk if any use is missed.
Keeping layout shift near 0 px depends on the loading bars using the same token line heights as the settled rows.
The new no-scroll e2e assertion can become fragile if the phone viewport or seed data change.

## Screens

The screens come from the design stage.

## Slices

### product-page-frame-state-block

#### Acceptance criteria

- `ProductStateBlock` renders exactly three listitems for the active, archived and loading shapes, with `hidden: null` leaving out the mark.
- `VarietyPage` follows the final order: header, state block, actions, Prices, In the catalog, Stock and entries, low stock, then removal with no heading.
- The structural test, the state block cases, the held, failed-catalog and failed-Stock-row cases, the Delete-or-Archive case and the archived Restore-only case all pass.
- In the `mobile` e2e project, the state block and the actions are visible without scrolling, active and archived.
- Every use of a removed class is migrated with a quoted zero-match search, no copy key is added, no forbidden file is touched, and vitest, the mobile e2e project, `tsc` and `oxlint` are green with no offender added.

#### Risks

- e2e-landmark-migration
- layout-shift-on-settle
- no-scroll-assertion-fragility