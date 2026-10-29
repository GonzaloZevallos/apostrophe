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
- **Schema prerequisites (migration 0008).**
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

## Amendment (GH-36): the file never stays half-written, and an unknown commit keeps it

The write that creates the export file could fail after `O_CREAT|O_EXCL` opened it --
the dump, the flush, either fsync -- and the clean-up that should have removed the
partial file never ran, because it only knew the path once `write_durably` returned.
A business's personal data could stay on disk. Separately, `remove(path)` after a
failed commit could delete the only copy of a business whose rows were, in fact,
already gone. This amendment (PM's round-3 ruling on accounts.md, "Removing a
business") fixes both.

- **Ownership moves into the adapter.** `FileExportFile` records `_created` itself,
  right after `os.open` succeeds, never after the write. `ExportFile.remove(path)` is
  gone; the port is `discard()` and `keep()` instead.
  - `discard()` removes only the file this instance created, is idempotent, and does
    nothing once `keep()` has been called -- it never touches a file it did not create.
  - `keep()` says the commit is being attempted; the file may be the only copy of the
    business's books from here on.
  - `write_durably` wraps the dump, the flush and both fsyncs in one `try`; any
    `BaseException` there calls `discard()` (its own failure suppressed) and
    re-raises the original exception. The caller never sees one raised by the
    clean-up itself.
- **One signal-mask helper, three masked regions.** `app.business_removal.application
  .signals.blocked_signals()` is the only caller of `pthread_sigmask` anywhere in this
  hexagon. It blocks SIGINT, SIGHUP and SIGTERM, and restores the previous mask with
  `SIG_SETMASK` in a `finally` -- never `SIG_UNBLOCK`, which would unblock a signal a
  caller above it had already blocked. It wraps:
  1. `FileExportFile`'s `os.open` and the assignment of `_created` (the
     `FileExistsError` path restores the mask too);
  2. `remove_business`'s pre-commit clean-up, around `export_file.discard()` alone --
     `rollback()` runs afterwards, unmasked, with its own exceptions suppressed
     (except `SystemExit`);
  3. `remove_business`'s commit region: `keep()`, then `commit_attempted = True`, then
     `commit()`, then `committed = True`.
- **Three outcomes after the try, not two.** `committed` is unchanged (never touch the
  file, never say "nothing deleted"). A new `commit_attempted` flag, true once the
  masked commit region was entered:
  - `commit()` raised with `commit_attempted` set: the outcome is unknown. The command
    prints the business name, the counts exported (never deleted, never "nothing
    deleted"), then the fixed line `Commit outcome unknown; export kept at <path>. Run
    with --dry-run and the same email before anything else.`, and exits 1. The file is
    kept -- it may be the business's last copy.
  - neither flag set: the ordinary pre-commit failure, now `discard()` (masked) then
    `rollback()` (unmasked, suppressed) then the fixed `failure_message`.
- **`main` is the backstop.** `app/business_removal/adapters/cli.py` builds
  `FileExportFile` before the inner `try`, so a signal that lands on the way into
  `remove_business`'s own `except` -- after a file was created but before that
  `except` runs `discard()` -- still has an instance for the outer handler to call
  `discard()` on (errors suppressed) before reporting.
- **`ColumnType.OTHER` is refused.** `other_type_columns` (next to `secret_columns` in
  `domain/classification.py`) refuses any `OTHER`-typed column outside
  `EXCLUDED_COLUMNS`, checked in `_schema_refusal` right after the secret check. Today
  this excludes only `pinned_catalog.token_ciphertext` (already excluded as a secret).
  A twin test (`tests/business_removal/domain/test_classification.py`, and
  `test_migrated_schema_types.py` over the real migrated schema) covers it, alongside
  `tests/business_removal/adapters/test_cli_failed_write.py`'s proof through `main`: a
  raw-DDL `INTEGER` column holding bytes passes every schema check and still makes
  `json.dump` fail, which is the case this amendment exists for.
- **libSQL evidence.** `sqlalchemy_libsql/libsql.py`'s `SQLiteDialect_libsql`
  subclasses `SQLiteDialect_pysqlite` and overrides neither `ischema_names` nor
  reflection, so Turso reflects the same types as SQLite here. A `sqlalchemy-libsql`
  upgrade is the trigger to add a pure `ischema_names` test, since a future version
  could change that.

### Known risks

- A `commit()` that hangs over Turso hangs with SIGINT, SIGHUP and SIGTERM blocked;
  only SIGKILL gets the operator out.
- A commit refused for certain before being applied (a local SQLite "locked" at
  `COMMIT`, for one) is still reported as unknown: a file with personal data is left
  for the operator to check with `--dry-run` and delete by hand. Accepted under PM's
  ruling -- the alternative risks deleting the only copy of a business that is, in
  fact, already gone.
- No test forces an `fsync` failure on its own; those failures share the dump's
  clean-up branch only by construction, not by a test that isolates them.
- A hard kill (SIGKILL) or a power loss between `os.open` and the `_created` record
  can still leave an orphan file, as already written above.

## Amendment (GH-384): the export's amounts follow the business's money scale

Planned in GH-318, not yet in the code. One sentence of this ADR is narrowed by docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md, in the money
part, and the quantity columns by docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md, in the units part; until those parts ship the sentence
describes what runs.

> `*_hundredths` written as two-place decimals under the key without the
> suffix, whole pesos.

Narrowed: amounts are exported as the exact value in currency units, and the export carries the
business's `{scale, decimals}` beside them, so a business at scale 2 is not exported as whole pesos.
Quantity columns stay as ADR-0056 stores them, in hundredths.
