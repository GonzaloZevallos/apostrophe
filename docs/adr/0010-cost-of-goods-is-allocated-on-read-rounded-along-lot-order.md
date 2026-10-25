---
status: accepted
date: 2026-10-03
---

# Cost of goods is allocated on read, in one pure function, rounded along lot order

ADR-0009 says a draw's cost of goods always follows its lots as they stand now, with no
time bound. Stock (docs/product/stock.md) asks for two things at once: each sale line's
cost is a whole-peso amount rounded once over everything it took, never lot by lot; and
a used-up lot's draws add up to exactly its cost. Results (#7) and margins (#8) will read
the same figures, so how they are produced is hard to change later.

## Decision

- **Compute on read, no stored projection.** Every writer that can move a cost (stock
  entry create, edit and delete, sale record and delete) would otherwise have to rebuild
  a projection, two of them in another hexagon. `GET /stock` never allocates: stock,
  status, sold-out-since and days left come from
  `app/stock/domain/stock_level.py` over the variety's lots and draws, at
  O(entries + lines) of the business. Allocation runs only where a draw's cost is read
  (`GET /sales/{id}` today, #7 later), over the varieties involved, at
  O(entries + draws) of those varieties. We revisit if a measurement misses 300 ms.
- **One function allocates**: `app/stock/domain/allocation.py::allocate(lots, draws)`.
  Draws take from lots in lot order, as plain FIFO over the variety's lots: draw k covers
  grams [D(k−1), D(k)) of the lot sequence, whatever the lots' dates.
- **Rounding along lot order**: a draw's costed amount is
  `half_up(C(end)) − half_up(C(start))`, where `C` is the exact cumulative cost, as a
  `Fraction`, up to `min(end, total lot grams)`, and `half_up(x) = floor(x + 1/2)`. Every
  lot boundary falls on a whole-peso cumulative cost, so a used-up lot's draws sum to
  exactly its cost, and a draw spanning lots is rounded once. The part of a draw past the
  total lot grams is pending grams, carried as `Grams`, never as a cost.
- **One order**: `LotOrder` is `(date, recorded_at, entry_id)` for lots and
  `(date, recorded_at, kind, ref_id, position)` for draws, with a negative adjustment
  before a sale line on an exact tie. A stock entry's `recorded_at` is set on create and
  never changed by an edit.
- **One source for stock and pending**: lots and draws come from the same loader for
  `/stock` and for allocation, so a variety's total pending grams equals
  `max(0, −stock)` exactly.
- No `float`, `round()` or `Decimal.quantize` in cost-of-goods paths. An entry's
  displayed cost per gram (`costing.cost_per_gram`, half up) is for display only and
  never feeds `allocate`.

## Consequences

- A variety's whole history is replayed on every read of a draw's cost; a business with
  years of history pays for it on each read.
- A negative adjustment's costed amount is computed and returned by `allocate` but not
  exposed yet; #7 decides how it counts.
- Sales reach line costs only through the `LineCosts` port they declare, wired in
  `app/main.py` (ADR-0006); nothing under `app/sales/` imports `app.stock`.

## Considered and rejected

- **A stored projection of draws per lot, rebuilt on every write**: one missed writer
  leaves lines quietly wrong, the failure ADR-0009 exists to end, and no isolation test
  can see it.
- **Largest remainder per lot**: rounds lot by lot, so a line spanning two lots is
  rounded twice.
- **Rounding each line on its own**: three thirds of a $100 lot sum to $99.

## Amendment (GH-318 part 1): rounding along lot order

ADR-0057 narrows what the rounding rounds to. The code changes in the part that builds it; until then
the sentence describes what runs.

> Every lot boundary falls on a whole-peso cumulative cost, so a used-up lot's draws sum to

Narrowed by [ADR-0057](0057-money-crosses-the-wire-in-currency-units-as-decimal-and-is-stored-per-business-at-scale-0-or-2-behind-one-adapter-helper.md): the cumulative cost is rounded half up to the business's stored unit
(the peso at scale 0, the hundredth at scale 2), through `round_half_up`, not to the peso. The
construction (`half_up(C(end)) - half_up(C(start))` along lot order, a draw spanning lots rounded
once) is unchanged, and a used-up lot's draws still sum to exactly its cost.
