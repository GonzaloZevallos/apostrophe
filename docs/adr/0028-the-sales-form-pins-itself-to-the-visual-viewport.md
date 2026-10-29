---
status: accepted
date: 2026-10-06
---

# The sales form pins itself to the visual viewport; the viewport meta stays

Nueva venta on the phone is a full-screen form with a fixed header, a scrolling body and a
fixed footer (the total and "Guardá la venta") that must stay above the on-screen keyboard
and the home indicator. iOS Safari does not shrink the layout viewport when the keyboard
opens, so a `position: fixed; bottom: 0` footer would sit behind it. Android Chrome does
resize it by default. One approach has to work on both without changing any other screen.

## Decision

- **`web/index.html`'s viewport meta is not touched.** `viewport-fit=cover` and
  `interactive-widget=resizes-content` are refused: each changes the geometry of every phone
  screen (safe-area insets appear everywhere, the keyboard resizes every layout), and this
  task owns three screens. Any later change to the meta ships only with a phone comparison
  (`scripts/design/compare.sh`) of every screen.
- **`useVisualViewport(ref)` pins the form's grid to the visual viewport.** On `resize` and
  `scroll` of `window.visualViewport` it sets `--vv-top` (`offsetTop`, px) and `--vv-alto`
  (`height`, px) on the element, and `data-teclado="abierto"` when
  `innerHeight − height × scale` exceeds 120 px. The CSS reads them with fallbacks that are
  correct without any script: `top: var(--vv-top, 0px); height: var(--vv-alto, 100dvh)`.
- **Pinch zoom is ignored.** While `visualViewport.scale !== 1` the numbers describe the
  zoom, not a keyboard: the hook removes both variables and the attribute, ignores events,
  and restores the pin when the scale returns to 1. Zooming therefore never compacts the
  footer.
- **While mounted the hook adds `html--formulario-fijo` to `<html>`**, so the CSS can stop
  the page itself from scrolling behind the form. Unmount removes the class, the variables,
  the attribute and the listeners.
- **Nothing is pinned on a computer layout** (`COMPUTER_QUERY`, `web/src/format/breakpoints.ts`,
  the one place the 900 px breakpoint is named) or where `window.visualViewport` is missing.
- **The hook reads only viewport geometry.** Nothing is stored or sent.

## Consequences

- iOS fires its last `resize` when the keyboard animation ends, so the footer settles in
  one step instead of following the animation. Accepted.
- The real iOS keyboard cannot be automated. Unit tests drive a fake `visualViewport`; the
  gate is by eye, before the shell merges, on an iPhone (Safari and the installed app) and,
  if a phone is available, on Android Chrome: the footer above the keyboard for grams,
  shipping and the note; the header fixed; the Debiendo hint reachable; pinch zoom not
  compacting the footer. If no Android phone is available, the PR names that as an open risk.

## Amendment (GH-319): one decision for "keyboard open", on iOS, Android and without the API

The shell and every phone sheet need the same answer to "is the keyboard open?", on Android
too (where `interactive-widget=resizes-content` is the default and the visual viewport shrinks
with the layout viewport, so the gap above is zero) and where `visualViewport` is missing.
The viewport meta is still not touched.

- **One pure function, `isKeyboardOpen`, in `web/src/components/keyboard.ts`, decides it.** No
  other module reads `visualViewport` to decide it. `useVisualViewport` reads the keyboard
  store and writes `--vv-top`, `--vv-alto` and `data-teclado="abierto"` as before.
  - `scale !== 1` clears everything: pinch-zoom is never a keyboard.
  - iOS: `innerHeight − visualViewport.height > 120`, unchanged, and it needs no focus.
  - Android: `innerHeight` more than 120 px below a **baseline**, while a text-entry control
    has focus, or had it less than `FOCUS_SETTLE_MS` (500 ms) ago.
  - Without `visualViewport`: focus on a text-entry control is open.
  - Text entry is a `textarea`, or an `input` of type text, search, email, tel, url, password,
    number or untyped. Date, time, select, checkbox, radio, range, color, file and buttons are
    not, and leave the bar where it is.
- **The baseline is the largest `innerHeight` seen since the last orientation change or the
  last resize that changed `innerWidth`; never a value taken at mount.** While a text-entry
  control has focus it only rises. It may follow `innerHeight` downward only once no
  text-entry control has had focus for `FOCUS_SETTLE_MS` since the last `focusout`, so a
  resize between two fields does not eat the keyboard, and a window that shrank with nothing
  focused (an address bar, split screen) is not a keyboard later.
- **The store is lazy and reference-counted.** It starts on its first subscriber, binds
  `window.visualViewport`, `window` resize, `focusin`/`focusout` and `screen.orientation`,
  rebinds on a subscribe when `window.visualViewport` is a different object, and clears its
  baseline, focus and timer when the last subscriber leaves.
- **`useVisualViewport(ref, { fixedForm = true })`.** `html--formulario-fijo` is set only
  when `fixedForm` is true, so Nueva venta's call is unchanged. The shell and `Sheet` pass
  `false`: the shell hides its bar and button under `data-teclado`, and a sheet pins its own
  height, neither owns the page.
- **Real Android and iOS keyboards cannot be automated.** The unit tests fake the viewport and
  the clock; the gate for Android is by eye on a phone, and the PR names it as an open risk if
  none is available.
