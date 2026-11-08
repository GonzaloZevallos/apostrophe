---
status: accepted
date: 2026-11-08
---

# The login guard tables have a surrogate id and stay keyed by a unique column

Part 1 of the database naming work (#75, CODING_STANDARDS §11).

## Context

§11 gives every table an integer primary key named `id`. `login_guard` was keyed by `email` and `login_address_guard` by `address_digest`. They also carried `locked_until` and `window_start`, which break the `_at` rule, and `price_entry.effective_from` broke the `_on` rule.

## Decision

- Both guard tables get a surrogate `id` primary key (`pk_login_guard`, `pk_login_address_guard`). The ids carry no meaning and no order, and nothing reads them.
- They stay keyed by `email` / `address_digest` through a unique constraint (`uq_login_guard_email`, `uq_login_address_guard_address_digest`). That constraint is the conflict target of the one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` every count is written with (ADR-0002). Guard rows are read with a select on that column, never by primary key.
- `locked_until` is `unlocks_at` in both tables, `window_start` is `window_started_at`, `price_entry.effective_from` is `effective_on`, and `uq_customer_business_phone` is `uq_customer_business_id_phone`. The domain, ports, schemas and the API keep their names; only the table classes and their repository adapters know the stored names.
- Migration 0024 rebuilds the tables by copying every row, compares the row count before and after, and refuses with the table name only. Its downgrade restores the 0023 schema, names included.

## Consequences

- The Business export's `price_entry` records carry the key `effective_on` instead of `effective_from`. This is operator-visible. Nothing in the system reads an export back, and the removal's count lines name tables, not columns, so they do not change.
- `login_guard` still has no `business_id`; the removal deletes its rows by the emails of the removed users.
