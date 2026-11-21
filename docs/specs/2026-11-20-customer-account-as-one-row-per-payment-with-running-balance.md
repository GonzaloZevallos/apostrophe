---
status: draft
---
## Goal

A seller opens a Customer's card on the phone when a customer asks what they owe, says they already paid, or is about to be collected from. This task turns the card's account into a ledger: one list of Sales and Payments, with the balance after each row. The seller can then answer, and show the customer, how the number came about without counting it themselves.

The account API (`GET /api/customers/{id}/account`) and its only consumer, the Customer card, change together:
- each later Payment becomes one row;
- each Sale row carries its Sale number;
- each Payment row carries a partial mark, computed by the server;
- the separate credit row kind and `applied_to` on account rows go away.

## Acceptance criteria

- **Order.** Account rows are ordered by date, then recorded_at, then Sale before Payment, then id. Only `account_of()` builds them.
- **The balance ties out.** The newest row's running balance equals `settle().balance` in each of these cases: a same-day Payment recorded before a Sale; one recorded after; a Payment dated before its Sale; a date and recorded_at tie (Sale first, no negative row); a Credit after a deleted Sale; a Sale without a customer assigned one later via PUT /api/sales/{id}/customer, which keeps its place.
- **Payment rows.** Each later Payment is exactly one row titled "Payment · <method>", with its full amount and no sub-line, and exactly one "Delete payment" action.
- **Sale rows.** A Sale row is titled "Sale #N" and keeps its "Paid · <method>", "Left owing" or "Nothing to pay" sub-line. A Sale paid on the spot leaves the running balance unchanged.
- **Balance on every row.** Every row keeps showing "balance $ X" after it, in Tabular figures.
- **In your favor.** A row whose running balance is below zero reads "In your favor $ X" in the credit tone, never as a negative debt.
- **Partial mark.** `is_partial` on a Payment row is true only when the running balance after it is above 0, and false at exactly 0 and below. The card does not show it, and no Partial payment copy key exists.
- **API shape.** Payment rows have no `applied_to`, and the credit row kind no longer exists. `AppliedToOut`, `Split` and the record and preview responses are unchanged, and their tests stay green.
- **Server only.** No browser code computes a running balance or a partial mark.
- **Isolation.** The account of another business's Customer returns 404.
- **Domain tests.** A fixed-seed property test over shuffled ledgers asserts that the last running balance equals the Balance, and that `is_partial == (running_balance > 0)`.
- **OpenAPI.** The snapshot is regenerated.
- **PR body.** It carries "Breaking-API: GET /api/customers/{id}/account drops applied_to from payment rows and the credit row kind".
- **e2e.** `payments.spec.ts` asserts "Payment · Cash" with its full amount and balance and no sub-line, and the "In your favor" counts. No element is kept only for a locator (D-69509906).
- **Copy.** `creditAmount` reads `In your favor ${running_balance}`. `onAccountOf` is gone from the account copy. The header "Credit" label stays.
- **Design capture.** The ClienteFicha Design capture is attached to the PR.

## Out of scope

- Showing the partial mark on the card.
- Any change to Record payment or its preview, which keep "On account of the sale of dd/mm".
- Any change to the Settlement rule, Balance, Owing since or standing.
- The header Credit label and the Customers list.
- WalkState and screens.json.
- docs/api/** and docs/architecture/**.

## Decisions

- Every row keeps showing the balance after it, Sale rows included. This is current behaviour, not a new choice, so it is not a possible departure.
  - Reason: the card already shows "balance $ X" on every row, and the ledger reading needs the balance to be seen going up as well as down.
- A Sale row is titled "Sale #N" and keeps its sub-lines.
  - Reason: in the interview the PM decided that a Sale row shows its Sale number, and the request adds `number` to Sale rows without saying how it reaches the screen.
- A Payment dated before its Sale gives a negative running row that reads "In your favor", and the Sale row after it brings the balance back.
  - Reason: it is the honest ledger reading at that date, and the request asks for "a negative row, not partial".
- The card shows no trace of which Sales a Payment covered.
  - Reason: the card is a ledger, and Record payment and its preview are where the seller decides what a Payment covers.
- `is_partial` ships in the API only in this part.
  - Reason: the request adds no Partial payment copy key and no sub-line, and a later part shows it as a word with its own drawing check.

## Risks

- public-api-break: the account response changes shape. Its only consumer, the Customer card, changes in the same part.
- money-rounding: the running balance and the Balance must agree to the peso on every row.
- Deleting `onAccountOf` could break Record payment if Cobro.tsx reads that key. Check before deleting.
- The ClienteFicha drawing may differ from the "In your favor" row or the "Sale #N" title. Any difference goes to the owner as a departure.

## Screens

The screens come from the design stage.

## Slices

### customer-account-ledger

#### Acceptance criteria

- `account_of()` returns rows in (date, recorded_at, Sale before Payment, id) order, and the newest row's running balance equals `settle().balance` in every case of the matrix and of the property test.
- Each later Payment is one row, "Payment · <method>", with its full amount, no sub-line and one delete action. A row below zero reads "In your favor $ X" in the credit tone.
- Sale rows show "Sale #N". `is_partial` comes only from the server and is not shown on the card.
- The account response has no `applied_to` and no credit row kind. The record and preview responses are unchanged, and another business's account returns 404.
- The domain, API, front and e2e tests named in the PRD pass. The OpenAPI snapshot is regenerated.

#### Risks

- public-api-break
- money-rounding