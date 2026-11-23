---
status: draft
---
## Goal

Add name search to New sale's Product list (`web/src/screens/ventas/NuevaVentaProductos.tsx`). It is for the seller recording a sale on the phone when the Product the customer asked for is not already in the sale or among "Most sold". The seller types part of a name, sees only the matching Products with the match highlighted, and adds one in a tap or two without scrolling. The list stays unrouted until the flip part of GH-496, and #924's ten invariants hold.

## Acceptance criteria

- The list shows a search field with a visually hidden label "Search products" and the placeholder "Search by name". It has type search, inputMode search, autoComplete off, enterKeyHint search, and a font size of at least 16 px.
- The trimmed text matches anywhere inside a Product's name, ignoring case and accents.
- With text, the list shows "Results · N" followed by the matches, sorted by name ignoring case and accents. N is the number of rows shown.
- A search with no match shows "Results · 0" and nothing else.
- While searching, the hint and the "In the sale" and "Most sold" sections are hidden.
- Text that is only spaces counts as an empty search, and the normal list shows.
- Each result name has a mark element over the first match, at weight 600 and in the accent token. The mark covers the name's characters as written, and the shown name never changes.
- A matching Product already in the sale shows with the same line it has in #924's list: its steps, its quantity and its own price. A matching Product with no price shows "No price" and no "+".
- A line whose Product is no longer returned ("no longer available") never matches and is not shown while searching. It comes back when the search is cleared.
- After a result is tapped, the search text stays.
- Deleting the text brings back the list with the same sections, rows and order as before the search.
- Typing or clearing never changes the Sale in progress and triggers no network request.
- The search field is always visible. "Results · N" and the rows follow #924's single display condition, so nothing shows while that condition hides the list.
- No clear control is added unless the search state in the NuevaVentaProductos drawing shows one.
- The `newSale` group of `SALES_TEXT` gains `productsResults(n)` "Results · {n}", `productSearchLabel` "Search products" and `productSearchPlaceholder` "Search by name". All three are registered in LIMITED_COPY and BASELINE_ARGS, and `en.baseline.json` is regenerated with its step.
- `NuevaVentaProductos.test.tsx` covers case, accents, name order, "Results · 0", the highlight, text that is only spaces, the hint and the sections hidden while searching, and restoring the list on clear.
- vitest, tsc strict and oxlint pass, with nothing silenced.
- A Design capture of the search state, light and dark, against NuevaVentaProductos and NuevaVentaProductosOscuro is attached to the PR.

## Out of scope

- Routing the list or mounting it in any screen, Navigation entry or Sheet (the flip part of GH-496).
- Filters by Stock, price, Hidden product or Catalog attributes.
- Loading and failure states of the list (#941).
- Any change to the Sale in progress, pricing, Stock or the server.
- A clear control of our own that the drawing does not show.

## Decisions

- A match can be anywhere in the name, ignoring case and accents, with the text trimmed. Only the first match is highlighted.
  - Reason: this is the same rule as the Customers search, so the seller learns one rule, and it works for any Business's names (Assume nothing).
- Text that is only spaces counts as an empty search.
  - Reason: a stray space should not hide the sections or show "Results · 0".
- Products already in the sale appear in the results, with their line.
  - Reason: hiding them would answer "Results · 0" for something the seller can see they added.
- The search text stays after a result is tapped.
  - Reason: the seller can add several Products that match the same letters without typing again, which serves the "few taps" job.
- The clear control follows the drawing.
  - Reason: no role adds or drops something visible against the drawing; only the owner decides a departure.
- Results are sorted by name using the same comparison as matching, and the highlight covers the original characters.
  - Reason: a name never sorts or highlights apart from the way it matches, and the shown name stays as the seller wrote it.
- The search field always shows, and the results follow #924's display condition.
  - Reason: the field holds no data, while no count or row may show before the reads arrive (#924 invariant).
- "No longer available" lines never match and are hidden while searching.
  - Reason: they have no name to match, and they come back when the search is cleared, so no line is ever lost.

## Risks

Matching that ignores accents can shift character positions and misplace the highlight on names with accents, unless the range maps back to the original string.
The drawing is not verified: the look of a Product already in the sale in the results, what happens to the text after a tap, and a possible clear control may differ from it, and any difference goes to the owner as a departure.

## Screens

The screens come from the design stage: the search state of NuevaVentaProductos and NuevaVentaProductosOscuro, compared through the Design capture.

## Slices

### new-sale-product-search

#### Acceptance criteria

- The search field, matching, "Results · N" or "Results · 0", the highlight, the hidden hint and sections, and restoring the list on clear all behave as in the Spec's acceptance criteria, each covered by `NuevaVentaProductos.test.tsx`.
- The three copy keys are registered and the baseline is regenerated with its step.
- vitest, tsc strict and oxlint pass, with nothing silenced, and the Design capture is attached.

#### Risks

- accent-highlight-range
- drawing-unverified
