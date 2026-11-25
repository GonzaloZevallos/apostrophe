---
status: draft
---
## Goal

Add the schema foundation for a Payment that keeps who recorded it (GH-1057), for Businesses where more than one User records Payments. A Payment gets two optional fields: the recorder's initials, and a link to the User who recorded it. Nothing writes to them yet, and nothing changes on screen or in the API. The only observable change is two null keys per Payment in the Business export. This is part 1 of 3 of GH-1106.

## Acceptance criteria

- `PaymentRow` has `recorded_by_initials` (`String(32)`, nullable) and `recorded_by_app_user_id` (nullable foreign key to `app_user.id`, ON DELETE SET NULL, indexed). It uses no `name=` arguments and no composite foreign key.
- Migration `0035_payment_recorder` (or the next free number), with `down_revision` 0034, rebuilds `payment` the way `0033_payment_payment_method_id` does:
  - every name is spelled through `op.f`;
  - the existing columns keep their order and the two new columns go last;
  - it raises `RebuildLostRows` when the copied row counts differ;
  - it raises `RebuildLeftBrokenReferences`, whose message names only the revision, when `PRAGMA foreign_key_check` finds anything;
  - foreign keys are off during the swap and restored in `finally`.
- After the upgrade, `ix_payment_sale_id`, `ix_payment_payment_method_id_business_id` and `ix_payment_recorded_by_app_user_id` exist.
- The migration's docstring says that no table points at `payment` at 0034.
- With one later Payment and one on-the-spot Payment seeded at 0034, both rows are identical after the upgrade and both new columns are NULL. The reflected old columns, indexes and foreign keys (names and ondelete) are unchanged, and no foreign key targets `payment`.
- With foreign keys on, deleting the `app_user` linked to a Payment sets the link to NULL, keeps the initials and keeps the Payment.
- The downgrade is refused while either new column is set on any row, and it succeeds when neither is set.
- A Business removal's `delete_order` puts `payment` before `app_user`.
- In the Business export:
  - a Payment with both columns set writes `recorded_by_app_user_id` as `{id, name: <user email>}` and the initials as stored;
  - a Payment with neither set writes both as `None`.
- A Business removal's exported counts equal its deleted counts, and `secret_columns` and `other_type_columns` stay empty.
- No API response and no screen changes.
- `test_naming` and `test_business_ownership` stay green.
- The branch is rebased onto master with a single Alembic head.

## Out of scope

- Capturing the recorder when a Payment is recorded.
- Showing the recorder on any screen or in any API response.
- Backfilling or guessing the recorder of existing Payments.
- A free-text field on Payments.
- Roles or permissions within a Business.
- A new glossary term or ADR.

## Decisions

- Payments recorded before this change keep both fields null for good. "No recorder" is a normal state, not an error.
  - Reason: no record says who made an old Payment, and a guess would put a false fact into a Customer's books.
- The rule that the recorder belongs to the Payment's own Business is not enforced in the schema in this part. It binds the later parts of GH-1057 that write the link.
  - Reason: the request fixes a plain foreign key with no composite key, and this part writes nothing.
- The export writes the User link as `{id, name}`, with the User's email as the name, and writes the initials as stored.
  - Reason: this is the format the Business export already uses for references, so it is not a new decision.

## Risks

- The `payment` table is rebuilt. A lost or orphaned row would corrupt Customer balances. The row-count check and the foreign-key check guard against this.
- The link could later point at a User of another Business. This part writes nothing, so the risk moves to the later parts of GH-1057 that write the link.
- Another migration could take 0035 on master first. The rebase and the single-head check catch this.

## Screens

none

## Slices

### payment-recorder-columns

#### Acceptance criteria

- `PaymentRow` and migration `0035_payment_recorder` add the two nullable recorder columns, rebuilding `payment` with row-count and reference checks, the three indexes and SET NULL on the User link.
- Existing Payments are unchanged after the upgrade, with the new columns NULL.
- Deleting the linked User clears the link and keeps the initials and the Payment.
- The downgrade is refused while either column is set, and it succeeds when neither is set.
- The Business export writes both keys, as `{id, name}` and as stored, or as null.
- A removal deletes `payment` before `app_user`, and its exported counts equal its deleted counts.
- `test_naming` and `test_business_ownership` stay green, and there is a single Alembic head.

#### Risks

- payment-table-rebuild-row-loss
- cross-business-recorder-link-in-later-parts
- alembic-revision-collision