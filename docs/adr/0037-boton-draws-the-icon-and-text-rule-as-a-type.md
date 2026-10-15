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

## Amendment (GH-164): a fourth kind, the tappable notice

`row` could not draw a tappable notice such as Inicio's "Seguí con la configuración".
`.boton--fila` is a list row: it adds `padding: var(--espacio-lg) 0` and a
`border-bottom`, and PM ruled (GH-164, round 3) that a notice keeps its designed card
(surface, rounded corners, its own padding) with no row spacing and no row divider.
The rule document defines the control first (`icon-and-text-rule.md`, "Tappable notice";
the design-system README says the same), and the union follows it:

- **`variant="notice"`** on `Boton` and, through `BotonVisualProps`, on `BotonLink`.
  `children` is required. `icon`, `ariaLabel` and `textOnly` are typed `undefined`, so
  an icon, a name of its own or a text-only submit does not compile. The accessible name
  is the visible text. A chevron inside the children is a decorative mark of the screen,
  not an icon of the control.
- **Its look lives under its own class**, `boton-aviso` (`botonVisual.tsx`, `app.css`),
  never as a selector on or a reuse of `.boton--fila`. It takes the pressed cue of the
  filled controls (the `--papel` ring), since it rests on `--superficie`.
- **The closed lists are unchanged.** A tappable notice is neither an icon-only control
  nor a text-only one; `IconOnlyAction` and the text-only kinds do not grow.
- `expectIconAndTextRule` accepts the kind and rejects one whose accessible name is not
  its visible text. The type-level tests grow with it.

## Amendment: action links (GH-165)

The closing guards could not see an action drawn as a raw link. `findActionLinks` in
`web/src/architecture/closingGuards.ts` now does, and `findLinkAliases` keeps it honest.

- **Only `Boton` and `BotonLink` draw an action, links included.**
- **The marker is structural, not a class name.** A link (`InAppLink`, react-router `Link` or
  `<a>`) that does not close itself and holds a literal `<Icono` between its opening and its own
  matching close is an action. No `boton*` or `cobrar*` class catches today's offender
  (`gastos__cargar`), so a class cannot be the marker. A row's trailing `<Icono nombre="chevron" />`
  says "opens", not "do", and is not counted (`Ventas` draws one on every sale row).
- **Scope.** `screens/`, `shell/` and `components/`, minus the authors of `.boton*`
  (`BOTON_AUTHORS`) and `components/InAppLink.tsx`, which draws a link tag by definition, and minus
  test-side files. Comments are blanked first, newlines kept, so prose is not a tag.
- **`ENTRY_CLASSES`** is the closed list of entries that carry an icon and are not actions:
  `mas__item` and `ajustes__item`. It does not grow.
- **`aria-current` under `shell/` only.** The bottom bar and the sidebar are navigation entries that
  carry `aria-current` on their opening tag; that exempts a link under `shell/`. The same attribute
  under `screens/` or `components/` exempts nothing, and a shell class is never added to
  `ENTRY_CLASSES`.
- **One shrink-only list, keyed by identity** (file plus the link's `to=`): `ACTION_LINKS_LEFT`
  holds exactly Gastos' "Cargar gasto" (`/src/screens/Gastos.tsx to={EXPENSE_NEW}`). A count per
  file would hide a second action link in the same file. On the phone it is a 40 px round control
  with only an icon, a shape that is not in the closed icon-only map and that `BotonLink` cannot
  draw, so moving it would change what users see. A design and product issue about that shape is
  what empties the list. `OLD_SHAPES` (raw buttons and `boton*` classes) stays a separate list.
- **`findLinkAliases`** rejects an import that renames `Link` or `InAppLink`, which would hide a
  link from the scan.

### Known risks

The guard reads source with regular expressions. It does not see:

- an icon drawn by a helper component, or passed as `children`;
- a link re-exported under another name through a third module;
- an action link with no icon, styled by CSS.

It is a ratchet, not a proof. The follow-up that would close the hole is to make `BotonLink` and a
typed text-only link the only link components a screen may import.
`docs/product/icon-and-text-rule.md` does not change.
