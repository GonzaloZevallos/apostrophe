---
status: draft
---
## Goal

Part 1 of 2 of GH-846. It adds the pure model of one row in the phone Products tab's Catalog view, `catalogRow(input, money, t)` in `web/src/screens/varieties/catalogRow.ts`, and that row's copy in the Copy module. It serves the seller who opens Products on the phone and wants to see in each row the Product's price, whether it is sold out or low, and whether it is hidden from the Catalog, without opening each Product. No screen uses the model yet, so nothing visible changes. Part 2 wires the model in and is where the job is judged against the drawing.

## Acceptance criteria

- With a Current price, `priceLine` is the existing `common:pricePerGram(money(list_price))`. It appends `products:row.bulk` (" · Bulk {price}", the price through `money`, no unit) only when `isBulkPricing` is true and `bulk_price` is not null.
- With no Current price, `priceLine` is `products:row.noPrice` ("No price") and `hint` is `products:row.noPriceHint` ("Add a price to sell it."). Otherwise `hint` is null.
- `badge` is `'sold_out'` or `'low'` for those statuses. It is null for `ok`, `no_entries` and an undefined status.
- `hidden` is returned as given.
- `accessibleName` is built with `products:row.a11yName` in this order: name; price line (with the hint for a no-price row); status word from `products:badge.*` (only when `badge` is not null); `products:row.hidden` (only when hidden). An absent part is dropped together with its ", " separator.
- `products.json` (en) and its en-XA twin hold `badge.soldOut` "Sold out", `badge.low` "Low", `row.hidden` "Hidden", `row.noPrice` "No price", `row.noPriceHint` "Add a price to sell it.", `row.bulk` " · Bulk {price}" and `row.a11yName`. Any baseline the copy checks require is updated.
- No new literal unit, currency symbol or decimals is added anywhere in the change.
- `catalogRow.ts` imports no React, no hooks, no `api/*` module and no value from `screens/Variedades`.
- `src/screens/varieties/catalogRow.ts` is listed in `PRODUCTS_FILES` in `web/src/architecture/productsFiles.ts` and in `web/scripts/docs/front-exclude.json`.
- Unit tests of `catalogRow` without React, asserting the English copy, cover:
  - the price;
  - Bulk shown, and Bulk left out (no `bulk_price`; `isBulkPricing` false while `bulk_price` is set);
  - "No price" with its hint;
  - the badge for each status and for a missing status;
  - hidden;
  - the accessible-name order with dropped parts and separators;
  - the combination of "No price", a badge and Hidden.
- `tsc` strict, oxlint and the architecture tests pass, with nothing silenced.

## Out of scope

- Wiring the model into any screen, or changing today's Products rows (part 2).
- Showing the Bulk minimum on the row.
- A word or badge for the "no entries" status.
- Any archived input to the model.
- Unit logic of its own: the row follows `common:pricePerGram` when the `units` part of GH-318 changes it.
- Any change to the computer Products list.

## Decisions

- The Bulk part shows the Bulk price only, never the Bulk minimum.
  - Reason: a row is for scanning, and the minimum stays on the Product's page. Showing it would need a new unit-bearing literal that depends on GH-318.
- "No price", its hint and a "Sold out" or "Low" badge appear together on one row.
  - Reason: each is a separate, true fact the seller needs to see.
- `no_entries` and a missing /stock row get no badge, the same as `ok`. This is recorded as a known gap, with no follow-up opened now.
  - Reason: the request settles it this way. Any difference is surfaced by part 2's drawing check.
- `badge` is a value, and the visible and spoken word comes from `products:badge.*`.
  - Reason: the status must always be a word, never only a colour, and the text must live in the Copy module.
- The module is added to `front-exclude.json` until the wiring part removes it.
  - Reason: owner rule D-62e6dc23 allows it for a module not yet wired into a screen.

## Risks

- The accessible-name pattern must drop optional parts together with their separators. A single interpolation string cannot do that, so the copy shape must also satisfy the copy checks and en-XA generation.
- The architecture sweep that rejects stale `front-exclude.json` entries for `src/screens/varieties/` must still pass while the module is unimported.

## Screens

none

## Slices

### catalog-row-model

#### Acceptance criteria

- `catalogRow(input, money, t)` returns `priceLine`, `hint`, `badge`, `hidden` and `accessibleName` exactly as the Spec's acceptance criteria state.
- The seven `products` copy keys exist in English and en-XA, with no new literal unit, currency symbol or decimals.
- `catalogRow.ts` is pure (no React, hooks, `api/*` or value import from `screens/Variedades`) and is listed in `PRODUCTS_FILES` and `front-exclude.json`.
- The unit tests cover every case listed, including the combination of "No price", a badge and Hidden. `tsc` strict, oxlint and the architecture tests pass with nothing silenced.

#### Risks

- a11y-name-copy-shape
- front-exclude-stale-sweep