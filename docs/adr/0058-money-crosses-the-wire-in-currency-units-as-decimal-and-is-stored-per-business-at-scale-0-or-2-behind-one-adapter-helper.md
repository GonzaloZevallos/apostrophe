---
status: accepted
date: 2026-10-25
---

# Money crosses the wire in currency units as Decimal and is stored per business at scale 0 or 2, behind one adapter helper

Amends docs/adr/0001-stack-and-shape.md, docs/adr/0007-a-sale-stores-its-line-totals-and-its-on-the-spot-payment.md, docs/adr/0010-cost-of-goods-is-allocated-on-read-rounded-along-lot-order.md, docs/adr/0013-the-panel-is-composed-from-each-owner-s-own-figures.md, docs/adr/0015-business-removal-reflects-the-schema-and-deletes-what-it-exported.md.

Epic GH-318. Today money is whole pesos everywhere (ADR-0001). The business-configuration PRD
(`docs/product/business-configuration.md` on the epic's branch, read at commit c4286c2cab8e4a4160292d15921c552fcae3f3f3; it is not in `docs/product/` at this commit)
gives each business its own currency symbol and decimals, and leaves the storage to the Tech Lead.
This records it. No code changes here.

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
- **A rescale is the seller's action, opt-in and one-time.** It is not a migration and not an operator
  command. A business at scale 0 that raises its decimals above 0 in Settings → Business is rescaled
  to scale 2. The rescale:
  - runs in one transaction through the `Transaction` port;
  - multiplies by 100 every column tagged by `money_column()`, in every table, filtered on that
    business's `business_id`, then sets the scale to 2, all or nothing;
  - is checked in that transaction: every amount and every derived figure (totals, balances, profit,
    cash, margins) is equal in value before and after, and a failing check rolls the whole
    transaction back;
  - runs once. A business at scale 2 is never rescaled again, and lowering decimals never divides and
    never changes a stored amount: the rescale is one-way.
- **Two readings that are not exceptions.** Invariant 1 of the epic (a migration never changes the
  value of a column that existed before it) is untouched, because no migration rescales: the
  migration that adds the scale writes scale 0 for every existing business and rewrites nothing. And a
  use case never reads the scale, the rescale included: it calls a port, for example
  `MoneyScale.raise_to_two()` (a name that does not exist yet; the money part creates it), and the scale is read and written only inside that adapter's SQL.
- **A use case never reads the scale.** Domain and application code hold amounts in the business's
  stored integer unit only as opaque integers and never convert them. The scale is applied only
  inside an adapter's SQL statement, through the one money adapter helper, so a sum, a product or a
  comparison done in SQL is scaled in one place. Isolation of the scale to the adapter is checked by
  a test that fails when a use case or a domain module imports the helper or reads the setting.
- **An amount is held only in a typed integer column declared through `money_column()`.** The
  function does not exist at this commit; the first money part creates it. It tags the column so tests find every amount column; an amount is never held in a JSON, Text
  or String column. A migration that adds an amount column declares it the same way.
- **Half-up rounding goes through `round_half_up` in `app/shared/money.py`.** The file does not exist
  at this commit; the first money part creates it with `round_half_up` and `money_column()`. It rounds an exact
  `Fraction` or ratio to the stored unit, half up, in integer arithmetic. No literal `// 100`, no
  `round(` and no whole-peso assumption stays outside it.
- **The business export carries `{scale, decimals}`.** Its amounts are at that scale, with the
  business's scale and decimals beside them, so a restore reads them back unchanged. An export written
  before a rescale reads correctly as scale-0 values.

## Consequences

- docs/adr/0001-stack-and-shape.md's "Money is whole pesos (`int`)" holds for a business at scale 0 and stays true of the
  database column type; docs/adr/0007-a-sale-stores-its-line-totals-and-its-on-the-spot-payment.md's line totals and docs/adr/0010-cost-of-goods-is-allocated-on-read-rounded-along-lot-order.md's cost rounding round to the stored unit
  of the business, not to the peso. The wire changes from whole integers to values in currency units
  in the parts that build it; until then every ADR's figures stand as written.
- Amounts are integers in every business, so sums, balances and the ledger arithmetic stay exact; only
  the SQL that multiplies a price by a quantity needs the helper.
- Two columns of the same table are never at different scales: the scale belongs to the business.
- The business export (docs/adr/0015-business-removal-reflects-the-schema-and-deletes-what-it-exported.md) writes its amounts at the business's scale with `{scale, decimals}`
  beside them; quantities in it stay hundredths (docs/adr/0056-a-stored-quantity-is-a-whole-number-of-hundredths-whatever-the-unit-and-decimals-only-validate-and-display.md).

## Open

- How amounts with cents already stored show after the decimals are later lowered is left to the money
  part. This ADR fixes that lowering never divides a stored amount; what the screens show for such an
  amount is not decided here.

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
