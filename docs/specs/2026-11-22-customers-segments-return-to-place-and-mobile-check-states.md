---
status: draft
---
## Goal

A seller collecting from one debtor after another, or looking for one customer, leaves Customers to open a customer's card or Record payment. When they come back, Customers is exactly as they left it: the same segment ("Owed to you" or "All"), the same search text and the same place in the list. They carry on without picking the segment again or retyping the search. The Mobile check also walks the four segment states of Customers (#934) in light and dark.

## Acceptance criteria

- `owedOrSearch` is replaced by `segmentPlace`. On return, focus goes to the first of these that is on screen: `owedPlace(root)` (the "Owed to you" list or "Nobody owes you"), then the selected segment option, then the search input.
- Customers' return is `ready` only when the customers list has loaded and the debtors read is not fetching. Until then the existing loading state shows. After that the list appears in the right segment, search and place, with no jump afterwards.
- A vitest test leaves Customers from "Owed to you" and comes back with "Owed to you" still selected and focus on its list or "Nobody owes you".
- A vitest test leaves Customers with "All" selected and comes back with "All" still selected and focus on the "All" option.
- A vitest test leaves Customers with a query typed and comes back with the same query in the search input and focus on it.
- A test shows the return is not applied while the debtors read is being fetched again.
- Home's and the customer card's existing return tests pass with no assertion changed.
- `web/src/hooks/useReturnToPlace.ts` (or wherever `useReturnToPlace.ts` lives), `owedPlace()` and `OWED_PLACE` are unchanged.
- After collecting a debtor's whole balance, the seller stays on "Owed to you": they never jump to the top, and the app never switches the segment.
- `web/src/mobile-standard/statesRecords.ts` has four new Customers WalkStates, each with a row in `scripts/design/screens.json`:
  - 'Owed to you' selected;
  - 'All' selected;
  - nobody owing, a debtors stub with `debtor_count` 0;
  - debtors loading, with the read held.
- The four states pass the Mobile check in light and dark, with 0 new entries on any offender list.
- `ClientesBusqueda` still fills 'Nico' with 'Nico Parra' visible, and passes.
- The PR attaches a by-eye comparison of the four states against `Clientes.dc.html` and `ClientesOscuro.dc.html`. Any difference that would change what the owner reads or does is raised to the owner.
- No user-facing text is added or changed.

## Out of scope

- Remembering Customers' segment, search or place across tab switches, app close or reload. Tapping Customers from another tab starts fresh on "Owed to you".
- Any change to `useReturnToPlace.ts`, `owedPlace()`, `OWED_PLACE`, or Home's and the card's return.
- Redefining how the segment control, "Nobody owes you" or the loading state look, or how a search combines with a segment (#934).
- New copy, new offender entries, backend changes, and later parts of GH-831 (summary card, buckets).

## Decisions

- Focus on return follows a fixed order: the "Owed to you" list or "Nobody owes you", then the selected segment option, then the search input. The position within the list stays with the existing return-to-place behaviour.
  - Reason: the request names this order and keeps `useReturnToPlace.ts` unchanged, so the only new thing remembered is the segment.
- Only a return from the customer's card or Record payment restores the place. Switching tabs or reloading starts fresh.
  - Reason: this serves the job (a run of collections) without adding remembered state the seller never asked for.
- When the last debtor is paid, the seller stays on "Owed to you" and sees "Nobody owes you". The segment is never switched for them.
  - Reason: the owner decided the app never changes the seller's choice.
- How the selected option is located (a `data-place` mark or the selected radio) is left to the Tech Lead. No element is added, visible or hidden, just to satisfy a locator.
  - Reason: the request doesn't fix it, and D-69509906 forbids putting elements back for locators.

## Risks

Waiting for the debtors read to stop fetching could hold `ready` back if a refetch never settles. Tests must resolve their stubs.
The by-eye comparison may surface a difference from the drawings that needs the owner's decision before merge.

## Screens

The screens come from the design stage. This task adds no new screen. It walks the existing Customers states (#934) and compares them against `Clientes.dc.html` and `ClientesOscuro.dc.html`.

## Slices

### customers-return-to-place-and-states

#### Acceptance criteria

- `segmentPlace` replaces `owedOrSearch`, in this order: `owedPlace(root)`, then the selected segment option, then the search input.
- `ready` also waits for the debtors read not to be fetching.
- Three return tests pass: from "Owed to you", from "All", and with a query typed. Home's and the card's return tests pass unchanged.
- Four Customers WalkStates ('Owed to you' selected, 'All' selected, nobody owing with `debtor_count` 0, debtors loading held) are in `statesRecords.ts` and `screens.json`. They pass in light and dark with 0 new offender entries.
- `ClientesBusqueda` still passes with 'Nico' filled and 'Nico Parra' visible.

#### Risks

- refetch-holds-ready
- drawing-difference-needs-owner
