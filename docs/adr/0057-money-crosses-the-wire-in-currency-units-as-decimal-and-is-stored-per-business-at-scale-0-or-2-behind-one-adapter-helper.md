---
status: accepted
date: 2026-10-25
---

# Money crosses the wire in currency units as Decimal and is stored per business at scale 0 or 2, behind one adapter helper

Amends ADR-0001, ADR-0007, ADR-0010, ADR-0013, ADR-0015.

GH-318 part 1. Today money is whole pesos everywhere (ADR-0001). The business-configuration PRD
(docs/product/business-configuration.md, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3)
gives each business its own currency symbol and decimals, and leaves the storage to the Tech Lead.
This records it. No code changes in this part.

## What the PRD says

- "Each business has its own currency symbol and money decimals (0 to 2), and the catalog's money
  format follows them."
- "Any business can raise its money decimals, including one that existed before this epic. They can
  go down only when no recorded amount has more decimals."
- "A change of symbol or decimals never changes a recorded amount's value or what the seller typed."
- "A sale of $11.000 still totals $11.000, shown as $11.000,00 at 2 decimals, and every figure worked
  out from recorded amounts (totals, balances, profit, cash, margins) stays equal."
- "How amounts are stored is the Tech Lead's decision. If stored amounts are rescaled when decimals go
  up, the rescale runs once, in one transaction, and is checked to leave every value and derived
  figure equal."
- "A new business starts with "$" and 0 decimals, confirmed during setup."
- "No stored row is rewritten by the migration."

## Decision

- **The wire carries the value in currency units**, `11000` or `11000.50`, parsed as `Decimal` through
  one money schema type and never as `float`. No request carries decimals or a scale, and no answer
  makes the front multiply or divide by one. The money schema type refuses more places than the
  business's decimals.
- **Storage is an integer count of the business's smallest unit, at a per-business scale of 0 or 2.**
  Scale 0 stores whole currency units, as today; scale 2 stores hundredths. Existing businesses are
  at scale 0, so no stored row is rewritten by the migration that adds the setting; a new business
  starts at scale 2. The scale is a storage fact, not the display decimals (a business at scale 2 may
  show 0 decimals); the display decimals are the PRD's money decimals and cannot exceed the scale.
- **A rescale is opt-in and one-time.** A business at scale 0 that raises its decimals above 0 is
  rescaled to scale 2 by multiplying every stored amount by 100, in one transaction, then checked:
  every amount and every derived figure (totals, balances, profit, cash, margins) is equal in value
  before and after, and the check failing rolls the whole transaction back. It runs once; a business
  at scale 2 is never rescaled again, and lowering decimals never changes a stored amount.
- **A use case never reads the scale.** Domain and application code hold amounts in the business's
  stored integer unit only as opaque integers and never convert them. The scale is applied only
  inside an adapter's SQL statement, through the one money adapter helper, so a sum, a product or a
  comparison done in SQL is scaled in one place. Isolation of the scale to the adapter is checked by
  a test that fails when a use case or a domain module imports the helper or reads the setting.
- **An amount is held only in a typed integer column declared through `money_column()`.** The
  function tags the column so tests find every amount column; an amount is never held in a JSON, Text
  or String column. A migration that adds an amount column declares it the same way.
- **Half-up rounding goes through `round_half_up` in `app/shared/money.py`.** It rounds an exact
  `Fraction` or ratio to the stored unit, half up, in integer arithmetic. No literal `// 100`, no
  `round(` and no whole-peso assumption stays outside it.
- **The business export carries `{scale, decimals}`.** Amounts are exported as the exact value in
  currency units, with the business's scale and decimals beside them, so a restore reads them back
  unchanged.

## Consequences

- ADR-0001's "Money is whole pesos (`int`)" holds for a business at scale 0 and stays true of the
  database column type; ADR-0007's line totals and ADR-0010's cost rounding round to the stored unit
  of the business, not to the peso. The wire changes from whole integers to values in currency units
  in the parts that build it; until then every ADR's figures stand as written.
- Amounts are integers in every business, so sums, balances and the ledger arithmetic stay exact; only
  the SQL that multiplies a price by a quantity needs the helper.
- Two columns of the same table are never at different scales: the scale belongs to the business.

## Considered and rejected

- **Decimal or float columns**: SQLite stores them as floating point, and a sum over a year drifts.
- **Always scale 2, for every business**: it rewrites every stored amount of an existing business in
  the migration, against "No stored row is rewritten by the migration", and M3 forbids it.
- **A scale on every amount row**: every reader and every sum would branch on it; the PRD sets decimals
  per business.
- **Doing the scaling in the use cases**: every use case would read the setting, and a missed one is a
  figure wrong by a factor of 100 that no type checker sees.
- **A wire carrying the integer stored value plus the scale**: the front would do money arithmetic,
  and the PRD says a change of decimals never changes what the seller typed.
