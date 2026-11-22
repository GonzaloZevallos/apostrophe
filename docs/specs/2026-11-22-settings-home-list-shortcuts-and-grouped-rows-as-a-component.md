---
status: draft
---
## Goal
Build `SettingsHomeList`, the list part of the phone Settings home, as a component that is not wired to any screen yet. It renders the three registry shortcuts and then the five groups of rows, taken only from `settingsRows.ts`, so that #927 (GH-843 part 3) can wire it. The seller it serves is on a phone with little time and wants to reach the right setting without hunting. Nothing visible changes in this task.

## Acceptance criteria
- `web/src/screens/settings/SettingsHomeList.tsx` exists. It takes `ctx` as a prop and reads labels, second lines, icons, addresses and shortcut labels only from `settingsRows.ts`.
- The three `SHORTCUTS` render as a strip of three equal cells with no heading, before the first group heading in the DOM. Each cell is one `InAppLink` to `shortcutTarget` of its row. Its accessible name is its visible label `settings:shortcuts.<fila>`. It shows a 36×36 icon tile in the primary soft tint above a 13 px label, and has no chevron.
- The five groups render in `SETTINGS_GROUPS` order. Each has a real heading in the existing 14 px `--tinta2` section-title style, and its rows that pass `isShown(ctx)` sit in one card surface with hairline separators.
- A group with no shown rows renders no heading.
- Each row is one `InAppLink` to its `to`, with an icon, a label, a nowrap ellipsised second line (text block `min-width: 0`) and a decorative chevron hidden from the accessible name. Its accessible name is label plus second line.
- Every row and shortcut link carries state `{enteredFrom: 'settings'}`.
- Rows and shortcuts are at least 44 px tall, with an `:active` state, `user-select: none` and `touch-action: manipulation`. The three shortcut cells keep equal height when a label wraps at 320 px.
- CSS lives under `ajustes-inicio__*` in `styles/app.css`, uses design tokens only, works in light and dark, and has no hex value in the component or the new CSS.
- The component is listed in `web/scripts/docs/front-exclude.json`.
- Testing Library tests cover: five headings in order with the shortcut strip first; with Customer types on, 12 rows with one language and 13 with two; with Customer types off, its row missing; shortcut names and hrefs matching the registry; `enteredFrom: 'settings'` on every link; an empty group renders no heading.
- No string is added to the Copy module, and no front address is added or changed.

## Out of scope
- Wiring the component into the phone Settings screen, and removing the `front-exclude.json` entry (#927).
- The Business card, search and the screen header of the Settings home.
- The computer Settings list.
- Any change to `settingsRows.ts` content, copy or routes.

## Decisions
- Shortcuts are a strip of three equal cells, not full-width rows.
  - Reason: full-width rows push the groups a phone screen down for no gain (Phone first). The strip applies the GH-843 UI review.
- Shortcut labels are 13 px, and group headings reuse the 14 px `--tinta2` section-title style as real headings.
  - Reason: 13 px fits two-line labels in three cells at 320 px, and real headings let tests and screen readers find the five groups in order.
- Every row ends with a decorative chevron hidden from the accessible name, and shortcuts have none.
  - Reason: it signals "opens a page" without adding copy, which keeps the rule that all text comes from the registry.
- A group with no shown rows renders no heading.
  - Reason: a heading never stands over nothing if a later registry change empties a group.
- Tests set `ctx` explicitly for Customer types and languages.
  - Reason: the registry hides Customer types while its switch is off or unknown (ADR-20261119), so row counts depend on the context.
- The component goes into `web/scripts/docs/front-exclude.json` until #927 wires it.
  - Reason: the owner's rule D-62e6dc23 allows an unwired module there without permission.

## Risks
The four drawing decisions on #927 may contradict a visual choice here. They take precedence, and #927 adjusts the component when it wires it.
At 320 px with text at 130 %, two-line shortcut labels may push cell height. The equal-height rule must hold without shrinking text below 12 px.

## Screens
The screens come from the design stage. This task wires no screen, and the visible result is judged in #927.

## Slices
### settings-home-list-component
#### Acceptance criteria
- `SettingsHomeList` renders the three registry shortcuts, then the five `SETTINGS_GROUPS` groups with headings and their `isShown(ctx)` rows, reading only from `settingsRows.ts`.
- Every row and shortcut is an `InAppLink` with `{enteredFrom: 'settings'}`, at least 44 px, with `:active`, `user-select: none` and `touch-action: manipulation`. Styles are under `ajustes-inicio__*`, tokens only, in light and dark.
- A group with no shown rows renders no heading, and the component is listed in `web/scripts/docs/front-exclude.json`.
- Testing Library tests cover heading order, row counts per context (12, 13, Customer types off), shortcut names and hrefs, `enteredFrom` on every link, and the empty group.
#### Risks
- drawing-decisions-on-927-may-override-visual-choices
- shortcut-cell-height-at-320px-with-130-percent-text