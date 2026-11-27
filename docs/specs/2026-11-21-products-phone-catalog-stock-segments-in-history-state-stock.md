---
status: draft
---
## Goal

On the phone (below 900 px), the Products screen splits into two views, Catalog and Stock. The seller picks one with a two-pill segment under the Part 1 title block. A seller who comes to check and send the catalog, or to record what came in or went out of stock, sees only what that job needs and keeps that view while working. Send catalog stays at 2 taps from any tab. Stock entry and Take from stock take 3: Products, Stock, then the action. The computer layout does not change.

## Acceptance criteria

- `PRODUCTS_SEGMENTS` (catalog, stock) is in `web/src/components/fixedSets.ts` with a non-empty reason, is registered in `FIXED_SETS`, and is the only source of the segment options.
- `readSegment(state)` in `web/src/screens/varieties/productsSegment.ts` reads only the key `productsSegment` with a shape check, and returns `'catalog'` when that key is missing or invalid.
- `withSegment(state, segment)` returns the state with `productsSegment` set, keeping `inApp`, `from` and any feedback key. Its doc comment names it a history-state writer beside `feedback.ts` and `inAppState.ts`.
- Every read and write of the segment goes through `productsSegment.ts`. The segment is never in a path, query or device storage, and no front address is added or redirected.
- The opt-in pill look of Pestanas draws a 32 px pill inside a 44 px button. The selected pill is filled, heavier and marked with `aria-pressed`, never by colour alone. It sets `user-select: none` and `touch-action: manipulation`, uses only tokens in `web/src/styles/app.css`, and keeps its roles: a group named "Products view" with buttons "Catalog" and "Stock".
- A new `products` copy namespace holds `segment.catalog` "Catalog", `segment.stock` "Stock" and `segment.label` "Products view". It is registered like the other namespaces, with the generated en-XA strings and types, and no Spanish text from the drawings ships.
- A switch navigates to the same pathname with `replace` and the state `withSegment(location.state, next)`. History length stays the same, and the new body starts at the top.
- The segment row scrolls with the content right under the title block and is never sticky. The title block stays a plain `div`.
- The Catalog view shows Send catalog, including its disabled state with the reason, and, when the data is ready, the rows or the empty state. It shows no summary and no stock actions.
- The Stock view shows the summary line, + Stock entry, Take from stock, the rows or the empty state, All entries and Archived (N), as today. It shows no Send catalog.
- The actions draw at once. The summary, the rows and the empty state wait for ready data and no failure, so a held API shows no empty wording and no digit.
- The notice, the failure and Loading render once above the body, and a notice shows once across a switch.
- The phone view has no Promos, chips, Filters, search, share, "···" or Publish button.
- Back from a form, a Product page, All entries or Archived returns to the segment the seller left. Saving a Stock entry returns to Stock with "Entry saved".
- A cold load, a Products tab tap, Delete, and Restore of the last archived Product open Catalog, and the tab tap leaves history length unchanged. Phone Stock, then computer, then phone again stays on Stock.
- At 900 px and up, the Products markup, classes and behaviour are unchanged, and the computer layout never imports `productsSegment.ts`.
- `openStockSegment(page)` in `web/e2e/helpers/` does a real click on "Stock". On a phone, `openScreens.ts`, `stockVariety.ts`, `seed.ts`, `scrollSeed.ts` and `ledger.ts` route through it.
- Every phone spec that reaches + Stock entry, Take from stock, All entries, "Archived (" or the summary line is migrated, and the PR lists them (D-69509906).
- `web/e2e/tapBudget.spec.ts` counts the Stock tap: 3 taps for Stock entry and for withdrawal on the phone, no more on the computer than on the phone, and 2 for Send catalog.
- One e2e covers Stock, + Stock entry, save, and still on Stock with "Entry saved". The e2e mobile project passes with no new offender.
- Phone vitests tap Stock first.
- No offender list, tolerance, `CONTENT_SHIFT_PX` or check is widened. If content-shift reports Send catalog flipping to disabled, that block is held until `firstRun` answers.
- `web/src/mobile-standard/states*.ts` has a WalkState for each segment.
- `scripts/design/screens.json` has rows `ProductosStock` and `ProductosStockOscuro`. Their steps click Stock, then wait on the + Stock entry label, and they are walked as the Stock WalkState. Neither is marked not-captured.
- `docs/product/navigation.md` says Stock entry and withdrawal take 3 taps (via Products, Stock, then the action) and Catalog stays at 2: criterion 1, criterion 43, the Take from stock job line, and every other line counting these taps. `stock.md` is checked for the same counts.

## Out of scope

- The computer Products layout (900 px and up).
- The Publish catalog button in the title block, and the search, "···", Promos, Filters, chips and share from the drawing.
- Changing when the stock actions are enabled.
- Different row content per segment.
- Keeping the segment anywhere beyond the history state.
- A sticky or pinned segment row.

## Decisions

- A row is the same in both segments, exactly as drawn today, and a tap opens the Product page.
  - Reason: the job changes which blocks show, not what a row says. A difference from the drawing is listed in the PR and judged with Drawing as guide.
- Switching segment starts the new body at the top.
  - Reason: the two bodies have different heights and jobs, so keeping the scroll position could land in the middle of the rows or past the end of a short body.
- The segment row scrolls with the content and is never sticky.
  - Reason: it matches the plain scrolling title block (invariant 7) and keeps content-shift clean, and the drawing has no sticky positioning.
- A reload keeps the segment, and a new visit opens Catalog.
  - Reason: the segment lives in the history entry's state, and keeping the view while working is part of the job.
- The stock actions show next to the empty state when there are no Products, as today.
  - Reason: the actions draw at once, and when they are enabled is outside this change.
- On the computer, Stock entry and Take from stock stay at 2 clicks.
  - Reason: there is no segment at 900 px and up, which meets the rule that the computer never takes more taps than the phone.

## Risks

Content-shift may report Send catalog flipping to disabled. The answer is to hold that block until `firstRun` answers, never to widen `CONTENT_SHIFT_PX`.
The e2e migration touches about 35 specs. A missed spec fails on the phone, because its landmark is no longer in the default Catalog view.
The opt-in pill look must leave every existing Pestanas use (Home | Analysis and the Panel tabs) unchanged.

## Screens

The screens come from the design stage.

## Slices

### products-phone-segments

#### Acceptance criteria

- The Catalog and Stock segment, `productsSegment.ts`, `PRODUCTS_SEGMENTS`, the pill look and the `products` copy namespace ship as specified, on the phone only, with the computer layout unchanged.
- Each view shows only its own blocks. The return paths keep the segment. A cold load, the Products tab, Delete, and Restore of the last archived Product open Catalog.
- The vitests listed in the task pass, and phone vitests tap Stock first.
- `openStockSegment` exists and every affected phone e2e is migrated and listed in the PR. The tap budget is 3 for Stock entry and withdrawal and 2 for Send catalog. The new save-on-Stock e2e passes, and the mobile project has no new offender.
- The WalkStates and the `ProductosStock` and `ProductosStockOscuro` registry rows exist, and the tap counts in `navigation.md` are updated.

#### Risks

- content-shift-send-catalog
- e2e-landmark-migration
- pestanas-shared-component
