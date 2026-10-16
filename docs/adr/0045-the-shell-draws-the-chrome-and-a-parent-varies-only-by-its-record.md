---
status: accepted
date: 2026-10-16
---

# The shell draws the chrome, and a parent varies only by its record

GH-135 (follow-up of #123). After #123 a card could show its own "‹ Variedades" beside the
shell's, the rail showed "+ Nueva venta" on a card, an archived variety said "‹ Variedades",
and the registry and navigation.md disagreed on one parent.

## Decision

1. **The shell is the only drawer of a screen's chrome** (the side rail, "+ Nueva venta", the
   "‹ <parent>" arrow). `chromeOf(screen, viewport)` (`web/src/shell/chrome.ts`) decides all of
   it from the registry's kind, plus the explicit `modalOnComputer` field, which is the only
   thing that hides the rail. `Shell` tests no screen id; a screen draws no arrow.
2. **A parent is the registry's, and varies only by its record**, never by how the screen was
   reached: an archived variety's page goes back to Archivadas, a variety's "Ver todas" lists to
   the variety by name. The record is published by the card (`useCardRecord`) and used by the
   arrow only when its id equals the route's `:id`. Until then (loading, error, gone, or a switch
   from A to B) the arrow is drawn from the static parent, so a card is never without one. The
   label and the fallback path are one `parentOf` answer; the path is read when the arrow is
   tapped.
3. **A scan ends the old shape.** `findSelfDrawnBackArrows` (`web/src/architecture/`) flags
   `variant="back"` on `Boton`/`BotonLink`, a literal `‹` and the `flecha-atras` class in
   `web/src/screens/**`, outside a shrink-only allowlist: `Analisis.tsx` (month steppers and the
   root's own "Volver") and `OnboardingStep.tsx` ("‹ Atrás", a step control in a form).

## Consequences

- The scan reads source text. An arrow drawn through a helper component in another module
  escapes it: a ratchet, not a proof.
- An archived variety opened cold reads "‹ Variedades" for one request before "‹ Archivadas",
  in return for always having a way out.

## Amendment (GH-166)

Point 2's mechanism is replaced; its rule is kept. A parent still varies only by its record,
matched on the route's `:id`, never by how the screen was reached, but the record no longer travels
through a published `useCardRecord` and a `recordParent` rule in the registry. A card the registry
marks `backLabel: 'record'` (a variety's page, its prices, its entries) declares its word through
the typed `useBackParent(screen, override)`, and the shell's arrow uses it only for the same screen
and route param. Until the card declares one, such a leaf draws no arrow and no placeholder word,
instead of the static parent "‹ Variedades" for a request: the plan's invariant 4 for GH-166 wins
over "a card is never without one" in the Consequences below. `chromeOf` and `modalOnComputer`
(point 1) and the self-drawn-arrow scan (point 3) are unchanged.
