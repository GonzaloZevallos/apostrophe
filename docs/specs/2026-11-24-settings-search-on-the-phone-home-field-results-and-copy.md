---
status: draft
---
## Goal

Let a seller on the phone find a setting by typing part of its name on the Settings home and open its page with one tap. Today they scroll and guess which of five groups holds it. The work wires part 1's `searchSettingsRows` and `useSettingsSearchEntry` into the phone `SettingsHome` through a new `SettingsSearch` component. The search field sits under the `h1` and above the Business card. The computer Settings does not change.

## Acceptance criteria

- Step 0: with the field placed under the `h1` and above the Business card, the Design capture of `Configuracion` and `ConfiguracionOscuro` at 320, 375 and 430 px shows the three shortcuts fully on the first screen. Otherwise the work stops and goes to the owner, with nothing widened.
- `web/src/screens/settings/SettingsSearch.tsx` exists and `SettingsHome.tsx` uses it.
- `searchSettingsRows` and `useSettingsSearchEntry` keep their signatures. Any change ships with part 1's tests updated and is named in the PR.
- The field is one `<input>` that is never remounted, with `type=search`, `autoComplete=off`, `enterKeyHint=search` and a font of at least 16 px.
- The field's placeholder and `aria-label` are "Search settings", and it shows a magnifier icon.
- Search opens on `onClick` or `onChange`, never on `onFocus`.
- "Cancel" closes search.
- The × named "Clear" clears the text only, keeps search open and keeps focus.
- The native search cancel button is hidden.
- While the field has text, the Business card, the shortcuts and the groups are hidden, and only the heading slot and the results show.
- An empty field (after ×, after deleting the text, or after Cancel) shows the card, the shortcuts and the groups.
- The keyboard's search key closes the keyboard and keeps the results. It never opens a result and never changes the history entry.
- Each result is an `InAppLink` to its row's `to`, with `replace: true` and `state {enteredFrom: 'settings'}`.
- Each result shows the registry icon in `--tinta2` with no tile, the label, and the group name as a second line, each on one line with an ellipsis, followed by a chevron.
- Each result is at least 44 px high, has an `:active` state, has the label plus the group name as its accessible name, and is keyed by `row.key` in registry order.
- The heading slot is a `<p>` that is always rendered, with a token `block-size`, as a polite live region that starts empty.
- The heading slot stays empty, with no digit, while `/business` or `/pricing-settings` is pending, and `aria-busy` is true meanwhile.
- Once both reads have answered or failed, the heading slot shows the plural count or "Nothing found", and it is the same node before and after it fills.
- "Nothing found" replaces the list. It is registered in `web/src/copy/emptyStates.ts` and rendered from there.
- A row hidden for the Business is never in the results.
- Opening search and then typing push one history entry in total.
- Cancel and back each return to the groups with search closed.
- A result opens its page with `enteredFrom: 'settings'`. Back, or the page's "‹", lands on the groups with search closed and the field empty.
- A reload on a search entry shows the groups.
- After Cancel or back, the field is blurred, and then focus returns to the field without reopening search, or to the `h1` (`tabIndex=-1`) if the field cannot take focus.
- The bottom bar stays visible during search.
- Styles are in the existing settings stylesheet under `ajustes-inicio__*`, tokens only, for light and dark.
- The copy keys `search.placeholder`, `search.label`, `search.cancel` (or the shared Cancel key), `search.clear`, `search.results_one` and `search.results_other` exist in the `settings` namespace, and the `en-XA` twin is regenerated.
- Part 1's entries are removed from `web/scripts/docs/front-exclude.json`.
- No front path, redirect or route is added, and the `screens.json` search rows use route and path `/settings`.
- `SettingsComputer`, `SettingsHomeList` and `useSheetStack` are unchanged.
- No offender list, tolerance or check is widened.
- The screen tests listed in the PRD pass with Testing Library and `fetch` faked.
- The navigation tests listed in the PRD pass in `SettingsNavigation.test.tsx` with the real router.

## Out of scope

- Searching anything other than the labels of shown Settings rows: second lines, group headings, Products, Customers, Sales.
- Search on the computer Settings, and any change to `SettingsComputer`, `SettingsHomeList` or `useSheetStack`.
- Remembering the search text after leaving the page or reloading.
- Opening a result automatically from the keyboard's search key.
- Any change to the Business card or the shortcut layout beyond the downward shift the owner accepted.

## Decisions

- While the field has text, hide the Business card, the shortcuts and the groups, and show only the heading slot and the results.
  - Reason: on a 320 px phone the result the seller typed for has to come first, and the shortcuts would push it below the fold.
- The keyboard's search key only closes the keyboard and keeps the results. It never opens a result, even a single match.
  - Reason: the seller always chooses the setting, and results already update as they type.
- After going back from a result, the field is empty and the groups show.
  - Reason: "an empty field shows the groups" and "back lands on the groups with search closed" only fit together with an empty field, and a reload behaves the same way.
- The success criterion "under 10 seconds" is measured by a stand-in: every shown row is listed by a substring of its label and opens with one tap.
  - Reason: a fast, self-contained test can check this, while a stopwatch on a person cannot be checked in the Gate.

## Risks

The field can push the shortcuts below the first screen at 320 px. Step 0 stops the work and sends it to the owner, with nothing widened.
Showing the count or "Nothing found" before `/business` or `/pricing-settings` answers would send the seller back to scrolling. The slot must wait for both reads.
A history-entry bug could leave a dead search entry or trap back navigation. `replace: true` on results and the single flag owner `useSettingsSearchEntry` guard against it.
Moving the card and shortcuts down could break an e2e landmark. Every e2e use is migrated in the same task (D-69509906).

## Screens

The screens come from the design stage.

## Slices

### settings-search-phone-home

#### Acceptance criteria

- Step 0 passes: the three shortcuts are fully on the first screen at 320, 375 and 430 px in light and dark with the field in place. Otherwise the work stops and goes to the owner.
- `SettingsSearch.tsx` is wired into `SettingsHome.tsx` with the field, results, heading slot, Cancel and Clear behaving as the Spec's acceptance criteria say.
- The screen tests pass: results with the count, no match, the held `/business` read, the same slot node before and after it fills, × keeping search open, and a hidden row never shown.
- The navigation tests pass: one history entry for tap then typing, Cancel and back returning to the groups, a result opening with `enteredFrom: 'settings'` and back landing on the groups with search closed, a reload showing the groups, and focus returning to the field with search closed.
- Copy is added with the `en-XA` twin regenerated, "Nothing found" is in `emptyStates.ts`, and part 1's `front-exclude.json` entries are removed.
- `SettingsComputer`, `SettingsHomeList`, `useSheetStack` and the front routes are unchanged, and no list, tolerance or check is widened.

#### Risks

- shortcuts-below-fold
- premature-empty-state
- dead-history-entry
- e2e-landmark-moved