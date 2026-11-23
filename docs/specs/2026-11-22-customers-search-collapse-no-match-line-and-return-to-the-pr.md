---
status: draft
---
## Goal

This finishes Customers search on the phone (part 4 of 4 of GH-831) for the small-business seller looking for one Customer among the few dozen they sell to. Typing collapses the screen to the flat list at once. A pending answer shows only "Searching…", never the previous rows. No match shows only the existing no-match line, and a failed search shows the existing load-failure message. Clearing the query returns at once to the segment the seller was on. Debtors found by search keep their debtor row. No text is added.

## Acceptance criteria

- The collapse follows the typed `query`, not the debounced value: as soon as a query that is not only spaces is typed, the segments, the card and the Total owed are gone.
- A query of only spaces counts as no query: segments and card stay, nothing collapses.
- While the search answer is pending (placeholder data or fetching), the flat list shows only the existing "Searching…" line under `aria-busy`, never the previous rows.
- A debtor in the result keeps the debtor row, with the type taken only from `standing` and its Since line from `owing_since`.
- The no-match line shows only when `!isPlaceholderData && !isFetching` and the list is empty under a non-blank query. It is the existing line word for word, with no segments, no card and no "Nobody owes you", and it never shows during a pending answer.
- A failed search shows the screen's existing load-failure message in the flat list, never the no-match line, never the previous rows, and no segments, card, Total owed or "Nobody owes you".
- Clearing the query returns at once to the segment held in the layout context (`CustomerSearch.ts`), with no flat moment showing the previous answer, even if that segment is now empty. The screen never jumps to "All" on its own.
- After clearing, "Owed to you" with nobody owing shows "Nobody owes you" only once the debtors read has answered successfully. A pending read shows the skeleton; a failed read shows the flat list.
- After clearing back to "All", the previous query's matches are never shown as the full list. While the full list is pending, the screen's existing loading treatment shows.
- Leaving the Customers tab drops the held segment, and a fresh mount opens on "Owed to you".
- Returning from a Customer opened from the results keeps today's behaviour, and the rules above apply to whatever query state it returns to.
- No Copy module key is added or changed.
- Testing Library tests with faked fetch cover:
  - typing hides the segments and the card;
  - a debtor keeps the debtor row;
  - pending shows "Searching…" without the previous rows;
  - no match shows only the no-match line, and never while pending;
  - a failed search shows the load-failure message, not the no-match line;
  - a spaces-only query does not collapse;
  - "All", then typing, then clearing returns to "All";
  - a fresh mount opens on "Owed to you".
- `CustomerSearch.test.ts` covers a spaces-only query and the immediate return after clearing.
- WalkState and `scripts/design/screens.json` rows exist for search held (Searching), search answered, no match, and cleared back to "All". The held phase of `ClientesBusqueda` is updated. Zero offender entries are added.
- No file under `web/src/screens/clientes/` chooses a row type from `balance` or any money value, and no TypeScript computes on a count, bucket or amount.
- Segment options are read only from `CUSTOMER_SEGMENTS` in `web/src/components/fixedSets.ts`.
- `owedPlace()`, `OWED_PLACE` and `useReturnToPlace.ts` keep their behaviour.
- Every e2e use of a removed or moved landmark is migrated in the same diff, and no element is kept to satisfy a locator.
- `docs/api/**` and `docs/architecture/**` are not edited.

## Out of scope

- Changing how search matching works.
- Changing what the back gesture restores when returning from a Customer opened from the results.
- The customer choice inside New sale.
- Any new or changed text.
- `segmentPlace`, `data-place="segment"`, its return tests, and the Mobile check states for segments outside search (#942).
- The summary card, the bar, buckets and any backend change.

## Decisions

- A query of only spaces counts as no query, so nothing collapses.
  - Reason: success criterion 1 ties the collapse to actually searching, and spaces search for nothing.
- A failed search shows the existing load-failure message in the flat list, never the no-match line or the previous rows.
  - Reason: the app does not know that nobody matches, and no new text is allowed.
- Returning from a Customer opened from the results keeps today's behaviour; this part does not start keeping or dropping the query.
  - Reason: the request covers only typing, no match and clearing. Changing the back gesture is scope that was not asked for.
- After clearing, the held segment is shown even when it is now empty, and the screen never jumps to "All".
  - Reason: success criterion 4 is "back where they were". Moving the seller somewhere they did not choose breaks it.
- Clearing returns to the held segment at once, removing the flat moment that used to show the previous answer.
  - Reason: the collapse follows the typed `query`, so its reverse does too, and the old answer is never shown as current.
- "All" just after a clear never shows the previous query's matches as the full list; while pending, it shows the existing loading treatment.
  - Reason: success criterion 2, never the previous answer as the answer, with no new text.

## Risks

- If `listCustomers` is keyed by the debounced query, "All" right after a clear could briefly show filtered rows. The handling must not add text.
- "Searching…" or the no-match line may be e2e landmarks. Moving them requires migrating every e2e use in the same diff (D-69509906).
- None of these states (Searching, no match, failed search, cleared, return) was compared with an approved drawing. If one departs from a drawing, the owner decides.

## Screens

The screens come from the design stage.

## Slices

### customers-search-states

#### Acceptance criteria

- Typing a query that is not only spaces collapses Customers to the flat list at once; a spaces-only query does not.
- A pending answer shows only "Searching…" under `aria-busy`, never the previous rows.
- No match shows only the existing no-match line, never while pending. A failed search shows the existing load-failure message, never the no-match line.
- A debtor in the result keeps the debtor row, typed from `standing`.
- Clearing returns at once to the held segment, even if empty, never jumping to "All". "All" after clearing never shows the old matches as the full list.
- A fresh mount opens on "Owed to you".
- The listed Testing Library and `CustomerSearch.test.ts` tests pass.
- The four Mobile check states and the updated `ClientesBusqueda` held phase are in, with zero offender entries.
- No new text, and the nine invariants hold.

#### Risks

- stale-all-after-clear
- e2e-landmark-migration
- unverified-drawing