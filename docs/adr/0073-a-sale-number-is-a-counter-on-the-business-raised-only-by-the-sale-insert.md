---
status: accepted
date: 2026-11-07
summary: "el número de una venta es un contador del Business que solo sube el alta de la venta"
---

# A Sale number is a counter on the business, raised only by the sale insert

Extends docs/adr/0004-businesses-never-mix.md and docs/adr/0007-a-sale-stores-its-line-totals-and-its-on-the-spot-payment.md without amending them.

Epic GH-519. `sale.id` is global across businesses, so showing it would reveal other businesses'
volume. A Sale gets a number of its own (CONTEXT.md: Sale number), per business, that is never
reused, even after the sale that held it is deleted (Undo included). `max(number) + 1` cannot
promise that, so the highest number ever given is stored.

## Decision

- **The high-water mark lives on `business`.** `business.last_sale_number` is NOT NULL with a
  server default of 0. `sale.number` is NOT NULL with no default of any kind.
- **One place raises it.** `SqlSales.add` runs `UPDATE business SET last_sale_number =
  last_sale_number + 1 WHERE id = :business RETURNING last_sale_number` as the first write of the
  save, and the `sale` insert carries that value. No other module computes, increments or guesses a
  number. `SqlSales.delete` does not touch the counter, so gaps are allowed.
- **It is one commit with the sale.** The use case commits once; a failed save rolls the increment
  back, so only a recorded sale takes a number.
- **The database's single writer serializes it.** SQLite and libsql allow one writer at a time, so
  two saves in one business never read the same counter. A second writer waits or fails as locked,
  and retries after the first commits.
- **A constraint is the last defence.** `UNIQUE(business_id, number)` (`uq_sale_business_id_number`)
  turns a bug into a failed save. A duplicate is a bug and has no rule code.
- **Existing sales** are numbered once, by migration 0023, per business by
  `(sale_date, recorded_at, id)` (column renamed in GH-75 part 2, migration 0026); each counter becomes that business's highest number. The
  Spreadsheet import writes through `SqlSales.add`, so it takes numbers in its own write order.

## Consequences

- `SqlSales` writes the accounts-owned `business` row, adapter to adapter, as it already writes
  `PaymentRow`. No port is added: a port would invite a second incrementer.
- The downgrade of 0023 rebuilds `sale`, so it switches foreign keys off before its first write and
  checks them at the end.
- Business removal and export read the reflected schema (ADR-0015), so `sale.number` is exported on every sale; the business header is hand-built, so it carries `last_sale_number` explicitly, read with the business.
