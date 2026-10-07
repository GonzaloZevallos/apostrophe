# 0032. A variety is archived by a stored instant, and its history is computed

Status: accepted (GH-117)

## Context

A variety loaded by mistake, or one the business no longer works with, can only be
hidden from the catalog today. The owner wants to delete one that has no history and
archive one that has, keeping every past sale, stock movement and figure unchanged
(`docs/product/varieties.md`).

## Decisions

- **Archiving is one stored fact**: `variety.archived_at`, a nullable instant. It is the
  only new column. Whether a variety has history is never stored; it is worked out live
  from `sale_line` and `stock_entry`.
- **Readers choose.** `Varieties.all()` is gone. A caller uses `listed()` (unarchived,
  by name), `archived()` or `get()` and reads `is_archived` itself. There is no default
  and no `include_archived` flag, so under `mypy --strict` nothing filters by accident.
- **Nothing that is a record filters on `archived_at`**: period figures, sale views,
  accounts, Todas las entradas and the export. `GET /stock`'s rows are the listed
  varieties, but its `total` is summed over the unfiltered `for_varieties(None)` load,
  since an archived variety's grams are still on hand. Rows and total stop sharing a
  filter.
- **Migration 0013** is a native `ADD COLUMN` (no default, no backfill) and a native
  `DROP COLUMN`, with no table rebuild, so the five tables that reference `variety` are
  never copied. The downgrade refuses, with a message that names no data, while any
  variety is archived: dropping the column would silently bring it back to the lists.
  Tested up and down over a plain sqlite file and a libsql file.
- **Archive and restore are never refused for history** (PM, round 3): archive loses
  nothing and can be undone. History decides only which removal action a page offers.
- **Only delete is guarded.** It deletes each owner's dependents, then ends with one
  `DELETE ... AND NOT (history) RETURNING id`. `PRAGMA foreign_keys=ON` closes the race
  with a sale or entry recorded at the same moment: the insert fails on the foreign key.
  A use case turns that `IntegrityError` into a gone code only after it rolls back and
  its own lookup confirms the variety is gone or archived; any other cause is re-raised.
- **Accepted race**: a sale or entry committed the instant after an archive adds a
  history line to the archived variety. It is visible, and nothing is orphaned.
- **Known risk**: Turso's remote protocol is never exercised by tests; a libSQL server
  too old for `DROP COLUMN` would make the downgrade restore-only.

## Consequences

- An archived variety keeps its name reserved under the existing uniqueness rule;
  `Varieties.name_holder` says whether a live or an archived variety holds a name.
- The business export picks `archived_at` up through ADR-0015's reflection, as an ISO
  instant with no secret flag, with no change to the command.
