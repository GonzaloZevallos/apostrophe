---
status: accepted
date: 2026-10-03
---

# The spreadsheet import plans through each owner's ports, then writes once through their own use cases

The spreadsheet import (docs/product/import.md) loads a business's history into seven
capabilities at once: varieties, catalog, stock, expenses, customers, sales and payments.
Imported data must be the same data, under the same rules, as hand entry; a refused run
must write nothing; and a dry run must list every problem in one pass and write nothing.
Every owner's use case commits at its own end, and every owner's rule lives in its own
domain (ADR-0006).

## Decision

- **A hexagon of its own, `app/spreadsheet_import/`** (`import` is a Python keyword),
  registered in `HEXAGON_ROOTS`. Its `adapters/cli.py` is the script's composition root,
  wrapped by `scripts/import-spreadsheet.sh <business-id> <file.xlsx> <mapping.csv>
  [--dry-run]`. The business is named by id; the report opens with its name.
- **One port per owner**, declared in `application/ports.py` and implemented in the
  owner's `adapters/`: a `has_records()` for eligibility (each owner says what counts),
  pure `check_*` methods that run the owner's own domain constructor and answer a
  refusal code, a normalised key or a priced total, and one writer that calls the
  owner's own use case. No code in the import reads or writes another capability's table,
  and each owner's adapter writes only its own tables: low-stock thresholds are checked
  and written by stock's port. Payments' port has `has_records()` only; catalog's port
  has no `has_records()`, since the header and footer never count and attributes cannot
  exist without a variety.
- **Two phases.** `application/plan_import.py` runs the checks; `domain/plan.py` is pure
  over the parsed rows (`domain/rows.py`) and those results, and owns sheet order,
  incomplete rows, merged spellings and categories, Amigo → VIP, unused mapping entries,
  the mismatch comparison and every problem in one pass. The write runs only on a plan
  with zero problems. The dry run never reaches it.
- **Whole or nothing.** Writers receive a `NoCommit` `Transaction`; the CLI commits once,
  at the end. Any exception during the write rolls back and the run is reported refused.
  Eligibility is checked before any sheet check and again inside the write session.
  Every phase of the run, parsing included, sits under one handler that rolls back and
  prints only `refused: <code>` or `refused: <ExceptionClassName>`, never `str(exc)`,
  and exits 1; the engine runs with `hide_parameters=True` as a second guard.
- **Records are named by key, never by id**, in the plan and in every check. Keys come
  from the owner's check (`VarietyName.key`, the normalised phone, the category name
  key); ids exist only in the write phase's `dict[key, id]`.
- **A sale's VIP comes from its row**: the sales writer and check pass a per-row
  `CustomerFacts` answering `vip = (type == "Amigo")`. The plan prices through a
  `PlannedPriceBook` beside `SqlPriceBook`, over the same `Variety.current_price` and
  `_quote`.
- **Order.** Writes go varieties, price entries, stock thresholds, catalog attributes,
  header and footer, categories, customers, Entradas, Gastos, Ventas, each sheet in
  `(date, sheet row)` order. Stock entries, expenses and sales take
  `recorded_at = import_instant + n µs` from one sequence over the whole write, so
  `recorded_at` and the id both carry sheet order, and a same-date negative adjustment
  draws before a same-date sale.
- **Reading the file**: openpyxl (runtime) with `read_only=True, data_only=True`;
  `adapters/cells.py` is the only place a cell becomes `Grams`, pesos, `date` or text,
  and `adapters/layout.py` the only place a sheet, cell or header text is named. Columns
  of Ventas, Entradas and Gastos are found by exact header text after trimming.
  `layout.py` names each sheet's typed and formula columns: a row whose typed columns
  are all blank is skipped in `cells.py` before any formula cell of it is read, and
  never reaches the report.
- **Unfinished rows add nothing.** The import's domain decides them from Ventas Total
  (text) and Entradas/Gastos Revisar (non-blank) before any owner `check_*` runs; they
  are listed with the sheet's own text, never reach an owner port, and create no
  customer, make no one VIP and choose no kept spelling. Whether the file was
  recalculated is checked once per workbook, on Ventas: a typed row whose Total has no
  value is one blocking problem. In Entradas and Gastos a blank Revisar means finished;
  every text it can show is also an owner refusal, so an unrecalculated unfinished row
  still blocks.

## Consequences

- Every owner gains an import adapter and its tests; an owner rule changed later
  changes the import with it, because the import never restates one.
- The facts about the real sheet, confirmed by the human from the sheet itself
  (2026-10-04), live as constants in `cells.py` and `layout.py`: titles on row 1 of
  Ventas, Entradas and Gastos, data from row 2; a Ventas row is unfinished when its
  Total (a formula) holds text instead of a number, and Ventas has no Revisar; an
  Entradas or Gastos row is unfinished when its Revisar is non-blank; the sheet's Total
  includes shipping, so it is compared with `Sale.total`.
- A seller writing at the very instant of the real run is not fully guarded (SQLite
  legacy mode, ADR-0012); accepted for a script run once before the seller starts.

## Considered and rejected

- **A CLI adapter calling the owners' use cases and counting their tables directly**:
  untestable without infrastructure, and a second author of what counts as a record.
- **Passing the `Session` as the `Transaction`**: each use case commits, so a refused run
  is left half imported.
- **One shared `recorded_at` for every row**: sheet order would rest on the id alone,
  and any reader sorting on `(date, recorded_at)` would scramble it.
- **A pure plan that restates the owners' rules**: a second author of every rule.

## Amendment (GH-54; ADR-0019): the mapping becomes an optional `--mapping` flag

Zeta's real sheet has no phone numbers. ADR-0019 makes a customer's phone optional and
the import's mapping file optional with it.

- The command line becomes `scripts/import-spreadsheet.sh <business-id> <file.xlsx>
  [--mapping PATH] [--dry-run]`: the mapping moves from a required positional argument
  to an optional flag. Leaving it out behaves exactly like giving an empty mapping,
  `ParsedMapping((), ())` — the same value eligibility's own ineligible-plan short
  circuit already used.
- `domain/plan.py`'s `customer_mentions(split, mapping)` is the one place that decides
  which distinct collapsed customer name `check_customer` is asked about, and with what
  phone: once per collapsed name on a finished Ventas row (the mapped phone, when a
  matching entry has one, or `None`), and once per mapping entry whose name is on no
  finished row (so a malformed phone there still blocks, even though it names nobody).
  `application/plan_import.py` and `build_plan` both call this same pure function, so
  the checks asked for and the problems filed against them never drift apart.
- A planned customer is now keyed by a tagged `CustomerIdentity`: `ByPhone(phone_key)`
  for one or more spellings sharing a number, `ByName(collapsed_name)` for a customer
  with none — never by an untagged string that could be either kind of key.
- `import.customer_not_in_mapping` is removed: a name missing from the mapping no
  longer blocks, and is no longer listed as a problem. The report gains the count of
  customers imported without a phone number, next to the customer count.
