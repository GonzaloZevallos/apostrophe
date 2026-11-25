---
status: draft
---
## Goal

At 900 px and up, Settings shows a side column with the search and the full Settings list, and the chosen setting's page beside it. The owner, or a partner, working at a computer can go from one setting to the next in one sitting without going back to the list. The phone stays exactly as it is. `SettingsComputer` is removed, and every settings route hangs from one pathless layout route at every width.

## Acceptance criteria

- Every `/settings/*` path renders its own title at 899 px and at 900 px, Users included.
- At 900 px, clicking any row shows its page beside the list. The list stays on screen, and exactly one row has `aria-current="page"` plus a marker that is not colour alone.
- `/settings` at 900 px shows "Choose a setting" inside a `main`, and no row is marked.
- Opening Business marks only Business. A direct open of `/settings/payments/methods/archived` marks Payment methods.
- Customer types with its toggle off renders its page, and no row is marked.
- The marked row comes only from `activeSettingsRow`, never from a path prefix or a label.
- A page chosen from the list shows no "Close". Expenses → Expense categories shows "Close", and it returns to Expenses. Prices → Customer types shows "Close", and it returns to Prices, with Prices marked.
- Only `SettingsNav`'s rows and shortcuts set `enteredFrom: 'settings'`.
- Each settings page has exactly one `main` landmark.
- A page with unsaved changes shows the leave confirmation when another row is clicked.
- A value typed in a page survives a resize from 899 to 900 px. `SettingsPaneContext` is always rendered, so the outlet never remounts.
- At the computer width, Ctrl K focuses the search, keeps the text of the page field it was pressed in, and never navigates. On the phone, Ctrl K does nothing.
- Typing a search and clicking a result shows that page in the pane, empties the field, brings back the full list and marks the chosen row.
- The search field has `aria-keyshortcuts="Control+K"` and shows the hint "Ctrl K".
- The five `settings:*` strings (panePrompt, searchPlaceholder, searchLabel, searchShortcutHint, searchShortcutAria) live in `web/src/copy/settings.ts` in English. The label and placeholder reuse GH-1029's keys if they exist.
- The phone's Settings DOM (elements, `ajustes-inicio__*` and `ajustes__item` classes, order) and its back labels are unchanged. `Shell` chrome for `/settings/*` is unchanged.
- The settings route tree never branches on viewport. Every child keeps its path and `handle.screen`. `SettingsLayout` forwards the `Me` outlet context.
- `SettingsComputer.tsx` and the CSS only it used (`.ajustes`, `.ajustes > .boton--enlace`, `.ajustes__negocio`) are deleted. `.ajustes__titulos`, `ajustes__lista`, `ajustes__item*` and `data-menu` are kept.
- Every test and e2e locator broken by the deletion is migrated in the same change. No element is put back (D-69509906).
- `web/e2e/insets.spec.ts` still passes with its 80 px top padding, on the page's own `main`, and its expected value is unchanged.
- The `NON_ROW_ROUTES` reason for `/settings/payments` reads "the parent page of Payment methods and Expense categories, reached by their back arrow". Part 1's entries are gone from `front-exclude.json`.
- An ADR under `docs/adr/` records that Settings on the computer is one pathless layout route, with the pane told by a context and never by a per-viewport route tree.
- `scripts/design/screens.json` has the seven computer dark twins, each pointing at its light drawing with `"tema": "oscuro"` and `"viewport": [1280, 920]`. No row is repointed and no route is added.
- No front address is added or redirected. No Settings row label, address or icon is declared outside `settingsRows.ts`.
- The PR carries these: Design capture ok for `ConfiguracionCompu` and its dark twin; the eight page rows and their twins, each judged with `ConfiguracionCompu` for the frame and its own drawing for the pane, said for each one; the `mobile` e2e result; and the `compare.sh` offender counts. No crop, mask, tolerance or widened offender list.

## Out of scope

- Cmd K and any device detection for the shortcut hint.
- Any change to the search's matching, no-match state or clearing (GH-1029).
- A Business card in the computer side column.
- Any change to the phone's Settings.
- Polish beyond the drawing.

## Decisions

- The search's matching, no-match state and copy are reused from GH-1029, and no second rule is added.
  - Reason: two definitions of one search would drift apart, and GH-1029 ships first.
- The side column holds only the search and the settings list, with no Business card.
  - Reason: the request gives the column only those two, and the computer sidebar dropped the Business row on purpose in GH-495 part 7.
- The shortcut is Ctrl K only, and the hint reads "Ctrl K" on every computer.
  - Reason: Cmd K adds scope nobody asked for, and "Assume nothing" is about how a business works, not about keyboard platforms.
- When the search hides the open page's row, nothing is marked until the field is cleared.
  - Reason: the search only filters what is listed, and the marked row only ever comes from `activeSettingsRow`. A hidden row is never put back.
- Close is dropped only for a page in the computer pane that was entered from the list. Every other entry keeps Close.
  - Reason: the list is the way out only for pages opened from it. A page reached from another page must return there.

## Risks

Deleting `SettingsComputer` removes e2e landmarks. Every use has to be migrated in this diff, without putting an element back.
The 80 px top padding pinned by `insets.spec.ts` may not fit on the page's own `main`. If so, it goes to the owner, and the expected value stays unchanged.
`ConfiguracionCompu` wasn't read during the interview. Where the search and its hint sit, and whether the drawing shows a Business card, may depart from the drawing. That goes to the owner.
If GH-1029 leaves the column blank when nothing matches, that gap belongs to a follow-up on GH-1029.

## Screens

The screens come from the design stage.

## Slices

### settings-computer-pane-layout

#### Acceptance criteria

- At 900 px, Settings shows the search and the list in a sticky side column, with the chosen page beside it. Exactly one row is marked by `activeSettingsRow` with `aria-current="page"` and a non-colour marker.
- Close, the leave confirmation, Ctrl K, picking a search result and the 899↔900 resize behave as the Spec's acceptance criteria state, under the real route table.
- `SettingsComputer` and its CSS are gone, broken tests are migrated without putting elements back, the phone's Settings is unchanged, and the PR carries the Design capture evidence.

#### Risks

- e2e-landmark-migration
- insets-top-padding
- drawing-departure-search-and-card