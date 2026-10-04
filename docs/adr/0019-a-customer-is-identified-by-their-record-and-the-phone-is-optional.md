---
status: accepted
date: 2026-10-04
---

# A customer is identified by their record; the phone number is optional, unique only among customers who have one

Zeta's real sheet has no phone numbers, and the spreadsheet import (docs/adr/0018)
refused every customer missing from the name → phone mapping. Customers
(docs/product/customers.md) made the phone required and called it what identifies a
customer within a business. PM's PRD (GH-54) settles that a customer is identified by
their own record (their id) and the phone is optional contact data; a new unique key is
out of scope.

## Decision

- **`customer.phone` becomes nullable** in migration 0010, revising 0009, with
  `op.batch_alter_table("customer", recreate="always")` — the first table rebuild in the
  chain. The constraint keeps its name, `uq_customer_business_phone`; no partial index
  is added, because SQLite's UNIQUE already treats NULLs as distinct. Its test stops at
  0009 with the existing `_upgrade_to` helper, seeds two businesses' customers with
  sales, on-the-spot and later payments, then finishes through the real
  `upgrade_to_head` (so the runner's pragma handling and `foreign_key_check` are what
  is proven), over both a `sqlite:///` and a `sqlite+libsql:///` file. Downgrade is the
  reverse batch and fails loudly on any NULL phone.
- **Blank means none, decided in one place.** `PhoneNumber.optional(raw: str | None)
  -> PhoneNumber | None` in customers' domain answers `None` for a missing value or one
  blank after trimming, and otherwise calls `PhoneNumber.of`. Register, edit and the
  import port call only it; `phone_taken` runs only for a non-`None` result.
  `Customer.phone: PhoneNumber | None`. No schema, router, import code or front code
  tests a phone for emptiness; the front sends `''` for a cleared field and the domain
  decides. `''` is never stored.
- **`PATCH` may clear the phone**: `CustomerPatchIn` stops passing `phone` through
  `_required`; `RequiredFieldCleared`'s literal drops `"phone"`, its code unchanged.
  `CustomerChanges.phone` is `str | None | Unchanged`.
- **Search**: `Customer.matches` never matches a customer without a phone through the
  number branch, nor any customer through a query with no digits.
- **The import identifies a planned customer by a tagged identity**,
  `ByPhone(phone_key) | ByName(collapsed_name)`, never by an untagged string. Customers'
  import port answers `check_customer(name, phone: str | None) -> CustomerKey |
  CustomerRefusals(name_code, phone_code)`, running each rule on its own so both are
  reported in one dry run; the import files each by the field it comes in, never by
  reading a code string. The mapping is an optional `--mapping PATH` flag (ADR-0018's
  amendment).

## Consequences

- Once a customer without a phone is stored, the column can't go back to `NOT NULL`
  without inventing numbers; a new unique key for customers is a later decision.
- A deploy rolled back to code from before 0010 crashes on any customer read once a
  customer without a phone exists (`PhoneNumber(None)`); rolling back past this
  change means restoring data, not redeploying.
- Whether Turso's remote protocol honours `PRAGMA foreign_keys=OFF` on the raw
  connection is proven only locally through the libSQL driver. If it doesn't, `DROP
  TABLE customer` fails on its referencing rows, the single migration transaction rolls
  back and the deploy fails; sales are never orphaned.

## Considered and rejected

- **Storing `''` for no number**: two customers without a number would collide on the
  unique constraint.
- **A partial unique index `WHERE phone IS NOT NULL`**: SQLite's UNIQUE already gives
  that, and a renamed constraint would churn the schema test for nothing.
- **Keying import customers by phone or name as a plain string**: two kinds of key in
  one dictionary.
- **Filing an import refusal by its code's prefix**: one code rename silently moves a
  problem to the wrong row.
