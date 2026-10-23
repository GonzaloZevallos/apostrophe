---
status: accepted
date: 2026-10-15
---

# The price form on a computer is a modal drawn by its own route

GH-121 (follow-up of #47). `PrecioNuevoCompu.dc.html` draws the price form as a modal over
the variety's page; until now the app drew it as a page of its own.

## Decision

1. **Route, not sheet.** `/varieties/{id}/prices/new` stays a route. A sheet would not
   do: a direct link or a reload must open the modal, and ADR-0027 clears a sheet entry
   reached that way.
2. **The host owns, the frame draws.** `PriceNew` keeps the queries, the gone, error and
   loading states, `useBackOr`, `useLeaveGuard`, the flash, the sending state, the document
   `Escape` listener and focus. `PriceFrame` is presentational. `LeaveConfirm` is a sibling
   of the dialog, never inside it, and no native `<dialog>.showModal()` is used.
3. **One way out.** Escape, the backdrop, "Cerrar" and a save all end in the host's one
   `leave`. The three closing gestures do nothing while the save is in flight or while the
   leave confirmation is showing.
4. **What sits behind.** On a computer `VarietiesLayout` renders the list pane and that
   variety's page, both `inert` and `aria-hidden="true"`, with the host as their sibling;
   `Shell` draws no side rail on this route on a computer (the form kind has none).
   This is the first use of `inert` in `web/src`. jsdom proves only the attribute; one
   Playwright test proves the panes cannot be reached.
5. **One tree shape on both viewports.** The phone renders the same wrapper, the same
   frame element types and the background slots absent, so a resize across 900 px never
   remounts the host and what was typed is kept.

## Cost and reach (engineering standards, section 8)

Nothing new is reachable: no endpoint, field or datum is added. The background
`VarietyPage` behind the modal reads the variety, its prices, stock, movements and
catalog attributes, plus the list. When the seller comes from the variety's page these
are cached react-query hits; a direct link fetches all of them. The cost per open is a
constant number of requests, each costing what the variety page already costs
(O(that variety's history) for stock and movements).

## Where it differs from the design

- The design dims a sidebar behind the scrim. The form keeps its `form` kind, which has no
  sidebar, so on this route on a computer `Shell` does not draw the side rail at all and
  there is none to dim. The list and the variety's page behind the dialog are `inert`.
- The design writes "Cerrar" as a word. The icon-and-text rule keeps the app's icon
  button named "Cerrar".

## Amendment (GH-46): Registrar cobro uses the same pattern

`CobroCompu.dc.html` draws Registrar cobro as a scrim over Clientes, so on a computer
`/customers/{id}/payment` is a modal drawn by its own route, by the five rules above:

- `CobroRoute` is the host: it keeps the customer's query, the gone, error and loading
  states, `useLeaveGuard`, `useBackOr(CUSTOMERS)`, Escape and focus. `CobroFrame` is
  presentational, and `Cobro` is the form.
- Escape, the backdrop, "Cerrar" and a save all end in one `leave`, which does nothing
  while the save is in flight or while the leave confirmation shows.
- `ClientesLayout` renders `CobroPanes` on this route: on a computer the list and that
  customer's card behind it, both `inert` and `aria-hidden`, with the host as their sibling.
  The route's registry row carries `modalOnComputer`, so `Shell` draws no side rail behind it.
- On a phone the same wrapper holds the host alone, a full form screen.

Nothing new is reachable: the card behind reads what Clientes and the card already read. One
Playwright test (`web/e2e/cobroModal.spec.ts`) proves the panes cannot be reached.

## Amendment (GH-281): the background follows the origin

- What sits behind Registrar cobro is the screen it was opened from, on both viewports. Each
  entry point (the "Collect" button of a Clientes row, Home's "Collect", the card's "Record
  payment") follows one link helper in `routes.ts` (`paymentLink`), which writes
  `location.state.underneath`: `'home' | 'customers' | 'card'`, a closed set of screen names
  and no record data. `readPaymentUnderneath` is the one reader; it narrows without a cast,
  and anything outside the set (a direct link, a reload, an unknown value) gives the card.
- `CobroPanes` draws that screen as the host's sibling, `inert` and `aria-hidden`, in the
  same tree shape on both viewports so a resize never remounts the host: `customers` is the
  live list (the detail pane empty on a computer); `card` is the list and the card on a
  computer and the card alone on a phone; `home` is `InicioFondo`, Home's presentational
  background (the panel only: no first-run, onboarding or pinned-catalog read, no effect).
- The background never calls `useGoneExit` or navigates; `CobroRoute` alone owns gone, error
  and network.
- The phone is a sheet over that background, with the same host, the same `leave` and
  `aria-modal` as the computer's dialog.
- Correction: the Cobro registry row never carried `modalOnComputer` (the registry has no such
  key and `registryDisagreements` compares only kind and parent). The line above that says it
  does is withdrawn, and no key or check is added: `Shell` still draws the side rail behind
  the computer modal, as the built app does today.
