---
status: accepted
date: 2026-10-17
---

# The customer's channel is dropped for good

GH-46. Nothing in the app uses the customer's channel (where the seller talks to them), and
the redesigned Clientes, the card and the customer form no longer ask for it. The field goes
from the domain, the API, the forms and the database (customers.md, "Customer channel
removed").

## Decision

1. **The drop is irreversible.** Migration 0018 (`down_revision` "0017") is a native
   `op.drop_column("customer", "channel")`: no `batch_alter_table`, no table recreate, so no
   other column, row, constraint or foreign key is touched. The stored values are gone, and
   no copy is kept anywhere. The export business removal writes (ADR-0015) follows the schema,
   so new exports carry no channel either; older exports keep what they held and nothing
   imports them back.
2. **The assumption.** No seller needs the old values back. Anyone who needs to reach a
   customer finds them by name or number. This is the product's assumption, not a measurement:
   nothing in the app ever read the field.
3. **The downgrade re-adds an empty column.** `downgrade()` adds `channel` as a nullable
   `String(16)` and restores no data. A rollback past 0018 therefore runs with every channel
   NULL, and the code of that older release reads it as "no channel".
4. **What is proven.** A migration test (`tests/migrations/test_0018_drop_customer_channel.py`)
   runs the real `upgrade_to_head` from 0017 over a plain `sqlite:///` file and a
   `sqlite+libsql:///` file (ADR-0016): the column is gone, and every other customer column,
   sale, line and payment row and every balance is unchanged. The proof does not cover Turso
   remote, where a native `DROP COLUMN` is unproven; run the migration against a copy first.
5. **A guard keeps the word out.** `tests/architecture/test_no_customer_channel.py` fails if a
   file under `app/customers/**` mentions `channel`. Requests that still send a channel are
   accepted and the field is ignored (decided with the API change, not here).

## Consequences

- Between the API change and this migration, the column stays in the table and mapped, read and
  written by nothing. This migration removes the mapping and the column in one diff, so the
  models and the migrations never disagree.
- A mistake in the assumption cannot be repaired from inside the product; only a backup taken
  before the migration holds the values.
