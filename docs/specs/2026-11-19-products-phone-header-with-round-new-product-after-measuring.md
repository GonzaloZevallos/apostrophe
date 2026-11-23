---
status: draft
---
## Goal

Rebuild the phone header of Products (`/varieties`, below 900 px) as drawn in `Productos.dc.html` and `ProductosOscuro.dc.html`. The header holds the title "Products", the Settings avatar, a reserved empty slot for Publish catalog and a round + named "New product". A seller working from the phone reaches New product in one thumb tap, with no zoom, no wrapped label and no sideways scroll, down to 246 CSS px. Nothing is built unless a throwaway measurement at 320 and 246 px, light and dark, proves the drawn header fits. At 900 px and up nothing changes. This is part 1 of 2 of GH-845.

## Acceptance criteria

- Before any production code, a throwaway Playwright fixture is measured at 320 px and 246 CSS px, in light and dark. It holds "Products", the 44 px avatar, "Publish catalog" as drawn, the 44 px round + and a Catalog/Stock segment row with a 32 px pill in a 44 px target.
- In that measurement every target is at least 44x44, every gap at least 8 px, no label wraps, and scrollWidth is at most clientWidth. The table is in the PR.
- The fixture is never committed into `mobile.spec.ts`, an offender list or a tolerance.
- If any cell of the measurement fails, no production code is built and the table goes to the owner. No label is shortened and no rule is widened.
- `web/src/screens/Variedades.tsx` keeps its path and its firstRun, catalog and archived queries (`FIRST_RUN_READERS` unchanged). It renders `ProductsComputer` or `ProductsPhone` according to `useViewport()`.
- The Send-catalog block, the stock action links, the summary line and `ProductsEmpty` are extracted unchanged and rendered by both layouts.
- At phone width, vitest finds a round + link with accessible name "New product" (today's copy key) that opens New product, and no list-body "New product" link.
- At phone width, the title block, the Settings avatar and the + render in every list state: Loading, failure, empty, notice and gone notice. They are never hidden or disabled.
- The phone title block is a plain div, never a header element, and it is neither fixed nor sticky.
- The Publish catalog slot in the phone title block contains no element.
- At phone width, the notice, gone notice, failure and Loading each render exactly once.
- The header + never takes the accessible name of the bar's + ("Vender"), and the phone bar is unchanged.
- At computer width, vitest finds the computer layout unchanged, with its "New product" link in the list.
- A before/after capture at 900 px is in the PR and shows no difference.
- Every phone vitest and e2e use of the list-body "New product" link is migrated to the + in the same diff. The link is not put back, visible or hidden (D-69509906).
- `scripts/design/screens.json` gains the rows `Productos` and `ProductosOscuro`, with route and path `/varieties`, `design_viewport` 414 by 844, each naming its own drawing. Existing rows are kept, and no row is marked not-captured.
- The e2e mobile project passes with no new offender. No offender list, tolerance, `CONTENT_SHIFT_PX` or check is widened.
- Every on-screen string added lives in `web/src/copy/` in English.
- `ProductsComputer` does not import `web/src/screens/varieties/productsSegment.ts`.
- CI vitest, e2e and web are green.

## Out of scope

- The Publish catalog button in the phone header. Its slot stays reserved and empty, and the later part of GH-845 (#898 / #848) fills it.
- The Catalog | Stock segment control and its state (part 2 of GH-845).
- Any change to the computer layout at 900 px and up.
- The new header on any other screen, the Archived card included.
- Any change to the phone bar or its + (New sale).
- Choosing a way out if the measurement fails: that is the owner's call.

## Decisions

- On the phone, the round + in the title block is the only entry to New product. The list body has no "New product" link, and the empty state gets no button of its own.
  - Reason: the job asks for one clear, thumb-reachable way to start a product, and two entries would split it.
- The title block, avatar and + show in every list state, Loading and failure included, and are never disabled.
  - Reason: adding a product does not depend on the list having loaded, and a first-run seller with no products needs the + most.
- On the phone, the Send-catalog block, the stock actions and the summary line stay in the list body, unchanged, while the Publish slot stays empty.
  - Reason: the catalog job keeps working where it is today, and the owner accepted the departure from the drawing as temporary ("Drawing 1: accept").
- The header + and the bar's + keep distinct accessible names, and the bar is untouched.
  - Reason: two round + buttons now share the phone screen. Distinct names keep New product and New sale from being confused by a person or a locator.
- A failed measurement only stops the task and escalates the table. The way out is not pre-decided.
  - Reason: any way out other than the forbidden ones (a shorter label, a wider rule) changes what the seller sees, so it is the owner's call.

## Risks

The drawn header may not fit at 246 CSS px with 44 px targets and 8 px gaps. In that case nothing ships from this part until the owner decides.
Locators that relied on the list-body "New product" link at phone width, including any in `web/e2e/helpers/`, must all be migrated in the same diff, or the e2e mobile project fails.
Moving the computer body into `ProductsComputer` could subtly change markup or classes. The 900 px before/after capture and the computer-width vitest guard against it.
The new `Productos` and `ProductosOscuro` captures will show the accepted missing Publish button against the drawings. Reviewers must read that as the accepted departure, not a defect.

## Screens

The screens come from the design stage.

## Slices

### products-phone-header

#### Acceptance criteria

- The Step 0 measurement table at 320 and 246 CSS px, light and dark, passes every threshold and is in the PR. If it fails, nothing else in this slice is built.
- Vitest at phone width finds the + named "New product" opening New product, and no list-body "New product" link.
- Vitest at phone width finds the title block, avatar and + in every list state.
- Vitest at phone width finds the title block as a non-sticky div.
- Vitest at phone width finds each message rendered once.
- Vitest at computer width finds the layout unchanged, and a 900 px before/after capture is in the PR.
- Every phone vitest and e2e use of the old link is migrated to the + (D-69509906).
- `screens.json` has the `Productos` and `ProductosOscuro` rows, with no not-captured mark.
- The e2e mobile project passes with no new offender.

#### Risks

- measurement-may-not-fit
- e2e-locator-migration
- computer-layout-drift
