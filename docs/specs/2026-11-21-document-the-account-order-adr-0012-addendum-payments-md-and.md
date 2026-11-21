---
status: draft
---
## Goal

Write down in the docs the Customer account that part 1 of GH-829 shipped, so the docs match it. This covers three places:

- an addendum to ADR-0012 that holds the account order and the running-balance rules;
- `docs/product/payments.md`, aligned with the shipped account;
- the colour census entry at `web/src/architecture/colorCensus.ts:154`.

It is for the agentic system and the people who maintain it. Later account work should not bring back the old key, the Payment split, or the "On account of the sale of dd/mm" and "Credit" sub-lines. Nothing a person sees changes.

## Acceptance criteria

- `docs/adr/0012-settlement-is-worked-out-on-read-and-the-balance-guard-is-one-statement.md` has a dated addendum titled "Account order and running balance (GH-829)". It states:
  - the key (date, recorded_at, Sale before Payment, id), with an equal recorded_at putting the Sale first;
  - the newest running balance equals `settle().balance`;
  - one full-amount row per Payment, with no split and no Credit row;
  - `is_partial` = running balance > 0, calculated and never stored;
  - recorded_at is set once: assigning a Customer does not change it, and a deleted and re-recorded Payment is a new Payment.
- Line 31 of ADR-0012 no longer states a key. It points to the addendum and keeps its reference to ADR-20261120.
- The addendum says the account order is a ledger order of its own (ADR-20261120). It also says the glossary's Settlement order (Sales, then Payments, each by date and then by order recorded) does not change and still decides which Sale a Payment pays.
- `docs/product/payments.md` describes:
  - the full-amount Payment row with no sub-line;
  - "In your favor" on a running balance below zero;
  - the "On account of the sale of dd/mm" and "Credit" sub-lines as removed from the account;
  - the ordering key and recorded_at being set once.
- In `payments.md`, criterion 5 and the account metrics are updated, including an account-matrix metric.
- In `web/src/architecture/colorCensus.ts`, the `.cuenta-cliente__saldo.monto-deuda` entry's `carries` reads `the word "balance" before the figure (below zero the row reads "In your favor")`. Its test stays `screens/clientes/ClienteFicha.test.tsx`.
- No file under `docs/api/**` or `docs/architecture/**` is changed. `CONTEXT.md` is not changed.
- `ClienteFicha.test.tsx` is not modified and passes. CI reports ci-ok.

## Out of scope

- Any change to behaviour, screens, the API, the Copy module or the architecture docs.
- Editing `CONTEXT.md`.
- Deciding again the account order, the Payment row or the "In your favor" wording.
- Reopening ADR-20261120 or the Settlement order.

## Decisions

- The addendum says the account order and the Settlement order are distinct, and that their difference is not a finding.
  - Reason: ADR-20261120 makes the account a ledger walk, not a Settlement view, so the account key can never read the same as the Settlement order. Requiring them to match would always raise a false finding.
- Line 31 of ADR-0012 keeps its existing reference to ADR-20261120 next to the new pointer to the addendum.
  - Reason: the ADR has already been taken and is applied, not reopened. Dropping the reference would hide the decision the addendum documents.
- If the code's sort order differs from the key in the request, it is raised as a finding and the docs are not bent to match the request.
  - Reason: this part only documents shipped behaviour, and the doc follows the app.

## Risks

- The addendum could be written as if it changed the Settlement order, and a later task would then "fix" `settle()` to match the account.
- The key in the request may not match the sort in `app/payments/domain/account.py`. It has to be checked against the code before the addendum is written.

## Screens

none

## Slices

### document-account-order

#### Acceptance criteria

- The ADR-0012 addendum "Account order and running balance (GH-829)" exists with the key, the tie rule, the `settle().balance` equality, one full-amount row per Payment with no Credit row, `is_partial` calculated and never stored, and recorded_at set once.
- Line 31 of ADR-0012 states no key and points to the addendum and to ADR-20261120.
- `docs/product/payments.md` matches the shipped account and the glossary (Settlement, Credit, Balance).
- The `colorCensus.ts` entry `.cuenta-cliente__saldo.monto-deuda` carries `the word "balance" before the figure (below zero the row reads "In your favor")`, and its test is still `ClienteFicha.test.tsx`.
- Nothing under `docs/api/**` or `docs/architecture/**` is edited, `ClienteFicha.test.tsx` is untouched and passes, and CI is ci-ok.

#### Risks

- addendum-blurs-settlement-order
- key-differs-from-code