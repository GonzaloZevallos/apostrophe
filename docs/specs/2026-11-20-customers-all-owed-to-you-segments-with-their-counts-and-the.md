---
status: draft
---
## Goal

Customers gets two views on the phone and on the computer: 'All · N' and 'Owed to you · N'. Both counts come straight from `GET /api/payments/debtors`. 'Owed to you' gets its own "Nobody owes you" state.

It is for the small-business owner who opens Customers on the phone with little time. They see at once whether anyone owes them and how many, and can switch to everyone they sell to with one tap. This is part 1 of 4 of GH-831 and changes only the front end.

## Acceptance criteria

- `Debtors` in `web/src/api/payments.ts` has required `customer_count`, `debtor_count` and `buckets` (`this_week`, `days_8_30`, `over_30`).
- `web/src/api/fixtures/debtors.json` has a non-zero amount in each bucket, and every test that builds a `Debtors` by hand spreads it.
- `web/src/api/panel.ts` is unchanged.
- `CUSTOMER_SEGMENTS` (all, owed) is declared with a non-empty reason in `web/src/components/fixedSets.ts`. `CustomerSegments.tsx` reads its options only from it.
- The control shows 'All · N' with `customer_count` and 'Owed to you · N' with `debtor_count`, as the API sends them.
- The group's accessible name is "Customers view" and the selected option is marked.
- Each option is at least 44 px high, with `user-select: none` and `touch-action: manipulation`.
- Customers always opens on 'Owed to you', including when `debtor_count` is 0.
- The selected view lives in the `/clientes` layout context beside the query, defaults to 'owed', and is never stored on the device, in the URL or on the server.
- One tap on 'All' switches to the full list.
- 'Owed to you' shows the existing Total owed and the debtor rows in API order, with no "N sales owing" line. Its list container has `tabIndex=-1` and `data-place={OWED_PLACE}`.
- With `debtor_count` 0, 'Owed to you' shows only the existing `EMPTY_STATE_KEYS.nobodyOwes` line, with `tabIndex=-1` and `data-place={OWED_PLACE}`, and no Total owed and no rows.
- 'All' shows every Customer by name with today's rows: debtor row with its Since line, "Credit" for credit, plain row otherwise. It has no Total owed.
- The "Everyone" section and its copy key are removed.
- While the debtors read is pending, the labels show with no count and no "·". No digit, no Total owed and no "Nobody owes you" appears.
- With a typed query, or after a failed debtors read, only the flat customer list shows, with no segments and no counts.
- Clearing a query returns to the view chosen before typing.
- Row type comes only from `standing` and `owing_since`. No file under `web/src/screens/clientes/` compares `balance` or any money value.
- `segmentPlace` returns `owedPlace(root)`, else the selected option, else the search input.
- `ready` waits for the debtors read not to be fetching.
- `useReturnToPlace.ts`, `owedPlace()` and `OWED_PLACE` are unchanged. Home's and the card's return tests pass unchanged.
- Return to place works from 'Owed to you', from 'All' and with a query typed.
- New copy keys are in `web/src/copy/customers.ts`, and `en-XA` and `en.baseline.json` are regenerated.
- Every e2e use of "Everyone" and of the Customers "N sales owing" line is migrated, with no element restored (D-69509906). The specs are `customers`, `clientesCobrar`, `cobroHoja`, `payments` and `panel`.
- WalkStates and rows in `scripts/design/screens.json` exist for: 'Owed to you' selected, 'All' selected, nobody owing, and debtors loading.
- `ClientesBusqueda` still types "Nico" with "Nico Parra" visible. No offender entry is added.
- No TypeScript divides, sums, rounds, compares or converts to a percentage a count, a bucket or a money amount.
- No hex colour is added in a component, and every state-colour selector has its `colorCensus.ts` entry.
- `docs/api/**` and `docs/architecture/**` are not edited.

## Out of scope

- The summary card that replaces the Total owed, and rendering the buckets. These are later parts of GH-831.
- Any backend or API change.
- Remembering the chosen view between visits, or opening on a different view depending on the data.
- Changing what a Customer row means or how it looks.
- Changing Home's "Owed to you" block or its sales-owing line.

## Decisions

- Customers always opens on 'Owed to you', even when nobody owes.
  - Reason: "Nobody owes you" answers the seller's first question, and a screen whose opening view depends on the data is harder to predict on a phone used in a hurry.
- The chosen view lasts only while the seller is inside Customers, and resets on leaving the tab.
  - Reason: the main situation is chasing money, and a remembered 'All' would hide debts on the next visit.
- Clearing a search returns to the view the seller had before typing.
  - Reason: the search is a detour and must not reset the seller's choice.
- 'All' has no Total owed, and 'Owed to you' drops the "N sales owing" line on Customers only.
  - Reason: the money figure belongs with the people who owe it, and the 'Owed to you · N' count already answers "how many".
- A failed debtors read shows the flat list of all Customers with no segments.
  - Reason: Customers must never become a dead end because a count failed.

## Risks

- The e2e migration spans five specs and shared helpers. A missed locator turns the Gate red.
- Return-to-place can land on the search input if `ready` does not wait for the debtors fetch.
- The drawings `Clientes.dc.html` and `ClientesOscuro.dc.html` were not checked during the definition. A visible difference the owner would read or act on differently goes back to the owner.

## Screens

The screens come from the design stage.

## Slices

### customer-segments

#### Acceptance criteria

- Customers shows 'All · N' and 'Owed to you · N' from the debtors read, opens on 'Owed to you', and switches with one tap.
- With nobody owing it shows only "Nobody owes you". While the read is pending it shows no digit and no "Nobody owes you". After a failed read, or with a query typed, it shows the flat list without segments.
- Clearing a query returns to the previous view, and return to place works from 'Owed to you', from 'All' and from a search.
- The "Everyone" section is gone, every e2e use of it and of the Customers "N sales owing" line is migrated, and the new Mobile check states pass with no offender entries.

#### Risks

- e2e-landmark-migration
- return-to-place-timing
- drawing-unverified