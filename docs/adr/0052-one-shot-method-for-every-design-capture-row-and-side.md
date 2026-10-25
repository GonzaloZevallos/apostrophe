---
status: accepted
date: 2026-10-25
---

# One shot method for every design-capture row and both sides

GH-301 (the request called this ADR-0050; 0050 and 0051 were taken). Supersedes ADR-0042's GH-273
rule 5, "The shot never disturbs the page", on how the shot is taken only. The measurements are in
`docs/evidence/GH-301-shot-method.md`.

## Decision

- **One method.** Every row and both sides call the same `takeShot` (`scripts/design/comparisons.mjs`).
  Every decision in it is a pure function in `scripts/design/shot.mjs`; nothing branches on the row,
  the side, the design file, the viewport width or the kind of screen. The side only names a failure.
  `fullPage` and the `block.screenshot` branch are gone: every shot is a plain `page.screenshot`
  with the section's clip when the row has one.
- **Layer or grow, decided first.** `planShot` evaluates `coversScreen` before anything moves: a fixed
  element counts only when displayed, visible, opacity above 0, and its intersection with the viewport
  spans the full width and at least half the height. A layer is never grown. Its frame must lie inside
  the viewport and no element inside it may be scrolled (`layerMiss`); a list that scrolls inside a layer
  by design is shown at its top and `scrollTop` is never reset. Any other page grows the viewport once,
  to the document's height at the registered width, before the final settle.
- **Checks after the final settle** (`sizeRecordMiss`, `regionMiss`). The size rule is a predicate on
  the change, never a list of selectors: on a grown side, a top that moves (fixed and sticky elements
  and their descendants exempt from the top only), a width change, a height shrink, a replaced node or a
  count change is a miss. Then the document fits the viewport in both axes (a built page wider than its
  registered width fails; it used to be a note), or, for a section, the clip does. After the shot the
  viewport must still be the size it was at the settle (`viewportUnchanged`).
- **A miss is a failure of the side.** `sideOutcome(reason, null)`: `null` in `index.json`, no PNG, a
  fixed English reason of the form `shot: <what> (design|built)` (no page text, no number, no error
  text; a timeout is `shot: timed out taking the shot (<side>)`), and `--strict` exits non-zero after
  every row has run. Each step is bounded at 8 s. The existing Spanish reasons are kept.
- **Stale files.** Before a row runs, its `<screen>.design.png` and `<screen>.built.png` are deleted
  from `--out` by exact name, so a side PNG only ever comes from that run's own buffer. Each evidence
  run uses a fresh `compare.sh` directory.
- **Fonts.** The design context serves Google Fonts from `@fontsource/plus-jakarta-sans`; the built
  page loads its own. A design-side font the route cannot serve fails the row through `fail(ctx)` but
  does not null that side's buffer: outside the method, recorded as a risk.

## Why the viewport grows, and the seller's view

The probe (evidence doc) tried CDP `captureScreenshot` with `captureBeyondViewport: true` and an
explicit clip: Chromium resizes the viewport to 1x1 and back inside the call, and on the 1280 px rows
the 900 px query flips off and on and nine fetches are re-issued. It fails its pass criterion, so
`captureBeyondViewport` is not used. Growing the viewport first moves nothing at the registered width.

The seller's view: fixed chrome appears once, at the document's edges, and `dvh` boxes keep their
registry size. A layer is never grown, so the `dvh` boxes of a layer keep their registry size. A page
whose in-flow elements follow a `min-height: 100dvh` box (the phone bottom bar under `.disposicion`)
does not: growing the viewport moves them, and the size rule then fails that side instead of shooting a
view the seller never sees (risk 1).

## The layer class and the design side

A layer is a fixed element covering at least half the screen (the half-height predicate: a phone
sheet that starts just under the top counts, a 60 px bar or a toast does not). The design side reaches
it as a section of the device's size: no prototype uses `vh`, `dvh`, `position: fixed` or
`height: 100%` (0 matches), so a prototype is never a layer, and the three Compu sections are exactly
the device's size. The four phone layer rows reach the design side as a section taller than the phone.
A shot of a layer is taken at the viewport; the document behind it may scroll and is not checked.

## Criteria

(a) repeatable; (b) one method for every row and both sides; (c) the seller's view at the row's
registry viewport, with nothing moved, stretched or cut off by the shot; (d) every difference against
the old tooling judged.

## Cost

Linear in the drawn elements of each grown side: two snapshots and one identity pass. Constant work on
the other sides. Nothing runs in the app, the gate or CI.

## Known risks

1. The first real grown shot is first seen in the hand checks; the census compared sizes on pages it
   threw away, and did not read tops. A red strict run stops the work; no check is loosened. A first
   smoke run of this tooling (`--only` of eight rows, 2026-10-25) shot `NuevaVenta`, `Cobro`,
   `CobroCompu`, `PrecioNuevoCompu` and `InicioCompu` on both sides and missed: `Inicio` built (the
   bottom bar and the new-sale button move their top by the growth: `shot: the page changed when the
   viewport grew`), `Gastos` built (same), `VariedadesCompu` built (`shot: page taller than its
   viewport`: after the growth the document is still taller than the viewport) and `Inicio` design (the
   section's clip spans x 24 to 414 in a 390 px viewport: `shot: section outside the viewport`).
2. A design-side font the route cannot serve fails the row but does not null that side's buffer.
3. A large grown page may miss the 8 s bound and fail with the fixed timeout reason.
4. A grown page shows its background below its content.
5. The four phone layer rows reach the design side as a section taller than the phone.
6. The seed day was 2026-10-24, not the pinned 2026-09-16, and 50 rows have no old counterpart (27
   old rows with Spanish labels and 23 new rows); (d) is judged against the census run.
