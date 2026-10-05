---
status: accepted
date: 2026-10-04
---

# A reset link is a row only while it could still work, spent in one guarded statement; the brake has one sequence; removal withholds owned tables

Changing a password and resetting a forgotten one (docs/product/accounts.md, #26) add
the first secret a user holds outside their password: a reset link the operator prints.
It works once, within 24 hours, and a user has at most one live link. A Change must
count against both login brakes exactly as a login does. Business removal (ADR-0015)
must delete every reset link of the business and never export one. These are hard to
change once links exist in the database.

## Decision

- **`reset_link` is an owned table** (`id`, `business_id` not null, `user_id` not null
  with UNIQUE(user_id), `token_digest` unique, `created_at` as `UtcDateTime`). A row
  exists only while its link could still work: a use, a newer link or any password
  change deletes it. "Used" and "retired" are not columns; expiry
  (`RESET_LINK_LIFETIME = 24h`, `app/accounts/domain/reset_link.py`) is the only check
  left. One live link per user is the database's UNIQUE(user_id), not a rule in code.
- **Issuing is one upsert** whose business comes from the user's own row:
  `INSERT INTO reset_link (business_id, user_id, token_digest, created_at) SELECT
  business_id, id, :d, :t FROM app_user WHERE id = :u ON CONFLICT(user_id) DO UPDATE …`.
  The port takes no `business_id`. The token is generated and digested by the same
  functions invitations use.
- **Spending is one guarded statement.** The submit checks the new password's length,
  looks the link up read-only, hashes outside any write, then
  `DELETE FROM reset_link WHERE token_digest = :d AND created_at > :cutoff RETURNING
  user_id`; no row returned answers 404 `account.reset_link_gone`. The lookup and the
  spend share that predicate. A submit with no live link computes no scrypt. The new
  hash, the deletion of the user's other links and `unlock_email` land in one commit.
- **The brake has one sequence.** `refuse_attempt(accounts, transaction, email,
  address_digest, now, cutoff)` in `sign_in.py` counts both brakes, locks when a
  threshold is reached and commits before it raises or returns a refusal. `email` is
  `None` for a malformed one, so only the address counts. `log_in` and
  `change_password` call it; no other module calls `count_email_failure` or
  `count_address_failure`. `clear_email` keeps its guard and is what Change calls on
  success. Only the Reset submit lifts an active lock, through `unlock_email`.
- **Every password write rehashes** with `PasswordHasher.hash`, even when the new
  password equals the old one, so the session fingerprint changes and every other
  session closes (ADR-0002). Change answers a fresh token and cookie through the one
  cookie builder.
- **Change checks in a fixed order** (`POST /auth/password`, gated, takes
  `ClientAddressDep`, never 401 but for the session):
  1. lock: under either lock, `refuse_attempt` counts both brakes, commits and answers
     429 `account.login_locked`, with no scrypt, whatever else the body holds;
  2. length: 422 `account.password_weak`, counting nothing;
  3. verify: a wrong current password counts both brakes, commits and answers 422
     `account.current_password_wrong`;
  4. success: a fresh hash, the user's reset links deleted, `clear_email`, one commit.
- **Reset routes**:
  `GET /reset-links/{token}` (204 or 404) and `POST /reset-links/{token}` (open,
  unbraked). `reset` is a front segment; the API segment is `reset-links`.
- **Removal withholds owned tables.** `exported_tables(schema)` (owned minus
  `WITHHELD_TABLES`) feeds the export, the dry run's exported lines, reconciliation,
  `unlabelled_tables` and the reference index; `secret_columns` checks exactly the
  tables written to the file (`exported_tables` plus `business`), defined once. A
  withheld table with a `business_id` (`invitation`, `reset_link`) is deleted by it and
  counted as deleted only; `login_guard` keeps its delete by email.
- **The command** is `reset-password <email>`, a subcommand of accounts' CLI behind
  `scripts/reset-password.sh`. It writes only the link and its expiry to stdout, or
  `no user for that email` / `refused: <ExceptionClassName>` to stderr.

## Consequences

- Expired rows stay until the user's next link, next password change or the business's
  removal: a digest and an instant, nothing personal.
- Invitations keep their read-then-save spend; that race is known and outside this
  decision.
- A withheld table no longer has to be a platform table; the exclusions test checks
  that every withheld table is a platform table or has a `business_id`.

## Considered and rejected

- **A platform reset table like `invitation`**: removal would need hand-written code to
  find its rows, and §9 exempts only tables that decide which business a request is for.
- **`used_at` and `retired_at` columns**: three dead states to keep apart in every
  predicate, and one live link per user left to code instead of a constraint.
- **Look up, then save, as invitations do**: two submits of one link both pass under
  pysqlite's legacy mode (ADR-0012).
- **Copying the brake's counting into Change**: a second author of the brake.
- **Adding `reset_link` to `WITHHELD_TABLES` alone**: the export iterates owned tables
  minus platform tables, so the digest would be written, and `secret_columns`, which
  skipped withheld tables, would stop checking it.
