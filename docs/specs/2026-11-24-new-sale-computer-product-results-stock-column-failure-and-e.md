---
status: draft
---
## Goal

Finish the computer New sale product results table (`web/src/screens/ventas/ProductResultsTable.tsx`), which GH-916 built without three pieces. This adds a Stock column, the failure, no-products and no-match states, and a per-row Add button. A seller at the computer can then find a Product by typing, add it with Enter or one click, and see its price and current Stock. The table never shows a blank or misleading body. Nothing changes on screen until the GH-496 flip mounts the table.

## Acceptance criteria

- The table reads Stock itself (`keys.stock()` with `readStock`, the app's default options) and passes the real rows to `pricedRows` without changing its signature. A pending Stock read counts as loading and a failed one as failure.
- The column headers are Product, Stock, Price and a visually hidden Add, in that order.
- The Stock cell shows the bare current figure, right-aligned in Tabular figures, with 0 and negative shown and no Unit. After it comes the `STOCK_TEXT` word in grey for no entries, sold out and low, and nothing for ok.
- Stock never blocks an Add. A Product with zero or negative Stock is added with Enter and with Add.
- Each row has a real icon-only "+" button with accessible name "Add {name}", `tabIndex=-1` and the touch target of CODING_STANDARDS §10. It is disabled on a No price row.
- The Add button's `onMouseDown` calls `preventDefault`. Its click does what Enter does on that row, then calls `inputRef.current?.focus()` in the same handler. A Product already in the sale gets its line raised, never a second line.
- Clicking elsewhere on a row selects it without adding. Hover does nothing.
- Tab leaves the table without stopping on any Add button.
- States replace the body, first match wins: failure, loading, no products, no match, rows. Each state line sits in one cell spanning the four columns. The search and the help line "↑ ↓ to move, Enter to add." stay in every state.
- Failure: any of the three reads (Products, Pricing settings, Stock) failed. It shows "The products could not load. Reload this screen to try again." with the shared Attention icon, with no Retry and no automatic refetch.
- No products: the read returned no unarchived Product. It shows "No products yet.", centred, as text with no link.
- No match: it shows "No product matches that search."
- No state clears or changes the Sale in progress.
- `SALE_PRODUCT_TABLE_TEXT` gains 5 English keys: "Stock", "Add {name}", "No products yet.", "No product matches that search." and the failure line. The failure line goes in `LONG_REFUSALS`, unchanged, if copyLimits flags it. "Add" (`columnAdd`) is reused.
- `en.baseline.json` is regenerated with `npm --prefix web run i18n:baseline`, and `baseline_exceptions.json` gains no entry.
- Tests run through the GH-916 wrapper (real `useSaleDraft`, fetch faked). They cover:
  - the Stock cell for ok, low, sold out, negative and no entries;
  - a No price row can't be added with Add;
  - focus is in the search after an Add click;
  - Tab skips every Add;
  - the failure state for each of the three reads, plus the no-products and no-match states.
- The GH-916 test with one read failed and the other pending now expects the failure line. Its "no Stock figure" test is replaced by the Stock tests. Every other existing test passes unedited.
- Every figure comes from `pricedRows`/`pricing.ts`, and no new code multiplies or adds money.
- No production module imports `ProductResultsTable`, and `productResultsUnrouted.test.ts` and the `front-exclude.json` entry stay. No route, `WalkState`, `screens.json`, build constant, query parameter, window flag or `data-*` hook is added. `NuevaVenta.tsx` is unchanged and its tests pass unedited.

## Out of scope

- Routing or mounting the table, `WalkState`, `screens.json`, and anything in the GH-496 flip.
- A Retry button, an automatic refetch after a failure, or keeping the Sale in progress across a reload.
- A link from "No products yet.", a visible "Add" word on each row, and an "already in the sale" mark.
- Stock as of the Sale's date.
- Barcode, category or scanner (accepted departure 2).
- Any change to the phone Product list, `NuevaVenta.tsx` or the shared pricing rule.

## Decisions

- The Add button is icon-only "+", with its meaning carried by the accessible name "Add {name}".
  - Reason: The written definition in sale-in-progress.md already gives it this shape and outranks the drawing (Drawing as guide). A visible word on every row repeats the hidden header and Enter.
- The failure line has no Retry and no automatic refetch.
  - Reason: The table is unrouted until the GH-496 flip, so no seller can lose a Sale in progress to a reload before then. The flip decides retry against the drawing.
- "No products yet." is text only, with no link.
  - Reason: Onboarding already requires a Product with a price, so the state is rare, and the Products tab is one click away in the sidebar.
- The Stock column shows current Stock, not Stock as of the Sale's date.
  - Reason: Stock is undated in the glossary, the phone list shows the same figure, and it only informs, so a past-dated sale is never blocked.
- A failed Stock read is a failure in the table, unlike on the phone.
  - Reason: A row without its Stock would look complete when it isn't. The pending list in the capability already decided this.
- Each state line and the loading line span all four columns.
  - Reason: The Stock column brings the table from three columns to four.
- The existing "Add" key (`columnAdd`) is reused, so the task adds 5 keys, not 6.
  - Reason: GH-916 already created it.

## Risks

- The failure line can show while `aria-busy` is still true (another read pending), under GH-916's rule. The flip judges it with a screen reader.
- The drawing NuevaVentaCompu was not checked against the icon-only Add, the failure line without Retry or the no-products line without a link. Any departure goes to the owner at the flip.
- With no route there is no Design capture ("not compared"), and the keyboard and Add behaviour are checked only through tests until the flip.

## Screens

The table is not routed, so it has no screen registry entry, Design capture or Screen image. Its screens come from the design stage (NuevaVentaCompu and its dark twin), and the comparison happens at the GH-496 flip.

## Slices

### product-results-stock-states-add

#### Acceptance criteria

- The Stock read and the Stock column show the bare current figure, with 0 and negative shown, plus the `STOCK_TEXT` word for no entries, sold out and low, and nothing for ok. Stock never blocks an Add.
- Each row has an icon-only Add button: accessible name "Add {name}", `tabIndex=-1`, disabled on No price, `onMouseDown` calling `preventDefault`. Its click does the same as Enter on that row, then puts focus back in the search.
- The failure state (any of the three reads, with the Attention icon), the no-products state and the no-match state each replace the body. The help line stays below.
- 5 new keys go in `SALE_PRODUCT_TABLE_TEXT`, the baseline is regenerated, and `baseline_exceptions.json` gets no new entry.
- Tests cover the Stock cell cases, a No price row not added with Add, focus after an Add click, Tab skipping Add, and the three states. The two GH-916 expectations are updated and every other test passes unedited.
- The table stays unrouted. No test-only hook is added and `NuevaVenta.tsx` is unchanged.

#### Risks

- aria-busy-with-failure-line
- drawing-check-unverified
