---
status: draft
---
## Goal

Build `web/src/screens/ventas/NewSaleSheetHost.tsx`. It is the unrouted container that mounts the New sale Sheet and the Sheets stacked on it, and it holds the one leave guard. Once the New sale flip routes it, a seller entering a sale on the phone is asked before an accidental Close, Escape or back gesture throws away the lines she added. This part changes nothing the seller sees. The old guard in `NuevaVenta.tsx` keeps serving the live screen.

## Acceptance criteria

- `NewSaleSheetHost.tsx` exists. It is listed in `web/scripts/docs/front-exclude.json` (D-62e6dc23), and no route mounts it.
- The host owns `useSaleDraft` with `const dirty = isDirty(draft.state)` and adds no field to `SaleDraftApi`. `NuevaVentaSheet` keeps its own `touched={isDirty(state)}`.
- The host holds exactly one `useLeaveGuard(dirty, {sheetFloor: <the Sheet's own depth>, sheetDirty: dirty})`.
- The confirmation reuses "Discard the sale?", "No, keep entering" and "Yes, discard it" from leaveQuestion, with no Expense strip. No Copy module key is added.
- With no lines, Close, Escape and the phone's back gesture close the Sheet with no question. A customer, shipping or a note alone never asks.
- With at least one line, all three exits ask "Discard the sale?". "No, keep entering" keeps every line, and "Yes, discard it" leaves.
- With a line, closing a stacked Collect or customer search (and Create customer, and line detail once it exists) returns to the New sale Sheet. It never asks and keeps the lines.
- `close()` makes one history traversal below the floor (`navigate(-n)`), which the blocker judges. `leave()` calls `disarm()` and then makes the same traversal.
- On a direct address, both exits use `navigate(<parent path>, {replace:true})`, with the parent taken from the Navigation rule. Close lands on the parent and asks only when there are lines.
- `onSaved(saleId, name)` is called when Collect's save succeeds and calls `leave()` by default. A save with lines never asks and makes exactly one location change.
- The guard and the Sheet's `touched` both follow one line being added, and both clear after `stepDown`.
- `NuevaVentaSheet` gets no dialog, and its existing "Close: no dialog" test still passes.
- `NuevaVenta.tsx` and its guard are unchanged.
- No test-only route, flag, parameter or `data-*` hook is added.
- Each criterion has its own test group, written with Testing Library over `createMemoryRouter` with fetch faked. The Gate passes: vitest and e2e.

## Out of scope

- Routing the host, and the New sale flip.
- Any change to the old guard in `NuevaVenta.tsx`.
- The toast after a successful save.
- Any change to the words, layout or drawing of the confirmation.
- Ignoring system back and Escape while Collect is saving.
- Building stacked Sheets that do not exist yet (Gift, Special price, line detail).
- Any server change.

## Decisions

- The host mounts only the stacked Sheets that already exist and that `NuevaVentaSheet` and `CollectSheet` need. Line detail joins the stacked-Sheet criterion once it exists.
  - Reason: the capability still lists Gift, Special price and the line-detail Sheet as out of scope, so building them here would widen the part.
- Closing a stacked Sheet goes back one level, to the New sale Sheet, and never asks.
  - Reason: the lines live in the Sale in progress, not in the stacked Sheet, so nothing is at risk and asking would cost the seller a tap.
- The parent path for a direct address comes from the Navigation rule, not from the host.
  - Reason: the Navigation rule gives every screen its frame and its way back, and the PM confirmed this in the interview.
- Ignoring back and Escape while saving stays with the flip.
  - Reason: the sale-in-progress capability already gives that rule to the flip, and this part changes no live behaviour.

## Risks

- The blocker and `navigate(-n)` could disagree about how deep the Sheet is. A single exit could then make two location changes, or leave a stacked Sheet's history entry behind. The one-location-change and stacked-Sheet tests cover this.
- With no route, the guard is not walked in the running app. It stays unverified, not failed, until the flip.

## Screens

none

## Slices

### new-sale-sheet-host-leave-guard

#### Acceptance criteria

- `NewSaleSheetHost.tsx` mounts the New sale Sheet and its existing stacked Sheets. It holds exactly one leave guard keyed on `isDirty(draft.state)`, and it is listed in `front-exclude.json`.
- With no lines, Close, Escape and system back close with no question. With a line, each asks; "No" keeps the lines and "Yes" leaves.
- Closing a stacked Collect or customer search never asks and keeps the lines.
- A successful save never asks and makes exactly one location change. `onSaved` calls `leave()` by default.
- On a direct address, Close lands on the parent from the Navigation rule and asks only with lines.
- The guard and `touched` both follow a line being added and both clear after `stepDown`.
- `NuevaVentaSheet`'s "Close: no dialog" test and `NuevaVenta.tsx` are unchanged, and the Gate (vitest, e2e) passes.

#### Risks

- history-depth-mismatch
- unverified-until-flip
