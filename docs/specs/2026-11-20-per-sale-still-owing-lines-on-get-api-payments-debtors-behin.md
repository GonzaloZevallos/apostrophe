---
status: draft
---
## Goal
Let `GET /api/payments/debtors` return each Debtor's Sales still owing on request. Each line gives the Sale number, the Sale's date and what remains on that Sale, oldest first.

This serves the seller who is about to collect from a Customer, or remind them. They can say exactly what the money covers and since when, without the browser redoing the Settlement. The lines are behind an optional `with_lines` flag, so existing callers are unchanged.

## Acceptance criteria
- `GET /api/payments/debtors` accepts an optional boolean `with_lines`, off by default.
- A value of `with_lines` that is not a boolean gets the same 422 validation response as any other invalid parameter.
- With `with_lines` absent or false, every Debtor carries `still_owing: null`, and the rest of the response is identical to before.
- With `with_lines=true`, every Debtor carries `still_owing` as a list of `{sale_number, date, remaining}`. There is one line per Sale still owing after Settlement, partly paid ones included, each once.
- `remaining` is what is still owed on that Sale, never its total. It is greater than 0 and goes out as a Decimal in currency units (ADR-0058).
- For every Debtor, the `remaining` values add up to its Balance exactly.
- Lines come in Settlement order: Sales by date, then by order of recording.
- The first line's `date` equals the Debtor's Owing since.
- A Customer with a Credit is not a Debtor and contributes no line. A Sale covered by a Credit is never a line.
- Debtors, their order, totals, counts and buckets are the same with the flag on and off.
- Business isolation holds when both `client` and `other_client` have debtors. Each Business's lines hold only its own Sales and Sale numbers, and nothing reveals the other Business.
- The lines are built from `SettleResult.sales` with `still_owed > 0`, in the same `settle()` pass. No router, schema or adapter walks Sales against Payments or reorders lines.
- `docs/product/payments.md` describes the flag and the lines in Spanish.

## Out of scope
- Any screen that shows the lines. Customers' "Owed to you" and Home's block do not send the flag in this part.
- A cap on lines per Debtor.
- Extra line fields such as the Sale total or its Note.
- A separate per-Customer endpoint for the lines.
- Glossary or ADR changes.

## Decisions
- `still_owing` is always present and is null when the flag is off.
  - Reason: existing callers keep the same shape. A null field is easier to read than one that sometimes appears and sometimes does not.
- A non-boolean `with_lines` gets the standard 422 validation response, with no rejection code of its own.
  - Reason: it is the same treatment as any other invalid query parameter, and it adds nothing to `contract.json`.
- There is no cap on lines per Debtor.
  - Reason: the lines must add up to the Balance. A cap would break that criterion.
- There are no extra fields on a line beyond `sale_number`, `date` and `remaining`.
  - Reason: the job only needs which Sale, since when and how much of it remains. The Sale detail has the rest.
- Existing debtor screens do not send the flag in this part.
  - Reason: this part only adds data. The screens that show it come in later parts.

## Risks
The lines could drift from the Balance or the Owing since if they were computed apart from `settle()`. Building them in the same pass avoids that.

The change is cut to stay under the 400 hand-written line cap, and it depends on #842 landing first.

## Screens
none

## Slices
### debtors-still-owing-lines
#### Acceptance criteria
- `with_lines` is optional and false by default. A non-boolean value gets 422.
- With the flag off, `still_owing` is null for every Debtor, and the response is otherwise unchanged.
- With the flag on, each Debtor's lines are `{sale_number, date, remaining}` in Settlement order. They add up to its Balance, and the first date equals its Owing since.
- Partly paid Sales appear once with what remains. Credits contribute no line.
- Isolation between two Businesses holds for the lines.
- `docs/product/payments.md` is updated in Spanish.
#### Risks
- lines-drift-from-settlement
- blocked-by-842
