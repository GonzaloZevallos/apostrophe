---
status: accepted
date: 2026-10-29
---

# Scroll on a change of screen is decided once at the router

GH-480. A new screen kept the offset of the one the seller left, and Back lost the seller's place
(navigation.md, criteria 21-23).

## Decision

1. **One decision, from the registry.** `shell/scrollOnArrival.ts` returns `top`, `keep` or `restore`
   from the pathname change, the navigation type, the viewport and the registry (`kind`, `pane`,
   `modalOnComputer`, `ONBOARDING_SCREENS`). It never reads the history key, the query, the fragment or
   the location state. Back and Forward restore; the same path keeps; a phone Shell form (a sheet) and a
   computer `modalOnComputer` route keep; a pick inside one two-pane layout on a computer keeps (the new
   variety form counts as part of the Varieties panes); anything else is the top.
2. **Offsets live in memory, keyed by history entry.** `shell/scrollPlaces.ts` holds a module-level map
   from `location.key` to a number, written synchronously in `router.subscribe` for the entry being left
   (no scroll listener). A same-path REPLACE carries the offset to the new entry. Nothing goes to
   `localStorage`, `sessionStorage`, history state or a URL, and no personal data is held.
3. **Restore follows the content.** `shell/scrollFollow.ts` scrolls to the smaller of the offset and the
   page's reach on each frame until the offset is reached, 3 s pass, the seller touches the page, or the
   next location change cancels it before its own decision applies.
4. **`history.scrollRestoration` is `'manual'` only after load plus one frame**, and `'auto'` again on
   `pagehide`, so the browser's own restore on a reload is never cancelled. After a reload the first Back
   opens at the top.
5. **Record payment keeps its own return.** A restore is skipped while the payment hand-off is pending:
   `useReturnToPlace` owns that return and is unchanged.
6. **Only the owners move the document.** `forbiddenApis` bans `window/globalThis/document` `scrollTo`,
   `scrollBy`, `scroll(`, assignments to `scrollTop`/`scrollLeft` of the document's elements and
   `history.scrollRestoration` outside `ScrollSync.tsx`, `scrollPlaces.ts`, `scrollFollow.ts` and
   `useReturnToPlace.ts`. In-page scrolling of an element (`scrollIntoView`) stays allowed.
