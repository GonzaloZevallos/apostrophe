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
   variety's page, both `inert` and `aria-hidden="true"`, with the host as their sibling.
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

- The design dims a sidebar behind the scrim. `Shell` draws its side rail for every form on
  a computer and the scrim dims it, as the design does; `Shell` is unchanged. The rail is
  outside both panes, so it is not made inert: `aria-modal` keeps it from assistive
  technology, and a keyboard user can still Tab to it.
- The design writes "Cerrar" as a word. The icon-and-text rule keeps the app's icon
  button named "Cerrar".
