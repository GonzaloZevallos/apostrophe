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
