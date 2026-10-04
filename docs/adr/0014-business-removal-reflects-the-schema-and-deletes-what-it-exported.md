---
status: accepted
date: 2026-10-03
---

# Business removal reflects the schema, classifies columns by convention, and deletes exactly the ids it exported

The operator's command exports a business and then removes it (docs/product/accounts.md,
"Removing a business"). Two of the PRD's rules are hard to change later. First, a table
added later must be covered without touching the command. Second, nothing may be
deleted that the file does not hold. `app.tables.metadata` already lost the two stock
tables (`TABLE_MODULES` did not list `app.stock.adapters.tables`), so a hand-kept list
of tables, even an implicit one, had shown it fails silently.

## Decision

- **A hexagon of its own**, `app/business_removal/`, registered in `HEXAGON_ROOTS`.
  - Its CLI is `app/business_removal/adapters/cli.py`, behind
    `scripts/remove-business.sh <email> [--dry-run]`, a copy of `invite-business.sh`.
  - It is not a subcommand of accounts' CLI. Accounts' adapters must not become the
    place where every hexagon's tables meet.
- **Tables are discovered by reflecting the live database** after `upgrade_to_head`,
  not from `app.tables.metadata`.
  - Every table with a `business_id` column is deleted by that column.
  - `business` goes by `id`, `invitation` by `business_id`, and `login_guard` by the
    removed users' emails.
  - `alembic_version` is the only table skipped by name.
  - Any other table that has no `business_id` and is not a platform table makes the
    command refuse before it reads anything.
  - Deletes run in reverse foreign-key order, reflected from the database.
  - `TABLE_MODULES` gains the stock tables. A fresh-interpreter test keeps it equal to
    the migrated schema.
- **Columns are classified by convention, with a closed exclusion set in the domain**,
  not by `info` on each mapped table. A table created by raw DDL carries no `info`.
  - Every column is exported except `app_user.password_hash`. `invitation` and
    `login_guard` are withheld whole.
  - A column is flagged by its underscore-separated name segments, not a substring:
    any segment in `{secret, secrets, token, tokens, hash, digest, password,
    passwords, credential, credentials, encrypted, ciphertext}`, or the whole name
    ending in `api_key`, `private_key` or `secret_key`. A bare `key` segment is not
    enough on its own: `variety.name_key` and `expense_category.name_key` are real
    columns this pattern must not catch. A flagged column that is not excluded makes
    the command refuse.
  - A reference is written as `{id, name}`. The name comes from the target's `name`
    column, or from a label declared in the domain for each business-owned table that
    has none.
  - Every run-time refusal has a twin test over the migrated schema, so the diff that
    introduces the problem fails, not the operator's run.
- **Export keys are table names.** Values are plain: ISO dates, ISO instants in UTC
  with `Z`, `*_hundredths` written as two-place decimals under the key without the
  suffix, whole pesos.
- **Exported ids equal deleted ids.** Each delete is `DELETE … WHERE business_id = :id
  RETURNING id`, inside one write transaction. For every exported kind, the returned
  id sets are compared with the id sets parsed from the file read back from disk. Any
  difference rolls back. There is one commit, at the end.
- **Schema prerequisites (migration 0007).**
  - `app_user.joined_at`, set by `accept_invitation`.
  - A new-business invitation records the business it opened when it is used.
  - Existing rows are backfilled by pairing used invitations with businesses and users
    in id order, only when the counts match exactly. Otherwise the field stays `NULL`
    and is exported as `null`.
- **The file and the terminal.**
  - The file is written under `APOSTROPHE_EXPORT_DIR` (default `~/apostrophe-exports/`,
    `0o700`). The directory is refused if it resolves inside the repository or is open
    to group or other.
  - The file is created with `O_EXCL` and mode `0o600`.
  - A failed or interrupted run, including SIGINT, SIGHUP and SIGTERM, rolls back and
    removes the file it created.
  - The business name is printed in NFC with control characters escaped, compared in
    NFC, and slugged with a `business` fallback.

- **Durable before deleting.** `ExportFile.write_durably` fsyncs the file and its
  directory. `read_back` then parses it from a new descriptor. Both happen before the
  first `DELETE`.
- **Commit decides the clean-up.** SIGINT, SIGHUP and SIGTERM are blocked around
  `commit()` until a `committed` flag is set. One top-level handler then acts on that
  flag alone:
  - before commit: roll back and remove the file;
  - after commit: never touch the file, and never print "nothing deleted".
- **No residue in the database file.** The command's own engine runs
  `PRAGMA secure_delete = ON`, and the command never runs `VACUUM`.

## Consequences

- Durability across a power loss rests on the operating system's `fsync` of the file
  and its directory, which is not tested. Read-back proves the content and that it
  parses, not the disk.
- Outside the command: earlier backups of the database file, the filesystem blocks of
  the unlinked rollback journal, and the export file itself.

- A future secret column, or a new table without `name` or a declared label, fails the
  suite in the diff that adds it.
- #10's bot token must be added to the exclusion set in its own diff.
- A hard kill can leave one orphaned export file, whose path was already printed.
- A business opened before 0007 may export `joined_at: null`, and may leave its spent
  opening invitation behind: a digest and two instants, nothing personal.

## Considered and rejected

- **`app.tables.metadata` as the source of tables**: it was already missing the stock
  tables, and it fails open.
- **`info` classification on each mapped table**: a reflected or raw-DDL table has none.
- **Comparing counts only**: a row created and another deleted cancel out.
- **`BEGIN IMMEDIATE` around the export**: it holds the writer lock while the file is
  written, which slows other businesses.
- **A subcommand of accounts' CLI**: it puts every hexagon's tables in accounts'
  adapters.
