---
status: accepted
date: 2026-11-10
---

# An existing business raises its decimals once, by a conditional rescale guarded at commit

Amends docs/adr/0058-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md.

Epic GH-318. ADR-0058 stores amounts per business at scale 0 (whole units) or 2 (hundredths) and
left open how an existing business moves from one to the other. This records it.

## Decision

- **The scale goes from 0 to 2 once, never back.** `ApplyMoneyFormat(business_id, symbol, decimals)` is the one
  use case that sets a business's decimals. Raising above 0 runs `UPDATE money_format SET scale = 2
  WHERE business_id = :b AND scale = 0`. That statement takes SQLite's write lock and changes a row
  only the first time; only then is every column tagged `info["money"]` in `app.tables.metadata`
  multiplied by 100, in the same transaction. The column list is read from the tags, never from a
  list written by hand, and every statement filters on the one business.
- **Each rescaled column is checked inside the transaction.** The largest absolute value must fit
  a 64-bit integer after the multiply, the count of non-NULL values must not change, the sum must
  equal the old sum times 100, and no value may have stopped being an integer. Any failure rolls
  everything back.
- **A commit-time guard.** A `before_commit` listener in `app/db.py` flushes, then re-reads
  `money_format.scale` for each business whose factor the session cached. A mismatch clears the
  cache and raises `MoneyScaleChanged` (no code, a fixed message, FastAPI's default 500), so a writer
  that read scale 0 and commits after the rescale stores nothing. The rescale adapter reads and
  writes the scale only with its own SQL and never through `money_scale_factor`, so the guard never
  takes its own change for a stale writer.
- **"Write nothing" after the rescale** means no amount column and no `scale` is written. `decimals`
  is written only when its value differs. A lower is refused with `DecimalsBelowRecordedAmounts`
  when a recorded amount has a remainder at the lower decimals.
- **Derived figures are not checked at run time.** This narrows ADR-0058's run-time check of
  derived figures. They are covered by `tests/architecture/test_money_adapters_scaled.py` together
  with the suites that run at both scales and the before/after comparison of the rescale.
- **What a rescale leaves equal.** Every recorded amount (a price, a line total, a payment, an
  expense, a lot's cost) reads the same before and after. A figure worked out on read (cost of
  goods, shortfall, margin, average margin, costed cost) is shared out over the grams drawn, so
  its exact value is not whole; it shows rounded half up at the business's decimals, a whole unit
  at 0 and a hundredth at 2. After the rescale it can therefore carry cents it did not carry
  before. `tests/money_format/test_rescale_figures.py` lists them in `WORKED_OUT_ON_READ` and
  asserts each equals the value before rounded half up at 2 decimals.
- **The cost.** The rescale is linear in the business's rows across every tagged column: one
  aggregate before, one UPDATE and one aggregate after. For that time it holds SQLite's file-wide
  write lock, so other businesses' writes wait, and past the driver's busy timeout they fail busy.
  That is timing only: no data crosses businesses. A busy database becomes `RescaleBusy` and nothing
  changes. The first live use is the owner's decision.
- **Who writes `money_format`.** No code outside `app/money_format/adapters/` inserts or updates
  it (`tests/architecture/test_money_format_writer.py`). Business removal's reflected delete is the
  one exception. The Settings part must call `ApplyMoneyFormat` and never write `decimals` or `scale`
  itself. ADR-0034 was cited for this rule by mistake.
- **libsql is unproven.** The locking behaviour of libsql (Turso) is not exercised locally. The
  commit-time re-read is the protection that does not depend on it.

## Consequences

- A read-only request whose SELECTs straddle the rescale may answer one inconsistent figure. Nothing
  is stored wrong.
- The `ast` scan cannot see `row.amount` on a loaded entity; only the both-scales suites catch it.
