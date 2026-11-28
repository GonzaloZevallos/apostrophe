---
status: draft
---
## Goal
On the phone, the Expenses screen gets one title row with three things in it: a round back to Analysis, the full title "Expenses", and Add expense. The seller can then add an expense or go back to Analysis with one tap, and the month and the list start one line higher. This applies Human Decision 1 (Drawing 1, 2 and 3 accepted on 2026-11-25) and D-8ecb8c1d. The computer layout and every other screen's back stay exactly as they are.

## Acceptance criteria
- On the phone, the Expenses header is one row: the round back first, then the title "Expenses" in full (never cut, no ellipsis), then Add expense at the far end, with the month row on its own line below.
- At 320 px (text at 100 % and 130 %), 246 CSS px, 375 px and 430 px, the row stays on one line, its scroll width equals its client width, every target (back, Add expense) is at least 44 px, and the title is not truncated.
- With the row at 19em or wider the back shows "‹ Analysis"; below 19em it is a round "‹" alone with the accessible name "Analysis"; it always goes to Analysis.
- With the row at 24em or wider Add expense is the labelled "+ Add expense" pill; below 24em it is a 44×44 round "+" with the accessible name "Add expense", rendered as one `InAppLink` that opens the same form.
- The pill turns into the icon before the back turns into "‹", the title never shrinks, and the narrowing is done by `@container` on the row.
- `routes.ts` has an explicit `backInTitleRow` field set only on `expenses`, and `chrome.ts` draws the shell's back arrow for a card only when it is not set, so there is exactly one back on Expenses on the phone.
- `shell/BackArrow.tsx` gains the look `round`, `Gastos.tsx` renders it first in its title row, and it remains the only component that draws a back (`backGuards`).
- The same row shows in every state (loading, empty, error, offline, with data) and in both themes, and never shows the "Settings" avatar.
- `.flecha-atras--redonda` is added wherever `.flecha-atras .boton--enlace` is named today (`closingGuards.ts`, `touch.test.ts`, `pressedBlock.bdc2945.ts`).
- No offender entry is added, and any obsolete one is removed in the same diff.
- The computer layout of Expenses renders exactly as before, and every other screen's back is unchanged.
- No new copy key is added: the accessible names reuse the existing "Analysis" and `common:addExpense`, and every colour comes from a token in both themes.
- `chrome.test.ts` and the `BackArrow` tests cover the cases above, and the e2e assertion covers the four widths.
- An ADR records that a card may draw the shell's back arrow in its own title row.

## Out of scope
- The computer layout of Expenses.
- The title row of any other card.
- New or changed user-facing text.
- A glyph other than "+" for the icon-only Add expense.
- Changes to the Expense form, the month navigation or the routes.
- GH-1053 invariants 1, 2 and 8 (`summarize`, rounding, weekdays), which belong to other parts.

## Decisions
- The back shows "‹ Analysis" with the word at 19em and wider, and the round "‹" alone only below 19em.
  - Reason: the request only defines the narrow form, and keeping the word keeps the destination readable as `expenses.md` writes it; the owner accepted it as Drawing 1.
- The icon-only Add expense keeps the pill's "+" glyph and is told apart from the bar's "+" by its position and accessible name.
  - Reason: D-8ecb8c1d prescribes an icon-only round button with an accessible name, and a different glyph would be a new look with no owner basis.
- The new row shows in every screen state and in both themes, never with the "Settings" avatar.
  - Reason: this keeps the #724 decision and today's header behaviour.
- `touches_copy` is false because the accessible names reuse existing copy.
  - Reason: "Analysis" and "Add expense" already exist in `web/src/copy/`; a new key would need the Copy module and would change the flag.
- Only the 24em and 19em thresholds may move after the e2e run.
  - Reason: the request fixes the order of narrowing and what each step does, and leaves only the thresholds open to tuning.

## Risks
If any e2e helper or spec locates the shell's "‹ Analysis" on Expenses, it must be migrated in this task, and the shell arrow must never be put back to satisfy a locator (D-69509906).
Text at 130 % on a 320 px phone (246 CSS px) leaves little room for the full title next to two 44 px targets, so the thresholds may need tuning after the e2e run.
`docs/assets/screens/Gastos.webp` still shows the old two-line header until it is regenerated; the written definition wins.

## Screens
The screens come from the design stage.

## Slices
### expenses-phone-title-row
#### Acceptance criteria
- On the phone, Expenses shows one title row (round back, full title, Add expense) that narrows at 24em (pill to icon) and 19em (back to "‹"), keeps its accessible names, and has only one back.
- The e2e assertion at 320 px (100 % and 130 %), 246 CSS px, 375 px and 430 px shows one line, no horizontal scroll, targets of at least 44 px, and the title not truncated.
- `chrome.test.ts` and the `BackArrow` tests pass, the guards include `.flecha-atras--redonda`, and no offender entry is added.
- The computer layout and every other screen's back are unchanged, and the ADR for the card-drawn back is recorded.
#### Risks
- e2e-landmark-migration
- narrow-width-threshold-tuning