---
status: accepted
date: 2026-10-03
---

# Cost of goods sold follows its lots as they stand; a stock entry is never frozen

Stock entries and lots (docs/product, not yet written) give every sale and gift line the
cost of the lot it drew from, oldest lot of its variety first (CONTEXT.md: Lot). ADR-0003
freezes a sale line's *price* once recorded, so a later price correction never rewrites
what a customer was charged. The same question came up for *cost*: should a sale or gift
line's cost of goods be frozen the same way the moment it is recorded?

## Decision

- **A stock entry is never frozen.** Any entry — purchase, harvest, opening stock or
  adjustment — can be edited in every field (date, variety, grams, origin, cost, note) or
  deleted, whether or not grams have already been drawn from it, each action confirmed
  first. This is the opposite of a price entry, which is deleted and replaced, never
  edited (ADR-0003).
- **A sale or gift line's cost of goods is always computed from the lots as they stand
  now**, oldest lot of the variety first, by date. It is not stored once and kept; it is
  worked out again whenever a stock entry that could change the chain is added, edited or
  deleted. The change is visible the next time that line's cost, or the profit of the
  period it falls in, is read — immediately, not on some later recompute.
- **A late or corrected entry takes its place by its own date**, not by when it was typed
  in. Consumption for that variety is worked out again from that point forward, however
  far back it reaches: a purchase entered today for last week can move grams that were
  sold last week off a newer lot and onto this one, correcting their cost and the profit
  of every period in between.
- **Grams sold or gifted beyond everything recorded as coming in have no cost yet.** They
  are never priced at $0. They carry a pending cost until a later stock entry — of any
  origin, wherever its date lands in the lot order — settles it. Pending cost is always
  shown, never hidden, the same way negative stock is always shown.
- **The correction touches only that variety's cost of goods.** A sale's prices, line
  totals, payments and balances never move (ADR-0003, ADR-0007); other varieties' costs
  never move either.
- **Selling or gifting past zero stock is never refused.** The flower has already changed
  hands by the time it is recorded; stock goes negative and the variety shows sold out at
  once, the same as the spreadsheet allowed.

## Consequences

- Cost of goods sold, and profit for a past period, can change after the fact when a
  stock entry is corrected. There is no closed period: results read the lots as they
  stand today, not as they stood when a line was recorded.
- A line's displayed cost can be partly costed and partly pending at once, when its grams
  spilled across lots that did not all exist yet.
- Results (profit, margins — not yet built) must say when a period's cost of goods
  includes pending grams, and never present them as $0.
- Deleting a sale returns its grams to stock; whichever lots they land back on is worked
  out the same way, by date.

## Considered and rejected

- **Freeze cost on the line, like ADR-0003 freezes price**: a price is a fact agreed at
  the counter and must never change after the sale. A lot's cost is not agreed with
  anyone; it is a bookkeeping fact that a late or corrected stock entry can make more
  accurate. Freezing it would let a purchase recorded late, or a typo in its cost, leave
  profit wrong forever — the opposite of why lot costing (over one all-time average) was
  chosen.
- **Bound the recomputation to a time window (e.g. the current month)**: would leave
  some already-shown lines quietly wrong whenever a correction reaches further back,
  which is the exact failure this decision exists to end.
- **Price grams beyond stock at $0 or refuse the sale**: $0 understates cost and overstates
  profit; refusing the sale denies recording flower that is already gone.
