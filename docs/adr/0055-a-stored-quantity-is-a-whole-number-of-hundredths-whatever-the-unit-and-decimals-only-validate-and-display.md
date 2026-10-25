---
status: accepted
date: 2026-10-25
---

# A stored quantity is a whole number of hundredths whatever the unit, and decimals only validate and display

Amends ADR-0001, ADR-0020, ADR-0022.

GH-318 part 1. Today the only quantity is the gram, stored as whole hundredths (ADR-0001). The
business-configuration PRD (docs/product/business-configuration.md, read at commit
c4286c2cab8e4a4160292d15921c552fcae3f3f3) lets each business choose its units. This records how a
quantity is stored and summed once units are the seller's own. No code changes in this part.

## What the PRD says

- "Each product has one unit, used for its stock, its price, its sale quantity, its bulk minimum and
  its low-stock threshold. A business may mix units."
- "A unit has a name, a short label and 0 to 2 decimals."
- "Its decimals can go up at any time. They can go down only when no recorded quantity in that unit
  has more decimals."
- "Quantities of different units are never added together. Any figure that totals quantities across
  products shows one amount per unit, each with its label."
- Of an existing business: "the "grams" / "g" unit with 2 decimals" and "No stored row is rewritten
  by the migration."

## Decision

- **A stored quantity is a whole number of hundredths, whatever the unit.** A unit of 0 decimals
  stores 300 for 3; a unit of 2 decimals stores 250 for 2,50. Every quantity column keeps its
  integer type and its meaning.
- **A unit's 0 to 2 decimals are validation and display only.** On input, a quantity with more
  decimals than its unit is refused. On output, the decimals decide how many places are shown. They
  are never a storage scale, never a divisor and never read by a computation. Lowering a unit's
  decimals is allowed only when every recorded quantity of that unit is a multiple of the new step
  (the PRD's "no recorded quantity in that unit has more decimals").
- **Existing grams are already hundredths.** The grams unit with 2 decimals needs no conversion: no
  stored row is rewritten.
- **A figure that sums quantities across products groups them by unit.** One type, `QuantityByUnit`
  (unit id to hundredths), is the only way such a figure is carried and shown; two quantities of
  different units are never added. This covers the figures the PRD lists: the pending marks of
  profit and margin ("and N ... without cost"), the quantity gifted on Home, and the withdrawal and
  gift totals. Quantities of one product, and of products sharing a unit, may still be added.
- **Stock arithmetic is unchanged.** Allocation, lots, draws and the stock level work on hundredths as
  they do today; the unit only decides the label and the places shown.

## Consequences

- A figure that was one number of grams becomes a list of one amount per unit. Every reader of such a
  figure changes in the part that builds `QuantityByUnit`; until then ADR-0020's figures stand as
  written.
- A business with one unit sees one amount, as it sees one gram figure today.
- A unit's decimals can go up with no migration of quantities, since nothing is stored in them.

## Considered and rejected

- **Store each quantity in its unit's own scale (0, 1 or 2 decimals)**: raising decimals would rescale
  every quantity of that unit, and every sum would need the scale. Hundredths for all makes a raise a
  one-row update.
- **A decimal or float column**: drift in sums, the failure ADR-0001's hundredths exist to avoid.
- **Convert between units to add them**: the PRD forbids adding different units, and units have no
  declared relation.
