---
status: accepted
date: 2026-10-07
---

# The Onboarding stores only its passes and its end; done-ness is derived, steps write through their owners, and its API is `/onboarding-progress`

GH-86 adds the Onboarding (CONTEXT.md): a step-by-step setup for a brand-new business. It
is the product's first stored "passed" state for a business, so what it stores, and what
it never does, is fixed here.

## Decision

1. **The row marks who gets it.** `accept_invitation` opens a new business through
   `CompositeOpening`; `OnboardingOpening` joins it and inserts the business's `onboarding`
   row in the same transaction. A business with no row is never offered the Onboarding: a
   business that existed before it shipped, and a business a user joined. There is no
   backfill (migration `0013`), and `accept_invitation` is the only creator of a business.
2. **Required steps are derived and never latched; `progress()` is total.** A variety
   priced today and a stock entry are read from their owners on every read. The table
   stores only the four optional steps' passes (`done` or `skipped`, so "Listo" can tell
   "Hecho" from "Para después") and `ended_at`. `progress()` answers for every state,
   including `finish` (nothing left to pass while `ended_at` is null), and `resume` is null
   only once `ended_at` is set.
3. **`ended_at` is set only by `advance` or by the import, only while null, and never
   cleared or moved.** `advance`, and the pass and skip-rest writes that call it, re-read
   both required facts in the same transaction before they set it. The import sets it
   through the same `Onboarding.end`.
4. **Steps write through their owners.** Every step saves through its owner's existing
   route and shows its refusal codes; the Onboarding restates no rule. Its targets (the
   variety to price, the variety to stock) come from the `/onboarding-progress` answer,
   never computed by the front.
5. **The import ends the Onboarding through a port it declares** (`OnboardingEnding`),
   implemented in `app/onboarding/adapters/` and wired in `app/main.py`. It writes under
   the import's `NoCommit`, inside its single commit, and never commits. The Onboarding's
   row is not a record for the import's eligibility check.
6. **The front owns the `onboarding` segment; the API takes `onboarding-progress`**, as
   ADR-0019 did with `reset` and `reset-links`. ADR-0024 and ADR-0030 are untouched.
7. **"Listo" is drawn only from a write that answered `over: true`.** A render or a mount
   never writes; a reload of "Listo" goes to Inicio.

## Consequences

- The table is `onboarding`, `business_id` not null and unique, in `LABEL_AS_BUSINESS`: it
  is exported, deleted and counted by business removal, and no `has_records()` reads it.
- A required fact can change between an owner's write and the ending check, which are
  separate transactions. The result is recoverable: the Onboarding lands in `finish`, and
  `advance` ends it from Inicio's notice.
- Cost of a read is about four statements, O(varieties + entries) of one business.

## Amendment (GH-143): `priced_target`, and step 1's targets in Variedades' name order

- **A third target, `priced_target`**, is the first variety priced today. Step 1's "Hecho"
  view draws it when no variety is left without a price. Like the other two it is a
  variety's id and name only.
- **Both step-1 targets follow Variedades' name order**, as the `VarietyFacts` port gives
  it: the port's contract is the listed varieties in that order, and `progress()` keeps it
  and never sorts by name. `price_target` stops being the lowest id.
- **`stock_target` keeps the lowest-id rule.** The difference is known and accepted: it can
  only show for varieties made outside the Onboarding, whose ids and names disagree.
- **The answer still carries no amount.** The "Hecho" view reads today's list price from
  the owner's `GET /varieties/{id}`.
- **"Agregar otra variedad" reaches step 1 through a data-free history flag**
  (`anotherVariety: true`), cleared by replacing the entry once `POST /varieties`
  succeeds. No name, amount or id goes to history state.
