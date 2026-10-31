---
status: accepted
date: 2026-10-02
---

# A sale line records the price it was sold at; a mistaken price entry is deleted

In the spreadsheet a sale row looks its price up in the price history every time it is
recalculated. That only keeps old sales right as long as nobody touches an old price
row, so the sheet tells the operator never to edit one. A typo in today's price had no fix.

## Decision

- **A sale line stores its price per gram** (and whether it was list, bulk, VIP, gift or
  special) at the moment it is recorded. A sale's total is computed from what its lines
  stored, never from the price history again.
- **Price entries are never rewritten.** A new price is a new entry effective from its
  date. A **mistaken entry may be deleted** (`DELETE /api/products/{id}/prices/{entry_id}`):
  sales already recorded keep their stored prices, and the entry before it becomes the
  current price again.

## Consequences

- The price history answers "what does this cost on a day", not "what was this sale
  charged". The second question is answered by the sale line.
- The sales capability must store the price on each line; it is a requirement on that
  task, recorded here before it exists.

## Considered and rejected

- **Recompute from the history, as the sheet does**: forbids correcting a typo, and
  silently reprices old sales the day someone deletes or backdates an entry.
- **Editable price entries**: a rewritten entry hides what the price was believed to be.
