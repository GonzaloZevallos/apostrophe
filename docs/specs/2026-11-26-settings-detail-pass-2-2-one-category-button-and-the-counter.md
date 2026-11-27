---
status: draft
---
## Goal

Settings matches its approved drawings in two places, so a seller can check the setup of their Business at a glance on the phone. The Expense categories group shows the list and a single "+ Category" button that opens the add field only on demand. The two rows of the Payments and expenses group each show a count before the chevron: the number of offered Payment methods and the number of Expense categories.

## Acceptance criteria

- In Settings, the Expense categories group renders `ExpenseCategoriesEditor` in the collapsed mode. It shows the list and one "+ Category" button, and no "New category" field until the button is tapped.
- Tapping "+ Category" opens the "New category" field with focus. A saved add closes it and returns focus to the button.
- An open add field with text asks "Discard the category?" before leaving. An empty open field never blocks "Close".
- No control to collapse the field without saving is added.
- Settings does not show "Adding, renaming or removing a category saves right away.". The Onboarding categories step still shows it.
- Rename and Delete behave as before. The Onboarding categories step behaves as before.
- The comment saying Settings keeps the field always visible "as drawn" is removed. If no caller passes `addCollapsed={false}`, the prop is dropped and one mode remains.
- The "Payment methods" row shows the number of offered (not archived) Payment methods, the same list its second line joins, before the chevron.
- The "Expense categories" row shows the number of the Business's Expense categories before the chevron. With none, it shows "0" and no second line.
- Each count is a bare number with no unit word, in Tabular figures, using design tokens only, in light and dark.
- A count shows only once its own read has answered. There is no count while the read is pending or after it fails. The content stays `aria-busy` while pending.
- `PaymentsGroup.tsx` makes no new request. Both counts come from its existing queries.
- Each row link's accessible name still starts with the row label.
- Every vitest and e2e locator that found the always-visible "New category" field (`ExpenseCategoriesGroup.test.tsx`, `ExpenseCategoriesEditor.test.tsx`, the Settings e2e) is migrated in this diff. The field is never put back, visible or hidden, to satisfy a locator (D-69509906).
- Tests cover:
  - opening and closing the field in Settings, and a save closing it;
  - counts shown after both reads, and absent while pending and after a failure.
- The Mobile check walks a new state with the add field open. No offender list, tolerance or check is widened.
- Light and dark Design captures of ConfiguracionCategorias, ConfiguracionCategoriasCompu and ConfiguracionCobros (phone 375 and computer) are attached to the PR.

## Out of scope

- Rename and Delete of Expense categories.
- Any change to the Onboarding categories step.
- The Integrations drawing departures ("Find my chat" with its More info, "Enter the token first", "Go to the catalog"). The owner kept them as built.
- The frame of Payments and expenses on the phone, which stays a group with "Close".
- Any new API request or copy key.

## Decisions

- Settings hides the "saves right away" help line, and Onboarding keeps it.
  - Reason: the Settings drawings do not draw the line and the Onboarding drawing does. Each add, rename or delete already shows its result.
- No control is added to collapse the open add field without saving.
  - Reason: the drawing has none. A mistaken tap costs nothing, because an empty field never blocks "Close" and a field with text is guarded. The request asks for one mode.
- The count is a bare number with no unit word, in Tabular figures.
  - Reason: the drawing shows bare numbers, the row label names what is counted, and a unit word would crowd a 375 px row.
- The four drawing departures stay as built.
  - Reason: the owner accepted all four (human Decision 1 on GH-1069).

## Risks

Dropping the `addCollapsed` prop could change the Onboarding step. Its tests must keep passing unchanged.
Tying the help line to the collapsed mode instead of to the caller would hide it in Onboarding too.
Migrated e2e locators must open the field through "+ Category", never through a hidden element.

## Screens

The screens come from the design stage.

## Slices

### settings-categories-collapsed-and-payments-counts

#### Acceptance criteria

- The Expense categories group in Settings shows the list and one "+ Category" button. The button opens the field with focus. A saved add closes it. "Discard the category?" guards an open field with text. The "saves right away" line is hidden in Settings and kept in Onboarding.
- The "Payment methods" and "Expense categories" rows show their counts before the chevron, only after their own read has answered, with "0" for no categories. No new request is added and the accessible name starts with the label.
- Locators are migrated per D-69509906, the Mobile check walk state is added with nothing widened, and the light and dark Design captures are attached.

#### Risks

- onboarding-help-line-regression
- e2e-locator-migration
