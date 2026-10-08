---
status: accepted
date: 2026-10-07
---

# A "answers in under 300 ms" metric is guarded by query plan and statement count, never by elapsed time

PRD metric 6 says the Ventas list answers in under 300 ms with a few hundred sales. It was
checked by one timed request in `web/e2e/sales.spec.ts`, which read 301 ms, and once
478 ms, on a machine busy with several runs (GH-120). A check whose verdict depends on how
busy the machine is cannot sit in the gate (the same reason GH-110 took the other timings
out of it).

## Decision

1. **A speed metric of this form is guarded in the gate by what makes it fast, not by how
   long it took.** Two things, both independent of machine load: the query plan
   (`EXPLAIN QUERY PLAN`) of the list's statements must search named indexes instead of
   scanning whole tables, and the number of SQL statements a request issues must be the
   same at two data sizes. No test in the gate asserts on a measured duration.
2. **Three indexes make the guard possible** (migration `0016`): `ix_sale_business_id_sale_date`
   on `sale (business_id, sale_date)`, `ix_sale_line_sale_id` on `sale_line (sale_id)` and
   `ix_payment_sale_id` on `payment (sale_id)`. Before, those tables had only their primary
   keys, so there was no index a plan check could see go missing. An index changes what a
   query costs, never what it returns; the migration touches no row, and its test proves it
   over a seeded database on both drivers. `sale.sale_date` is on the naming allowlist; the
   index takes its current name (CODING_STANDARDS section 11) and the allowlist is untouched.
3. **The settlement read is left alone.** `SqlLedgers` sums every `sale_line` of the business
   (ADR-0012). It is not asserted to avoid scans; the statement count alone covers it.

## The plan of the list, before and after

The two statements of `SqlSales._views` for `GET /sales?date_from=…&date_to=…`, as
`EXPLAIN QUERY PLAN` shows them. Identical on the stdlib `sqlite3` driver and on libsql.

Before (migration `0015`):

```
sales:  SCAN sale
        BLOOM FILTER ON payment (sale_id=? AND business_id=?)
        SEARCH payment USING AUTOMATIC PARTIAL COVERING INDEX (sale_id=? AND business_id=?) LEFT-JOIN
        USE TEMP B-TREE FOR ORDER BY
lines:  SCAN sale_line
        SEARCH variety USING INTEGER PRIMARY KEY (rowid=?)
        USE TEMP B-TREE FOR ORDER BY
```

After (migration `0016`):

```
sales:  SEARCH sale USING INDEX ix_sale_business_id_sale_date (business_id=? AND sale_date>? AND sale_date<?)
        SEARCH payment USING INDEX ix_payment_sale_id (sale_id=?) LEFT-JOIN
lines:  SEARCH sale_line USING INDEX ix_sale_line_sale_id (sale_id=?)
        SEARCH variety USING INTEGER PRIMARY KEY (rowid=?)
        USE TEMP B-TREE FOR RIGHT PART OF ORDER BY   (libsql; sqlite3 says LAST TERM OF ORDER BY)
```

The captured statements were the two `_views` ones with the business and a period bound
inline; the customer join, which the planner drops when no customer column is read, is
the one part not shown.

## Cost (CODING_STANDARDS section 8)

- **Reads.** The list goes from a full scan of the business's sale, line and payment rows
  (plus an automatic index built per request on `payment`) to an index search over the
  period's rows: O(log n + k), k being the rows in the period.
- **Writes.** Each insert or delete of a `sale`, `sale_line` or `payment` row maintains one
  more B-tree entry, O(log n) per row, a constant number per sale's line count.
- **Unchanged.** The settlement read is still O(sales + payments) of the business (ADR-0012).

## Known risks

- **User-flow time metrics lose their only automated guard.** Recording a sale, registering
  a customer, changing a password, the invitation and reset links and the onboarding had
  their "under N seconds" metrics checked by timed e2e assertions, which go. A uniform
  slowdown of those flows is caught by no test; their budgets are checked by eye on a real
  phone.
- **Settlement can regress unseen.** `settle()` runs in Python, so the statement count
  cannot see a quadratic regression inside it.
- **"Recording answers in under 300 ms" was never timed and still is not.**
- **A plan is not a duration.** The plan check proves the indexes are used, not that the list
  answers in 300 ms. If a future driver picks another plan on a database never `ANALYZE`d,
  the test fails; that calls for a decision here, not for tuning the test.
- **Migration number collision.** If another branch lands `0016` first, this migration is
  renumbered to the next free number with its `down_revision` pointing at that one. A merge
  migration is never written.

The other docs' 300 ms metrics are not retrofitted by this decision.
