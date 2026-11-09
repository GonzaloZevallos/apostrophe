---
status: accepted
date: 2026-11-02
---

# The VIP type is the single is_vip row of a business, set only by the migration and the import, and never identified by name

Extends docs/adr/0059-customer-type-prices-are-effective-dated-rows-and-the-vip-mark-and-vip-price-columns-stay-frozen-in-place.md without amending it.

Epic GH-318, part 22. ADR-0059 says the migration gives every existing business a customer type
"VIP" and puts the customers that had the VIP mark in it, and that the old mark is frozen. Until
the customer-type prices part exists, membership in that type is what grants the VIP price. This
records how the code tells that type from any other.

## Decision

- **The VIP type is a flag, not a name.** `customer_type.is_vip` is true on exactly one row of a
  business, at most: a partial unique index on `business_id` where `is_vip` is true enforces it.
  A business may have none (a new business, or after the seller deletes it once it is empty).
- **Only two writers set it.** The migration (revision 0020) creates it for every business that
  exists, and the Spreadsheet import creates it when a sheet has a VIP customer and the business
  has none. No request schema accepts `is_vip`; a type is returned with it, read-only.
- **No code identifies it by its name.** The seller may rename it, change its icon or delete it
  when it has no customers. A type the seller names "VIP" has `is_vip` false and gives no price.
  The import refuses, before writing anything, when it needs a VIP type and a type whose folded
  name is "vip" already exists without the flag.
- **Readers ask once.** Every reader of VIP membership (pricing, the Sales list badge, the Customers
  list, Pick a customer) gets the VIP type's id once per request from one reader and compares each
  row's `customer_type_id` to it; none writes a correlated subquery of its own.
- **`customer.is_vip` stays frozen.** It keeps its values, gains a server
  default of false so a row written without it still stores a value, and no new code assigns or
  reads it.

## Consequences

- Moving a customer into the VIP type grants the VIP price from the next sale; moving out stops it.
- The VIP type can be deleted once empty, and from then on nobody in that business gets the VIP
  price.

2026-11: the stored names became `catalog_attribute`/`is_shown` and `customer.is_vip` in migration 0027 (GH-75 part 3, CODING_STANDARDS §11); the decision is unchanged.
