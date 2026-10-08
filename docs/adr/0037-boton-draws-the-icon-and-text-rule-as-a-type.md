---
status: accepted
date: 2026-10-07
---

# `Boton` draws the icon and text rule as a type: a closed action map, an icon on every action, four text-only kinds

GH-97 balances icons and text (`docs/product/icon-and-text-rule.md`). The rule has two
closed lists, and a rule held only in a document is broken one screen at a time. The
rule has to live where a screen cannot get around it: the types of the one button.

## Decision

- **`Boton` is a discriminated union**, and `BotonLink` (an `InAppLink` underneath, for an
  action that navigates) is the same union without the submit.
  - **Icon + text**: `variant` primary, secondary or destructive, with a required
    `icon: NombreIcono`. The icon is `aria-hidden`; the accessible name stays the word.
  - **Text only**: only `textOnly="submit"` with `type="submit"`, and the kinds `link`,
    `undo` and `back`. The last three accept no `icon`. There is no bare button: a
    primary, secondary or destructive with neither an icon nor `textOnly` does not
    compile. The answers of a confirmation are text only too; `ConfirmDialog` draws them
    through an unexported `AnswerButton`, so no screen has a second way to write one.
  - **Icon only**: `variant="icon"` with `action: IconOnlyAction` and a required
    `ariaLabel`. The icon comes from one closed `Record<IconOnlyAction, NombreIcono>`
    (delete to `tacho`, search to `buscar`, close to `cerrar`, edit to `lapiz`, share to
    `compartir`); a screen never picks the icon. The target is 44 px (`.boton-icono`).
  - `row` stays for a tappable list row.
- **Back is not close.** `back` is text ("‹ <parent>"); close is the `cerrar` icon with
  the name "Cerrar" and never takes the back kind.
- **The map lists what has a glyph.** `cerrar`, `lapiz` and `compartir` were drawn in
  `Icono.tsx` by the integration pass of GH-97 (the design gave no path for them), so the
  map and `IconOnlyAction` list all five actions: delete, search, close, edit and share. A
  sixth is one line in `botonVisual.tsx` and in the type, together with its glyph in both
  icon files, and the type-level tests grow with it.
- **Tests.** `Boton.types.test.tsx` makes `tsc` the test (a rejected shape must be
  `true`, an accepted one `false`, no suppression comment). `expectIconAndTextRule`
  (`web/src/test/`) reads the rendered DOM, and a real-tree test keeps every non-test
  module from importing `src/test/`.

## Consequences

- An area subtask cannot write an icon on a link, a submit without its type, or an
  icon-only control that has no name: `tsc` says so.
- A new kind of control is a change to this union and to the rule document first.
- The raw `<button>`s and action-styled links that screens still draw are migrated by
  each area; the closing subtask's guards end that state.
