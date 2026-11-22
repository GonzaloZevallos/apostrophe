---
status: draft
---
## Goal

When the owed figures on Customers (`GET /api/payments/debtors`) fail to load, the seller sees a notice saying so above the plain customer list, and can retry with one tap without leaving the screen. The seller is the owner of a small business, working on the phone. This stops them reading the plain list as "nobody owes me" and gets them the real figures in place. It is part 3 of GH-831.

## Acceptance criteria

- When the debtors read is `failed` and no query is typed, `Clientes.tsx` renders `web/src/screens/clientes/DebtorsUnavailable.tsx` above the flat customer list.
- The notice is a Tappable notice card with the Attention icon and no chevron. It reads "Owed amounts did not load: tap to try again", with no final period. That sentence is its accessible name, and the notice is at least 44 px high.
- While a query is typed, the notice is absent.
- While the debtors read is failed, no segment control, count, Total owed, bar, card or "Nobody owes you" is shown.
- A tap calls `refetch()` on the debtors query only. No request is sent for the customer list.
- While the retry is in flight:
  - the notice and the flat list stay on screen, with no skeleton;
  - the notice carries `aria-busy="true"` and `aria-disabled="true"` with the existing disabled treatment, and adds no new words, icon or spinner;
  - a second tap sends no request.
- A retry that fails returns the notice to its normal look, and it can be tapped again.
- A retry that succeeds shows the segments and counts, with "Owed to you" chosen.
- `debtorsState` returns `failed` when the latest debtors read failed, even with earlier data cached. A failed refresh after figures were shown therefore shows the flat list with the notice and no stale figure.
- With no Customers and a failed debtors read, the notice is shown above the list's own empty state, and "Nobody owes you" is not.
- The sentence is announced politely when the notice appears and again after a failed retry. Focus does not move, and a plain re-render does not re-announce it.
- `CustomersBehind` never renders the notice.
- The sentence is one Copy module key, registered in `LIMITED_COPY`. `en.baseline.json` is regenerated, and `en-XA` too where the module has a language JSON.
- A new WalkState stubs `/api/payments/debtors` with status 500 only (the `reads` shape of `statesGettingIn.ts:66`), with its `scripts/design/screens.json` row, and adds zero offender entries.
- Testing Library tests with faked fetch cover:
  - the failed state;
  - the retry refetching only `/payments/debtors`, and success;
  - the typed query;
  - the in-flight double tap;
  - a repeated failure;
  - a failed refresh after figures were shown;
  - no Customers;
  - the polite announcement;
  - the `debtorsState` unit case.
- The task's nine invariants hold, and `docs/api/**` and `docs/architecture/**` are not edited.

## Out of scope

- Any change to the customer list read, `owedPlace()`, `OWED_PLACE` or the segments themselves.
- A fallback to Home's "Owed to you" block, a new endpoint or any API change.
- New copy, a new icon name or a spinner for the busy state.
- Retrying on its own, on reconnect or on window focus.
- The Mobile check states owned by #942, and the summary card, bar and buckets of later GH-831 parts.

## Decisions

- The busy look during a retry is the existing disabled treatment of a tappable surface plus `aria-busy` and `aria-disabled`, keeping the card, icon and sentence unchanged.
  - Reason: no drawing covers this state, so the written definition governs (Drawing as guide). Phone first ships the working flow before polish, and the interview ruled out new words.
- The notice has no chevron.
  - Reason: in the Icon and text rule a chevron marks that a Tappable notice opens something, and this one retries in place.
- `debtorsState` treats cached data with a failed latest read as `failed`, not `ready`.
  - Reason: the interview decided that a failed refresh after a Payment must never leave stale figures on screen.
- A successful retry sets the chosen view to "Owed to you", even if "All" was chosen before.
  - Reason: the request says the segments return on "Owed to you", and that is the view for acting on debts.
- The notice is not drawn behind the new-customer form (`CustomersBehind`).
  - Reason: that surface is inert, and a tap target there would do nothing.

## Risks

Changing `debtorsState` for cached data plus an error also affects `CustomersBehind` and the return-to-place fallback. Both must still show the flat list and fall back to the search field.
A live region that is on the tappable element itself may re-announce on every re-render. The announcement may need a separate polite status region.
If the copy key goes in `customers.ts`, which has no language JSON yet (#351), `en-XA` has nothing to regenerate. Saying otherwise in the PR would be wrong.

## Screens

The screens for this task come from the design stage.

## Slices

### debtors-unavailable-notice

#### Acceptance criteria

- With a failed debtors read and no typed query, Customers shows the notice "Owed amounts did not load: tap to try again" with the Attention icon above the flat list, and no segments, counts, Total owed, bar, card or "Nobody owes you".
- A tap refetches only `/payments/debtors`. While it runs the notice is `aria-busy` and ignores taps. On failure the notice stays and can be tapped again; on success the segments and counts appear with "Owed to you" chosen.
- A failed refresh after figures were shown, and a Business with no Customers, both show the notice and never a stale or zero figure.
- The sentence is announced politely on appearance and after a failed retry, without moving focus.
- The copy key, the regenerated baselines and the 500-only WalkState with its `screens.json` row are added, with zero offender entries.

#### Risks

- debtors-state-change-reaches-behind-and-return-place
- live-region-reannounce
