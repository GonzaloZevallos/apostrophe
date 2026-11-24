---
status: draft
---
## Goal

Build `ProductResultsTable`, the computer register's product results table for New sale. It is the left column of the drawing NuevaVentaCompu and its dark twin. A seller at a desk types part of a Product's name and presses Enter to add it to the Sale in progress. Each row shows the Product's Stock and the price the line would get for the Sale's date and Customer type. The component is built and tested but not routed: no seller sees it until the flip part of GH-496. The phone flow is untouched.

## Acceptance criteria

- Three Products are added with typing and Enter only, with no mouse and no Tab. The search box keeps focus throughout, and each add leaves the search empty with the first row selected.
- Every price shown comes from `priceSale` through `pricedRows`, for the Sale's date and Customer type. A Product with no price shows "No price" in words and cannot be added by Enter or by its Add button.
- After a date change, the table shows no rows, no old price and `aria-busy=true` until the new response arrives. Placeholder data counts as pending.
- Enter on a Product already in the Sale raises its line, and the Sale gets no second line for it.
- After an Add click, the focus is in the search input.
- Up and down move the selection and stop at both ends, without wrapping.
- Any change of the search text, an add and Escape put the selection on the first row. Escape clears the text and does nothing on an empty search. A re-price keeps the selection. With no rows, nothing is selected.
- Tab leaves the table without stopping on any Add button. Add buttons have `tabIndex=-1` and the accessible name "Add {name}", and are disabled on a "No price" row.
- Each of these states shows its line, and the help line "↑ ↓ to move, Enter to add." is always below the table:
  - loading, "Loading products…";
  - failure, "The products could not load. Reload this screen to try again.", with the Attention icon, for any failed read including Stock;
  - no Products, "No products yet.";
  - no match, "No product matches that search."
- Archived products never appear. Hidden products and Products with zero or negative Stock appear.
- Matching is anywhere in the name, ignoring case and accents, using `selectorSearch.ts`.
- Rows are ordered by name ignoring case and accents. Ties break on the name as typed, then on the id.
- Stock shows the bare figure, with 0 and negative figures shown, plus the `STOCK_TEXT` word for no entries, sold out and low.
- `web/src/architecture/productResultsUnrouted.test.ts` fails if any non-test module imports `ProductResultsTable`, and no production module imports it.
- All text lives in the `SALE_PRODUCT_TABLE_TEXT` group of `web/src/copy/sales.ts`, in English, with no unit or product-type word.
- `en.baseline.json` is regenerated with `npm --prefix web run i18n:baseline`, and `baseline_exceptions.json` gains no entry.
- `NuevaVenta.tsx` changes only its imports, and its existing tests pass unedited. No test-only route, build constant, query parameter, window flag or `data-*` hook exists.

## Out of scope

- Routing or mounting the table, and any entry in `screens.json` or WalkState (the flip part of GH-496).
- Barcode, category and scanner (accepted departure 2).
- New sale suggestions, any ranking, and a marker on rows already in the Sale.
- Automatic re-reading after a failure.
- Any change to the phone's Product list or to the server.

## Decisions

- Row order and matching reuse the phone search's rules. Matching uses `matchesQuery` and `foldForSearch`. Order is by name ignoring case and accents, with ties on the name as typed, then the id.
  - Reason: one rule for the same search in both places, and Enter always adds a predictable row.
- A failed Stock read counts as a failure of the table, unlike on the phone list.
  - Reason: the request says any failed read is a failure, and the table shows Stock as one of its three columns.
- The table does not apply the re-read on reconnect or focus from ADR 20261121.
  - Reason: that exception covers only the phone list's observers, and the failure line asks the seller to reload.
- There is no "already in the sale" marker on rows.
  - Reason: Enter already raises the existing line, and the draft's lines beside the table show the result, so a marker serves no job.
- "No products yet." also shows when every Product of the Business is archived.
  - Reason: nothing can be sold from the table in that case.

## Risks

The table is not routed, so the keyboard flow and the drawing comparison stay unverified in the running app until the flip. The side-by-side capture is "not compared".
The drawing may show a different order, a different match rule or an "in the sale" marker. If it does, the owner decides that difference in the PR.
The failure state has no retry other than reloading the screen.

## Screens

The screens come from the design stage.

## Slices

### product-results-table

#### Acceptance criteria

- `ProductResultsTable` and its tokens-only stylesheet behave as listed in the Acceptance criteria above. Each case has a passing Testing Library test that uses the real `useSaleDraft` with fetch faked.
- `productResultsUnrouted.test.ts` exists and passes, and no production module imports the table.
- The `SALE_PRODUCT_TABLE_TEXT` copy group and the regenerated baseline pass the copy guards with no new baseline exception.

#### Risks

- unverified-until-flip
- drawing-difference-for-owner